const pool = require('../../db/pool');
const engine = require('../../trading/engine');
const config = require('../../config');
const { buildTradePreview, buildOrderConfirmation, buildShareTradeEmbed } = require('../embeds/tradeSheet');
const { buildMarketCard } = require('../embeds/marketCard');
const { buildPortfolioEmbed } = require('../embeds/portfolio');

/**
 * Handle all button interactions.
 */
async function handleButton(interaction) {
  const id = interaction.customId;

  // ── YES/NO trade buttons on market card ──
  if (id.startsWith('trade_yes_') || id.startsWith('trade_no_')) {
    return handleTradeButton(interaction);
  }

  // ── Amount quick-select on trade preview ──
  if (id.startsWith('confirm_order_')) {
    return handleAmountSelect(interaction);
  }

  // ── Execute order ──
  if (id.startsWith('execute_order_')) {
    return handleExecuteOrder(interaction);
  }

  // ── Share trade in chat ──
  if (id.startsWith('share_trade_')) {
    return handleShareTrade(interaction);
  }

  // ── Market info ──
  if (id.startsWith('market_info_')) {
    return handleMarketInfo(interaction);
  }

  // ── Cancel ──
  if (id === 'cancel_trade') {
    return interaction.update({
      content: 'Trade cancelled.',
      embeds: [],
      components: [],
    });
  }

  // ── Portfolio ──
  if (id === 'view_portfolio') {
    return handleViewPortfolio(interaction);
  }

  // ── Browse markets ──
  if (id === 'browse_markets') {
    return handleBrowseMarkets(interaction);
  }

  // ── Deposit ──
  if (id === 'deposit_funds') {
    return interaction.reply({
      content: 'Use `/predict deposit <amount>` to add funds to your balance.',
      ephemeral: true,
    });
  }
}

async function handleTradeButton(interaction) {
  const parts = interaction.customId.split('_');
  const side = parts[1].toUpperCase(); // yes or no
  const marketId = parseInt(parts[2]);

  // Default amount: $10 (1000 cents)
  const defaultAmount = 1000;

  const { rows } = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
  if (rows.length === 0) {
    return interaction.reply({ content: 'Market not found.', ephemeral: true });
  }
  const market = rows[0];

  if (market.status !== 'open') {
    return interaction.reply({ content: 'This market is closed.', ephemeral: true });
  }

  // Ensure user exists
  await engine.getOrCreateUser(interaction.user.id, interaction.user.username);

  // Get quote
  const quote = await engine.getQuote(marketId, side, defaultAmount);

  const { embed, rows: componentRows } = buildTradePreview(market, quote, side, defaultAmount);

  await interaction.reply({
    embeds: [embed],
    components: componentRows,
    ephemeral: true,
  });
}

async function handleAmountSelect(interaction) {
  // confirm_order_{marketId}_{side}_{amountCents}
  const parts = interaction.customId.split('_');
  const marketId = parseInt(parts[2]);
  const side = parts[3].toUpperCase();
  const amountCents = parseInt(parts[4]);

  const { rows } = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
  if (rows.length === 0) {
    return interaction.update({ content: 'Market not found.', embeds: [], components: [] });
  }
  const market = rows[0];

  const quote = await engine.getQuote(marketId, side, amountCents);
  const { embed, rows: componentRows } = buildTradePreview(market, quote, side, amountCents);

  await interaction.update({
    embeds: [embed],
    components: componentRows,
  });
}

