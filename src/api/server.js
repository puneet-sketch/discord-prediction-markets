const path = require('path');
const express = require('express');
const pool = require('../db/pool');
const config = require('../config');
const engine = require('../trading/engine');

const app = express();
app.use(express.json());

// ── Bot API key auth middleware ──
// Keys from env: BOT_API_KEYS="apikey123:bot_mm_001:MarketMakerBot,apikey456:bot_news_001:NewsBot"
const BOT_KEYS = new Map();
if (process.env.BOT_API_KEYS) {
  for (const entry of process.env.BOT_API_KEYS.split(',')) {
    const [key, botId, botName] = entry.trim().split(':');
    if (key && botId) BOT_KEYS.set(key, { botId, botName: botName || botId });
  }
}

function botAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !BOT_KEYS.has(apiKey)) {
    return res.status(401).json({ error: 'invalid_api_key' });
  }
  req.bot = BOT_KEYS.get(apiKey);
  next();
}

// ── Bot API: Buy shares ──
app.post('/api/bot/trade', botAuth, async (req, res) => {
  try {
    const { market_id, side, amount_cents, slippage_cents } = req.body;
    if (!market_id || !side || !amount_cents) {
      return res.status(400).json({ error: 'missing_fields', required: ['market_id', 'side', 'amount_cents'] });
    }
    const result = await engine.placeOrder({
      discordId: req.bot.botId,
      discordName: req.bot.botName,
      marketId: Number(market_id),
      side: side.toUpperCase(),
      amountCents: Number(amount_cents),
      slippageCents: slippage_cents != null ? Number(slippage_cents) : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'execution_error', message: err.message });
  }
});

// ── Bot API: Sell (cash out) shares ──
app.post('/api/bot/cashout', botAuth, async (req, res) => {
  try {
    const { market_id, side, shares } = req.body;
    if (!market_id || !side || !shares) {
      return res.status(400).json({ error: 'missing_fields', required: ['market_id', 'side', 'shares'] });
    }
    const result = await engine.cashOut({
      discordId: req.bot.botId,
      marketId: Number(market_id),
      side: side.toUpperCase(),
      sharesToSell: Number(shares),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'execution_error', message: err.message });
  }
});

// ── Bot API: Get quote (preview trade) ──
app.get('/api/bot/quote/:marketId', botAuth, async (req, res) => {
  try {
    const { side, amount_cents } = req.query;
    if (!side || !amount_cents) {
      return res.status(400).json({ error: 'missing_query_params', required: ['side', 'amount_cents'] });
    }
    const quote = await engine.getQuote(
      Number(req.params.marketId),
      side.toUpperCase(),
      Number(amount_cents),
    );
    res.json({ quote });
  } catch (err) {
    res.status(500).json({ error: 'quote_error', message: err.message });
  }
});

// ── Bot API: Get positions for a bot ──
app.get('/api/bot/positions/:botId', botAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.market_id, p.side, p.shares, p.avg_price_cents, p.total_cost,
              p.realized_pnl, m.yes_price_cents, m.no_price_cents, m.question
       FROM positions p
       JOIN users u ON p.user_id = u.id
       JOIN markets m ON p.market_id = m.id
       WHERE u.discord_id = $1 AND p.shares > 0`,
      [req.params.botId]
    );
    res.json({ positions: rows });
  } catch (err) {
    res.status(500).json({ error: 'query_error', message: err.message });
  }
});

// ── Bot API: Get balance for a bot ──
app.get('/api/bot/balance/:botId', botAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT balance_cents, total_deposited, total_withdrawn FROM users WHERE discord_id = $1',
      [req.params.botId]
    );
    if (rows.length === 0) {
      return res.json({ balance_cents: 0, total_deposited: 0, total_withdrawn: 0 });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'query_error', message: err.message });
  }
});

// ── Bot API: Deposit funds into bot account ──
app.post('/api/bot/deposit', botAuth, async (req, res) => {
  try {
    const { amount_cents } = req.body;
    if (!amount_cents || amount_cents <= 0) {
      return res.status(400).json({ error: 'invalid_amount' });
    }
    // Ensure user exists first
    await engine.getOrCreateUser(req.bot.botId, req.bot.botName);
    const user = await engine.deposit(req.bot.botId, Number(amount_cents));
    res.json({ success: true, balance_cents: user.balance_cents });
  } catch (err) {
    res.status(500).json({ error: 'deposit_error', message: err.message });
  }
});

// ── Serve interactive prototype at /prototype ──
app.use('/prototype', express.static(path.join(__dirname, '../../prototype')));
app.get('/', (req, res) => res.redirect('/prototype'));

// ── Health check (Render uses this) ──
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database unreachable' });
  }
});

// ── Public API: List markets for a guild ──
app.get('/api/markets/:guildId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, slug, question, category, yes_price_cents, no_price_cents,
            volume_cents, trader_count, status, closes_at, created_at
     FROM markets
     WHERE guild_id = $1 AND status = 'open' AND closes_at > NOW()
     ORDER BY volume_cents DESC LIMIT 20`,
    [req.params.guildId]
  );
  res.json({ markets: rows });
});

// ── Public API: Market detail ──
app.get('/api/markets/:guildId/:marketId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM markets WHERE id = $1 AND guild_id = $2',
    [req.params.marketId, req.params.guildId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ market: rows[0] });
});

// ── Public API: Price history for charts ──
app.get('/api/markets/:guildId/:marketId/prices', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT yes_price_cents, no_price_cents, volume_cents, recorded_at
     FROM price_snapshots
     WHERE market_id = $1
     ORDER BY recorded_at ASC LIMIT 500`,
    [req.params.marketId]
  );
  res.json({ prices: rows });
});

// ── Public API: Server dashboard stats ──
app.get('/api/dashboard/:guildId', async (req, res) => {
  const guildId = req.params.guildId;

  const [volumeRes, tradersRes, marketsRes, feesRes] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(volume_cents), 0) as total_volume
       FROM markets WHERE guild_id = $1`,
      [guildId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT t.user_id) as active_traders
       FROM trades t JOIN markets m ON t.market_id = m.id
       WHERE m.guild_id = $1 AND t.created_at > NOW() - INTERVAL '30 days'`,
      [guildId]
    ),
    pool.query(
      `SELECT COUNT(*) as total_markets
       FROM markets WHERE guild_id = $1`,
      [guildId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(server_share), 0) as server_revenue,
              COALESCE(SUM(total_fee), 0) as total_fees
       FROM fee_ledger
       WHERE guild_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [guildId]
    ),
  ]);

  res.json({
    dashboard: {
      totalVolumeCents: Number(volumeRes.rows[0].total_volume),
      activeTraders: Number(tradersRes.rows[0].active_traders),
      totalMarkets: Number(marketsRes.rows[0].total_markets),
      serverRevenueCents: Number(feesRes.rows[0].server_revenue),
      totalFeesCents: Number(feesRes.rows[0].total_fees),
    },
  });
});

function startServer() {
  return new Promise((resolve) => {
    app.listen(config.server.port, () => {
      console.log(`API server listening on port ${config.server.port}`);
      resolve();
    });
  });
}

module.exports = { app, startServer };
