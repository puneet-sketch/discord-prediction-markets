const pool = require('../db/pool');
const config = require('../config');
const { AMM } = require('./amm');
const { EventEmitter } = require('events');

/**
 * Trading Engine — handles order validation, execution against the AMM,
 * position tracking, and settlement.
 *
 * Emits:
 *   'trade'    — { trade, market } after each fill
 *   'priceUpdate' — { marketId, yesPrice, noPrice } after price changes
 */
class TradingEngine extends EventEmitter {
  constructor() {
    super();
    // Cache AMMs in memory keyed by market ID
    this.amms = new Map();
  }

  /**
   * Load or create an AMM for a market.
   */
  async getAMM(marketId) {
    if (this.amms.has(marketId)) {
      return this.amms.get(marketId);
    }

    const { rows } = await pool.query(
      'SELECT yes_shares, no_shares, liquidity_param FROM markets WHERE id = $1',
      [marketId]
    );

    if (rows.length === 0) throw new Error(`Market ${marketId} not found`);

    const amm = new AMM(rows[0].yes_shares, rows[0].no_shares, rows[0].liquidity_param);
    this.amms.set(marketId, amm);
    return amm;
  }

  /**
   * Get or create a user by Discord ID.
   */
  async getOrCreateUser(discordId, discordName) {
    const { rows } = await pool.query(
      `INSERT INTO users (discord_id, discord_name)
       VALUES ($1, $2)
       ON CONFLICT (discord_id) DO UPDATE SET discord_name = $2
       RETURNING *`,
      [discordId, discordName]
    );
    return rows[0];
  }

  /**
   * Deposit funds into a user's balance (cents).
   */
  async deposit(discordId, amountCents) {
    const { rows } = await pool.query(
      `UPDATE users
       SET balance_cents = balance_cents + $2,
           total_deposited = total_deposited + $2,
           updated_at = NOW()
       WHERE discord_id = $1
       RETURNING *`,
      [discordId, amountCents]
    );
    return rows[0];
  }

  /**
   * Get a price quote without executing.
   */
  async getQuote(marketId, side, amountCents) {
    const amm = await this.getAMM(marketId);
    const currentPrice = side === 'YES' ? amm.yesPrice() : amm.noPrice();

    // Calculate how many shares `amountCents` buys
    // Binary search for the quantity that costs exactly amountCents
    let lo = 0.01;
    let hi = amountCents; // Upper bound: can't get more shares than cents
    let bestQty = 0;
    let bestCost = 0;

    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const quote = amm.quoteBuy(side, mid);
      if (quote.costCents <= amountCents) {
        bestQty = mid;
        bestCost = quote.costCents;
        lo = mid;
      } else {
        hi = mid;
      }
    }

