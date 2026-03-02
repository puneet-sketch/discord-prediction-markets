const pool = require('../../db/pool');
const config = require('../../config');
const { buildMarketCard } = require('../embeds/marketCard');
const { v4: uuidv4 } = require('uuid');

/**
 * Handle modal submissions.
 */
async function handleModal(interaction) {
  if (interaction.customId === 'create_market_modal') {
    return handleCreateMarket(interaction);
  }
}

/**
 * Parse a duration string like "4h", "1d", "7d" into milliseconds.
 */
function parseDuration(str) {
  const match = str.trim().match(/^(\d+)\s*(h|d|w|m)$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { h: 3600000, d: 86400000, w: 604800000, m: 2592000000 };
  return num * (multipliers[unit] || 0);
}

async function handleCreateMarket(interaction) {
  await interaction.deferReply();

  const question = interaction.fields.getTextInputValue('market_question');
  const description = interaction.fields.getTextInputValue('market_description') || null;
  const category = interaction.fields.getTextInputValue('market_category').toLowerCase();
  const closesIn = interaction.fields.getTextInputValue('market_closes');

  const durationMs = parseDuration(closesIn);
  if (!durationMs) {
    return interaction.editReply(
      '\u274c Invalid duration. Use format like `4h`, `1d`, `7d`.'
    );
  }

  const closesAt = new Date(Date.now() + durationMs);
  const slug = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    + '-' + uuidv4().slice(0, 8);

  try {
    const { rows } = await pool.query(
      `INSERT INTO markets
       (slug, question, description, category, resolution_source,
        yes_shares, no_shares, liquidity_param,
        yes_price_cents, no_price_cents,
        guild_id, channel_id, creator_id, closes_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [slug, question, description, category, description,
       0, 0, config.amm.subsidy,
       50, 50,
       interaction.guildId, interaction.channelId, interaction.user.id, closesAt]
    );

    const market = rows[0];
    const { embed, row } = buildMarketCard(market);

    const reply = await interaction.editReply({
      content: `\u2705 Market created by <@${interaction.user.id}>`,
      embeds: [embed],
      components: [row],
    });

    // Store message ID for later updates
    await pool.query(
      'UPDATE markets SET message_id = $2 WHERE id = $1',
      [market.id, reply.id]
    );
  } catch (err) {
    console.error('Failed to create market:', err);
    await interaction.editReply('\u274c Failed to create market. Please try again.');
  }
}

module.exports = { handleModal };
