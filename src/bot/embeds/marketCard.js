const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Build the main market event card embed.
 */
function buildMarketCard(market) {
  const yesPrice = market.yes_price_cents;
  const noPrice = market.no_price_cents;
  const volumeDollars = (Number(market.volume_cents) / 100).toLocaleString('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0,
  });
  const closesAt = new Date(market.closes_at);
  const closesTimestamp = Math.floor(closesAt.getTime() / 1000);

  // Build a simple probability bar
  const filled = Math.round(yesPrice / 5);
  const empty = 20 - filled;
  const probBar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);

  const embed = new EmbedBuilder()
    .setColor(yesPrice >= 50 ? 0x22c55e : 0xef4444)
    .setTitle(market.question)
    .setDescription(
      `\`${probBar}\` **${yesPrice}%** chance\n\n` +
      (market.description ? `${market.description}\n\n` : '') +
      `**Volume:** ${volumeDollars}  \u2022  **Traders:** ${market.trader_count}`
    )
    .addFields(
      {
        name: '\u200b',
        value: `\u23f0 Closes <t:${closesTimestamp}:R>  \u2022  \ud83c\udff7\ufe0f \`${market.category}\``,
      }
    )
    .setFooter({ text: `Market #${market.id}  \u2022  Prediction Markets` })
    .setTimestamp();

  // YES/NO buttons
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_yes_${market.id}`)
      .setLabel(`YES  ${yesPrice}\u00a2`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('\ud83d\udfe2'),
    new ButtonBuilder()
      .setCustomId(`trade_no_${market.id}`)
      .setLabel(`NO  ${noPrice}\u00a2`)
      .setStyle(ButtonStyle.Danger)
      .setEmoji('\ud83d\udd34'),
    new ButtonBuilder()
      .setCustomId(`market_info_${market.id}`)
      .setLabel('Details')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('\ud83d\udcca'),
  );

  return { embed, row };
}

/**
 * Build a resolved market card.
 */
function buildResolvedCard(market) {
  const won = market.resolution === 'YES';
  const embed = new EmbedBuilder()
    .setColor(won ? 0x22c55e : 0xef4444)
    .setTitle(`${won ? '\u2705' : '\u274c'} RESOLVED: ${market.question}`)
    .setDescription(
      `**Result:** ${market.resolution}\n\n` +
      `Winning shares paid out at $1.00 each.\n` +
      `**Total Volume:** $${(Number(market.volume_cents) / 100).toFixed(2)}  \u2022  ` +
      `**Traders:** ${market.trader_count}`
    )
    .setFooter({ text: `Market #${market.id}  \u2022  Resolved` })
    .setTimestamp();

  return { embed };
}

module.exports = { buildMarketCard, buildResolvedCard };