    const quote = amm.quoteBuy(side, bestQty);
    return {
      side,
      currentPrice,
      shares: Math.round(bestQty * 10) / 10,
      costCents: quote.costCents,
      avgPrice: quote.avgPrice,
      potentialPayout: Math.round(bestQty * 100), // $1 per share if wins
      potentialProfit: Math.round(bestQty * 100) - quote.costCents,
      priceImpact: quote.avgPrice - currentPrice,
      newYesPrice: quote.newYesPrice,
      newNoPrice: quote.newNoPrice,
    };
  }

  /**
   * Place and execute an order.
   *
   * Returns: { success, order, trade, error }
   */
  async placeOrder({ discordId, discordName, marketId, side, amountCents, slippageCents }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Get/create user
      const userRes = await client.query(
        `INSERT INTO users (discord_id, discord_name)
         VALUES ($1, $2)
         ON CONFLICT (discord_id) DO UPDATE SET discord_name = $2
         RETURNING *`,
        [discordId, discordName]
      );
      const user = userRes.rows[0];

      // 2. Check balance
      if (user.balance_cents < amountCents) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'insufficient_balance',
          balance: user.balance_cents,
          required: amountCents,
        };
      }

      // 3. Check market is open
      const marketRes = await client.query(
        'SELECT * FROM markets WHERE id = $1 FOR UPDATE',
        [marketId]
      );
      if (marketRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'market_not_found' };
      }
      const market = marketRes.rows[0];

      if (market.status !== 'open') {
        await client.query('ROLLBACK');
        return { success: false, error: 'market_closed' };
      }

      if (new Date(market.closes_at) <= new Date()) {
        await client.query('ROLLBACK');
        return { success: false, error: 'market_expired' };
      }

      // 4. Get AMM and current price
      const amm = await this.getAMM(marketId);
      const currentPrice = side === 'YES' ? amm.yesPrice() : amm.noPrice();
      const maxPrice = currentPrice + (slippageCents || config.trading.defaultSlippageCents);

      // 5. Calculate shares for the amount
      let lo = 0.01;
      let hi = amountCents;
      let bestQty = 0;

      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        const quote = amm.quoteBuy(side, mid);
        if (quote.costCents <= amountCents) {
          bestQty = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }

      if (bestQty < 0.01) {
        await client.query('ROLLBACK');
        return { success: false, error: 'amount_too_small' };
      }

      // 6. Check slippage
      const quote = amm.quoteBuy(side, bestQty);
      if (quote.avgPrice > maxPrice) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'slippage_exceeded',
          currentPrice: side === 'YES' ? amm.yesPrice() : amm.noPrice(),
          avgPrice: quote.avgPrice,
          maxPrice,
        };
      }

      // 7. Execute AMM trade
      const result = amm.executeBuy(side, bestQty);
      const fillPrice = result.avgPrice;
      const costCents = result.costCents;

      // 8. Calculate fee
      const potentialPayout = Math.round(bestQty * 100);
      const feeCents = Math.round(potentialPayout * config.trading.feeRate);

      // 9. Create order record
      const orderRes = await client.query(
        `INSERT INTO orders
         (user_id, market_id, side, quantity, limit_price, slippage, max_price,
          cost_cents, fill_price, filled_qty, status, filled_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'filled', NOW())
         RETURNING *`,
        [user.id, marketId, side, bestQty, currentPrice,
         slippageCents || config.trading.defaultSlippageCents, maxPrice,
         costCents, fillPrice, bestQty]
      );
      const order = orderRes.rows[0];

      // 10. Create trade record
      const tradeRes = await client.query(
        `INSERT INTO trades
         (order_id, market_id, user_id, side, quantity, price_cents, cost_cents, fee_cents)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [order.id, marketId, user.id, side, bestQty, fillPrice, costCents, feeCents]
      );
      const trade = tradeRes.rows[0];

      // 11. Deduct balance (cost + fee)
      const totalDeduction = costCents + feeCents;
      await client.query(
        `UPDATE users SET balance_cents = balance_cents - $2, updated_at = NOW()
         WHERE id = $1`,
        [user.id, totalDeduction]
      );

      // 12. Upsert position
      await client.query(
        `INSERT INTO positions (user_id, market_id, side, shares, avg_price_cents, total_cost)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, market_id, side)
         DO UPDATE SET
           shares = positions.shares + $4,
           avg_price_cents = CASE
             WHEN positions.shares + $4 > 0
             THEN ((positions.avg_price_cents * positions.shares) + ($5 * $4))::INTEGER
                  / (positions.shares + $4)
             ELSE 0 END,
           total_cost = positions.total_cost + $6,
           updated_at = NOW()`,
        [user.id, marketId, side, bestQty, fillPrice, costCents]
      );

      // 13. Update market state
      const ammState = amm.getState();
      const isNewTrader = await client.query(
        `SELECT 1 FROM positions WHERE user_id = $1 AND market_id = $2
         AND shares > 0 LIMIT 1`,
        [user.id, marketId]
      );

      await client.query(
        `UPDATE markets SET
           yes_shares = $2, no_shares = $3,
           yes_price_cents = $4, no_price_cents = $5,
           volume_cents = volume_cents + $6,
           trader_count = trader_count + $7,
           updated_at = NOW()
         WHERE id = $1`,
        [marketId, ammState.yesShares, ammState.noShares,
         ammState.yesPrice, ammState.noPrice, costCents,
         isNewTrader.rows.length === 0 ? 0 : 0] // trader_count handled below
      );

      // Increment trader count if this is their first position on this market
      const existingPositions = await client.query(
        `SELECT COUNT(*) as cnt FROM trades WHERE user_id = $1 AND market_id = $2`,
        [user.id, marketId]
      );
      if (parseInt(existingPositions.rows[0].cnt) === 1) {
        await client.query(
          'UPDATE markets SET trader_count = trader_count + 1 WHERE id = $1',
          [marketId]
        );
      }

      // 14. Record fee split
      const platformShare = Math.round(feeCents * config.trading.platformFeeShare);
      const serverShare = Math.round(feeCents * config.trading.serverOwnerFeeShare);
      const creatorShare = feeCents - platformShare - serverShare;

      await client.query(
        `INSERT INTO fee_ledger
         (trade_id, market_id, guild_id, total_fee, platform_share, server_share, creator_share)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [trade.id, marketId, market.guild_id, feeCents,
         platformShare, serverShare, creatorShare]
      );

      // 15. Price snapshot
      await client.query(
        `INSERT INTO price_snapshots (market_id, yes_price_cents, no_price_cents, volume_cents)
         VALUES ($1, $2, $3, $4)`,
        [marketId, ammState.yesPrice, ammState.noPrice, market.volume_cents + costCents]
      );

      await client.query('COMMIT');

      // Emit events for WebSocket subscribers
      this.emit('trade', { trade, market: { ...market, ...ammState } });
      this.emit('priceUpdate', {
        marketId,
        yesPrice: ammState.yesPrice,
        noPrice: ammState.noPrice,
      });

      return {
        success: true,
        order,
        trade,
        fill: {
          side,
          shares: Math.round(bestQty * 10) / 10,
          avgPrice: fillPrice,
          costCents,
          feeCents,
          totalDeduction,
          potentialPayout,
          potentialProfit: potentialPayout - totalDeduction,
        },
        market: {
          yesPrice: ammState.yesPrice,
          noPrice: ammState.noPrice,
        },
      };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Order execution error:', err);
      return { success: false, error: 'execution_error', message: err.message };
    } finally {
      client.release();
    }
  }

  /**
   * Cash out (sell) a position early.
   */
  async cashOut({ discordId, marketId, side, sharesToSell }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        'SELECT * FROM users WHERE discord_id = $1', [discordId]
      );
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'user_not_found' };
      }
      const user = userRes.rows[0];

      const posRes = await client.query(
        'SELECT * FROM positions WHERE user_id = $1 AND market_id = $2 AND side = $3',
        [user.id, marketId, side]
      );
      if (posRes.rows.length === 0 || Number(posRes.rows[0].shares) < sharesToSell) {
        await client.query('ROLLBACK');
        return { success: false, error: 'insufficient_shares' };
      }

      const amm = await this.getAMM(marketId);
      const sellResult = amm.executeSell(side, sharesToSell);
      if (!sellResult) {
        await client.query('ROLLBACK');
        return { success: false, error: 'sell_failed' };
      }

      // Credit user
      await client.query(
        'UPDATE users SET balance_cents = balance_cents + $2, updated_at = NOW() WHERE id = $1',
        [user.id, sellResult.payoutCents]
      );

      // Update position
      await client.query(
        `UPDATE positions SET shares = shares - $4, updated_at = NOW()
         WHERE user_id = $1 AND market_id = $2 AND side = $3`,
        [user.id, marketId, side, sharesToSell]
      );

      // Update market AMM state
      const ammState = amm.getState();
      await client.query(
        `UPDATE markets SET
           yes_shares = $2, no_shares = $3,
           yes_price_cents = $4, no_price_cents = $5,
           updated_at = NOW()
         WHERE id = $1`,
        [marketId, ammState.yesShares, ammState.noShares,
         ammState.yesPrice, ammState.noPrice]
      );

      await client.query('COMMIT');

      this.emit('priceUpdate', {
        marketId,
        yesPrice: ammState.yesPrice,
        noPrice: ammState.noPrice,
      });

      return {
        success: true,
        payoutCents: sellResult.payoutCents,
        sharesSold: sharesToSell,
        newYesPrice: ammState.yesPrice,
        newNoPrice: ammState.noPrice,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      return { success: false, error: 'execution_error', message: err.message };
    } finally {
      client.release();
    }
  }

  /**
   * Resolve a market and settle all positions.
   */
  async resolveMarket(marketId, resolution) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock market
      const marketRes = await client.query(
        'SELECT * FROM markets WHERE id = $1 FOR UPDATE', [marketId]
      );
      if (marketRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'market_not_found' };
      }

      const market = marketRes.rows[0];
      if (market.status !== 'open') {
        await client.query('ROLLBACK');
        return { success: false, error: 'market_not_open' };
      }

      // Mark resolved
      await client.query(
        `UPDATE markets SET status = 'resolved', resolution = $2, resolved_at = NOW()
         WHERE id = $1`,
        [marketId, resolution]
      );

      // Pay out winning positions ($1.00 = 100 cents per share)
      const winningSide = resolution; // 'YES' or 'NO'
      const winners = await client.query(
        'SELECT * FROM positions WHERE market_id = $1 AND side = $2 AND shares > 0',
        [marketId, winningSide]
      );

      for (const pos of winners.rows) {
        const payoutCents = Math.round(Number(pos.shares) * 100);
        await client.query(
          'UPDATE users SET balance_cents = balance_cents + $2, updated_at = NOW() WHERE id = $1',
          [pos.user_id, payoutCents]
        );
        await client.query(
          `UPDATE positions SET realized_pnl = $4 - total_cost, updated_at = NOW()
           WHERE user_id = $1 AND market_id = $2 AND side = $3`,
          [pos.user_id, marketId, winningSide, payoutCents]
        );
      }

      // Mark losing positions
      const losingSide = winningSide === 'YES' ? 'NO' : 'YES';
      await client.query(
        `UPDATE positions SET realized_pnl = -total_cost, updated_at = NOW()
         WHERE market_id = $1 AND side = $2 AND shares > 0`,
        [marketId, losingSide]
      );

      await client.query('COMMIT');

      // Clean AMM cache
      this.amms.delete(marketId);

      return { success: true, winningSide, winnersCount: winners.rows.length };
    } catch (err) {
      await client.query('ROLLBACK');
      return { success: false, error: 'settlement_error', message: err.message };
    } finally {
      client.release();
    }
  }
}

// Singleton
const engine = new TradingEngine();
module.exports = engine;
