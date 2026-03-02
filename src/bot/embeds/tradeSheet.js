const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Build the trade confirmation embed (shown as an ephemeral reply
 * before the user confirms the order).
 */
function buildTradePreview(market, quote, side, amountCents) {
  const amountDollars = (amountCents / 100).toFixed(2);
  const payoutDollars = (quote.potentialPayout / 100).toFixed(2);
  const profitDollars = (quote.potentialProfit / 100).toFixed(2);
  const profitPct = ((quote.potentialProfit / amountCents) * 100).toFixed(1);
  const sideEmoji = side === 'YES' ? '\ud83d\udfe2' : '\ud83d\udd34';
  const sideColor = side === 'YES' ? 0x22c55e : 0xef4444;

  const embed = new EmbedBuilder()
    .setColor(sideColor)
    .setTitle(`${sideEmoji} Trade: ${market.question}`)
    .setDescription(
      `You're buying **${side}**\n\n` +
      `\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n` +
      `\u2502  **Price per share**     \`${quote.currentPrice}\u00a2\`\n` +
      `\u2502  **Amount**              \`$${amountDollars}\`\n` +
      `\u2502  **Shares**              \`${quote.shares}\`\n` +
      `\u2502  **Avg fill price**      \`${quote.avgPrice}\u00a2\`\n` +
      `\u2502\n` +
      `\u2502  **Potential payout**    \`$${payoutDollars}\`\n` +
      `\u2502  **Potential profit**    \`$${profitDollars} (+${profitPct}%)\`\n` +
      `\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n\n` +
      `\ud83d\udd12 Price protection: \u00b12\u00a2 slippage\n` +
      `\u2139\ufe0f Shares pay **$1.00** each if **${side}** wins`
    )
    .setFooter({ text: `Market #${market.id}` });

  // Amount quick-select buttons
  const amountRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_order_${market.id}_${side}_500`)
      .setLabel('$5')
      .setStyle(amountCents === 500 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`confirm_order_${market.id}_${side}_1000`)
      .setLabel('$10')
      .setStyle(amountCents === 1000 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`confirm_order_${market.id}_${side}_2500`)
      .setLabel('$25')
      .setStyle(amountCents === 2500 ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`confirm_order_${market.id}_${side}_5000`)
      .setLabel('$50')
      .setStyle(amountCents === 5000 ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );

  // Confirm / Cancel
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`execute_order_${market.id}_${side}_${amountCents}`)
      .setLabel(`Place Order \u2014 Buy ${side} at ${quote.currentPrice}\u00a2`)
      .setStyle(side === 'YES' ? ButtonStyle.Success : ButtonStyle.Danger)
      .setEmoji(side === 'YES' ? '\ud83d\udfe2' : '\ud83d\udd34'),
    new ButtonBuilder()
      .setCustomId('cancel_trade')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  return { embed, rows: [amountRow, actionRow] };
}

/**
 * Build the order confirmation embed.
 */
function buildOrderConfirmation(market, fill, side) {
  const sideEmoji = side === 'YES' ? '\ud83d\udfe2' : '\ud83d\udd34';
  const sideColor = side === 'YES' ? 0x22c55e : 0xef4444;

  const embed = new EmbedBuilder()
    .setColor(sideColor)
    .setTitle('\u2705 Order Placed!')
    .setDescription(
      `**${market.question}**\n\n` +
      `${sideEmoji} **Side:** ${side}\n` +
      `\ud83d\udcca **Shares:** ${fill.shares}\n` +
      `\ud83d\udcb0 **Avg price:** ${fill.avgPrice}\u00a2\n` +
      `\ud83d\udcb8 **Total cost:** $${(fill.totalDeduction / 100).toFixed(2)} ` +
      `(incl. ${(fill.feeCents / 100).toFixed(2)} fee)\n` +
      `\ud83c\udfaf **Potential win:** $${(fill.potentialPayout / 100).toFixed(2)} ` +
      `(+$${(fill.potentialProfit / 100).toFixed(2)})\n\n` +
      `**Status:** \u25cf Filled at ${fill.avgPrice}\u00a2`
    )
    .setFooter({ text: `Market #${market.id}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`market_info_${market.id}`)
      .setLabel('View Market')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('\ud83d\udcca'),
    new ButtonBuilder()
      .setCustomId(`share_trade_${market.id}_${side}`)
      .setLabel('Share in Chat')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('\ud83d\udce2'),
    new ButtonBuilder()
      .setCustomId('view_portfolio')
      .setLabel('My Portfolio')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('\ud83d\udcbc'),
  );

  return { embed, row };
}

/**
 * Build the "share trade" public embed.
 */
function buildShareTradeEmbed(market, username, side, price) {
  const sideEmoji = side === 'YES' ? '\ud83d\udfe2' : '\ud83d\udd34';

  const embed = new EmbedBuilder()
    .setColor(side === 'YES' ? 0x22c55e : 0xef4444)
    .setDescription(
      `**${username}** just bought ${sideEmoji} **${side}** on:\n` +
      `> ${market.question}\n` +
      `> at **${price}\u00a2**\n\n` +
      `**Volume:** $${(Number(market.volume_cents) / 100).toFixed(0)}  \u2022  ` +
      `**Traders:** ${market.trader_count}`
    )
    .setFooter({ text: 'Prediction Markets' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_yes_${market.id}`)
      .setLabel(`YES  ${market.yes_price_cents}\u00a2`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`trade_no_${market.id}`)
      .setLabel(`NO  ${market.no_price_cents}\u00a2`)
      .setStyle(ButtonStyle.Danger),
  );

  return { embed, row };
}

module.exports = { buildTradePreview, buildOrderConfirmation, buildShareTradeEmbed };
