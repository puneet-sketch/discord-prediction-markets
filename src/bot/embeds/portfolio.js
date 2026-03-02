const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Build the portfolio embed for a user.
 */
function buildPortfolioEmbed(user, positions, markets) {
  const balanceDollars = (user.balance_cents / 100).toFixed(2);

  // Build market lookup
  const marketMap = new Map();
  for (const m of markets) marketMap.set(m.id, m);

  // Calculate total P&L
  let totalPnl = 0;
  const positionLines = [];

  for (const pos of positions) {
    const market = marketMap.get(pos.market_id);
    if (!market || Number(pos.shares) <= 0) continue;

    const currentPrice = pos.side === 'YES' ? market.yes_price_cents : market.no_price_cents;
    const costBasis = Number(pos.avg_price_cents);
    const shares = Number(pos.shares);
    const pnlCents = Math.round((currentPrice - costBasis) * shares);
    totalPnl += pnlCents;

    const pnlSign = pnlCents >= 0 ? '+' : '';
    const pnlPct = costBasis > 0 ? ((pnlCents / (costBasis * shares)) * 100).toFixed(1) : '0.0';
    const sideEmoji = pos.side === 'YES' ? '\ud83d\udfe2' : '\ud83d\udd34';
    const pnlEmoji = pnlCents >= 0 ? '\ud83d\udfe9' : '\ud83d\udfe5';

    const closesAt = new Date(market.closes_at);
    const now = new Date();
    const hoursLeft = Math.max(0, Math.round((closesAt - now) / (1000 * 60 * 60)));
    const timeLabel = hoursLeft > 24 ? `${Math.round(hoursLeft / 24)}d` : `${hoursLeft}h`;

    // Truncate question
    const question = market.question.length > 40
      ? market.question.slice(0, 37) + '...'
      : market.question;

    positionLines.push(
      `${sideEmoji} **${question}**\n` +
      `\u2003${shares.toFixed(1)} shares @ ${costBasis}\u00a2  \u2192  now ${currentPrice}\u00a2\n` +
      `\u2003${pnlEmoji} P&L: ${pnlSign}$${(Math.abs(pnlCents) / 100).toFixed(2)} (${pnlSign}${pnlPct}%)  \u2022  \u23f0 ${timeLabel}\n` +
      `\u2003\`[Cash Out $${((currentPrice * shares) / 100).toFixed(2)}]\``
    );
  }

  const totalPnlSign = totalPnl >= 0 ? '+' : '';
  const totalPnlDollars = (Math.abs(totalPnl) / 100).toFixed(2);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('\ud83d\udcbc Your Prediction Portfolio')
    .setDescription(
      `**Balance:** $${balanceDollars}  \u2022  ` +
      `**P&L:** ${totalPnlSign}$${totalPnlDollars}\n` +
      `\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n` +
      (positionLines.length > 0
        ? positionLines.join('\n\n')
        : '*No active positions. Browse markets to start trading!*')
    )
    .setFooter({ text: 'Prediction Markets' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('browse_markets')
      .setLabel('Browse Markets')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\ud83d\udcca'),
    new ButtonBuilder()
      .setCustomId('deposit_funds')
      .setLabel('Add Funds')
      .setStyle(ButtonStyle.Success)
      .setEmoji('\ud83d\udcb3'),
    new ButtonBuilder()
      .setCustomId('trade_history')
      .setLabel('History')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('\ud83d\udcdd'),
  );

  return { embed, row };
}

/**
 * Build the leaderboard embed for a server.
 */
function buildLeaderboardEmbed(guildName, leaderboard) {
  const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];

  const lines = leaderboard.map((entry, i) => {
    const rank = i < 3 ? medals[i] : `${i + 1}.`;
    const pnlSign = entry.pnl >= 0 ? '+' : '';
    return `${rank}  **${entry.name}**  \u2022  ${pnlSign}$${(Math.abs(entry.pnl) / 100).toFixed(2)}  \u2022  ` +
      `${entry.win_rate}% win  \u2022  ${entry.trades} trades`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`\ud83c\udfc6 Prediction Leaderboard \u2014 ${guildName}`)
    .setDescription(
      lines.length > 0
        ? lines.join('\n')
        : '*No trades yet! Be the first to predict.*'
    )
    .setFooter({ text: 'This month  \u2022  Prediction Markets' })
    .setTimestamp();

  return { embed };
}

module.exports = { buildPortfolioEmbed, buildLeaderboardEmbed };