async function handleExecuteOrder(interaction) {
  // execute_order_{marketId}_{side}_{amountCents}
  const parts = interaction.customId.split('_');
  const marketId = parseInt(parts[2]);
  const side = parts[3].toUpperCase();
  const amountCents = parseInt(parts[4]);

  await interaction.deferUpdate();

  // Check if user needs to deposit first
  const user = await engine.getOrCreateUser(interaction.user.id, interaction.user.username);
  if (user.balance_cents < amountCents) {
    return interaction.editReply({
      content: `\u26a0\ufe0f **Insufficient balance**\n\n` +
        `You need **$${(amountCents / 100).toFixed(2)}** but your balance is ` +
        `**$${(user.balance_cents / 100).toFixed(2)}**.\n\n` +
        `Use \`/predict deposit <amount>\` to add funds first.\n\n` +
        `*In production, this is where the auth/payment gate would appear.*`,
      embeds: [],
      components: [],
    });
  }

  const result = await engine.placeOrder({
    discordId: interaction.user.id,
    discordName: interaction.user.username,
    marketId,
    side,
    amountCents,
    slippageCents: config.trading.defaultSlippageCents,
  });

  if (!result.success) {
    let errorMsg = 'Order failed.';
    switch (result.error) {
      case 'slippage_exceeded':
        errorMsg = `\u26a0\ufe0f **Price moved beyond your limit**\n\n` +
          `Current price: **${result.currentPrice}\u00a2**\n` +
          `Your max: **${result.maxPrice}\u00a2**\n\n` +
          `The market moved too fast. Try again or increase slippage.`;
        break;
      case 'market_closed':
        errorMsg = 'This market is closed for trading.';
        break;
      case 'market_expired':
        errorMsg = 'This market has expired.';
        break;
      default:
        errorMsg = `Order failed: ${result.error}`;
    }
    return interaction.editReply({ content: errorMsg, embeds: [], components: [] });
  }

  // Fetch updated market
  const { rows } = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
  const market = rows[0];

  const { embed, row } = buildOrderConfirmation(market, result.fill, side);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleShareTrade(interaction) {
  // share_trade_{marketId}_{side}
  const parts = interaction.customId.split('_');
  const marketId = parseInt(parts[2]);
  const side = parts[3].toUpperCase();

  const { rows } = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
  if (rows.length === 0) return;

  const market = rows[0];
  const price = side === 'YES' ? market.yes_price_cents : market.no_price_cents;

  const { embed, row } = buildShareTradeEmbed(
    market,
    interaction.user.username,
    side,
    price
  );

  // Send public message to channel
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Shared to chat!', ephemeral: true });
}

async function handleMarketInfo(interaction) {
  const parts = interaction.customId.split('_');
  const marketId = parseInt(parts[2]);

  const { rows } = await pool.query('SELECT * FROM markets WHERE id = $1', [marketId]);
  if (rows.length === 0) {
    return interaction.reply({ content: 'Market not found.', ephemeral: true });
  }

  const { embed, row } = buildMarketCard(rows[0]);
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleViewPortfolio(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const user = await engine.getOrCreateUser(interaction.user.id, interaction.user.username);
  const { rows: positions } = await pool.query(
    `SELECT p.* FROM positions p
     JOIN markets m ON p.market_id = m.id
     WHERE p.user_id = $1 AND p.shares > 0
     ORDER BY p.updated_at DESC LIMIT 10`,
    [user.id]
  );

  const marketIds = [...new Set(positions.map(p => p.market_id))];
  let markets = [];
  if (marketIds.length > 0) {
    const { rows } = await pool.query('SELECT * FROM markets WHERE id = ANY($1)', [marketIds]);
    markets = rows;
  }

  const { embed, row } = buildPortfolioEmbed(user, positions, markets);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleBrowseMarkets(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const { rows: markets } = await pool.query(
    `SELECT * FROM markets
     WHERE guild_id = $1 AND status = 'open' AND closes_at > NOW()
     ORDER BY volume_cents DESC LIMIT 5`,
    [interaction.guildId]
  );

  if (markets.length === 0) {
    return interaction.editReply('No active markets. Create one with `/predict create`!');
  }

  const { embed, row } = buildMarketCard(markets[0]);
  await interaction.editReply({ embeds: [embed], components: [row] });

  for (let i = 1; i < markets.length; i++) {
    const { embed: e, row: r } = buildMarketCard(markets[i]);
    await interaction.followUp({ embeds: [e], components: [r], ephemeral: true });
  }
}

module.exports = { handleButton };
