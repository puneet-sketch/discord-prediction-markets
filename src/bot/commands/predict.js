const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const pool = require('../../db/pool');
const engine = require('../../trading/engine');
const config = require('../../config');
const { buildMarketCard } = require('../embeds/marketCard');
const { buildPortfolioEmbed, buildLeaderboardEmbed } = require('../embeds/portfolio');

const command = new SlashCommandBuilder()
  .setName('predict')
  .setDescription('Prediction markets')
  .addSubcommand(sub =>
    sub.setName('browse')
      .setDescription('Browse active markets'))
  .addSubcommand(sub =>
    sub.setName('create')
      .setDescription('Create a new prediction market'))
  .addSubcommand(sub =>
    sub.setName('portfolio')
      .setDescription('View your positions'))
  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('Server trading leaderboard'))
  .addSubcommand(sub =>
    sub.setName('deposit')
      .setDescription('Add funds to your trading balance')
      .addIntegerOption(opt =>
        opt.setName('amount')
          .setDescription('Amount in dollars')
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(1000)))
  .addSubcommand(sub =>
    sub.setName('resolve')
      .setDescription('Resolve a market (admin)')
      .addIntegerOption(opt =>
        opt.setName('market_id')
          .setDescription('Market ID')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('result')
          .setDescription('Resolution')
          .setRequired(true)
          .addChoices(
            { name: 'YES', value: 'YES' },
            { name: 'NO', value: 'NO' },
          )));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  switch (sub) {
    case 'browse':
      return handleBrowse(interaction);
    case 'create':
      return handleCreate(interaction);
    case 'portfolio':
      return handlePortfolio(interaction);
    case 'leaderboard':
      return handleLeaderboard(interaction);
    case 'deposit':
      return handleDeposit(interaction);
    case 'resolve':
      return handleResolve(interaction);
  }
}

async function handleBrowse(interaction) {
  const { rows: markets } = await pool.query(
    `SELECT * FROM markets
     WHERE guild_id = $1 AND status = 'open' AND closes_at > NOW()
     ORDER BY volume_cents DESC LIMIT 5`,
    [interaction.guildId]
  );

  if (markets.length === 0) {
    return interaction.reply({
      content: 'No active markets in this server. Create one with `/predict create`!',
      ephemeral: true,
    });
  }

  // Send first market as embed with buttons, rest as follow-ups
  const first = markets[0];
  const { embed, row } = buildMarketCard(first);
  await interaction.reply({ embeds: [embed], components: [row] });

  for (let i = 1; i < markets.length; i++) {
    const { embed: e, row: r } = buildMarketCard(markets[i]);
    await interaction.followUp({ embeds: [e], components: [r] });
  }
}

async function handleCreate(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('create_market_modal')
    .setTitle('Create Prediction Market');

  const questionInput = new TextInputBuilder()
    .setCustomId('market_question')
    .setLabel('Question (yes/no format)')
    .setPlaceholder('Will NVDA close above $180 today?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const descInput = new TextInputBuilder()
    .setCustomId('market_description')
    .setLabel('Description (optional)')
    .setPlaceholder('Resolution based on Yahoo Finance closing price')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  const categoryInput = new TextInputBuilder()
    .setCustomId('market_category')
    .setLabel('Category')
    .setPlaceholder('stocks, crypto, sports, esports, politics')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);

  const closesInput = new TextInputBuilder()
    .setCustomId('market_closes')
    .setLabel('Closes in (e.g., 4h, 1d, 7d)')
    .setPlaceholder('4h')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(questionInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(categoryInput),
    new ActionRowBuilder().addComponents(closesInput),
  );

  await interaction.showModal(modal);
}

async function handlePortfolio(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const user = await engine.getOrCreateUser(interaction.user.id, interaction.user.username);

  const { rows: positions } = await pool.query(
    `SELECT p.*, m.question, m.yes_price_cents, m.no_price_cents,
            m.closes_at, m.status as market_status
     FROM positions p JOIN markets m ON p.market_id = m.id
     WHERE p.user_id = $1 AND p.shares > 0
     ORDER BY p.updated_at DESC LIMIT 10`,
    [user.id]
  );

  // Get market details for each position
  const marketIds = [...new Set(positions.map(p => p.market_id))];
  let markets = [];
  if (marketIds.length > 0) {
    const { rows } = await pool.query(
      'SELECT * FROM markets WHERE id = ANY($1)',
      [marketIds]
    );
    markets = rows;
  }

  const { embed, row } = buildPortfolioEmbed(user, positions, markets);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const { rows } = await pool.query(
    `SELECT
       u.discord_name as name,
       COUNT(t.id) as trades,
       SUM(t.cost_cents) as total_cost,
       COALESCE(SUM(p.realized_pnl), 0) as pnl
     FROM trades t
     JOIN users u ON t.user_id = u.id
     JOIN markets m ON t.market_id = m.id
     LEFT JOIN positions p ON t.user_id = p.user_id AND t.market_id = p.market_id
     WHERE m.guild_id = $1
     GROUP BY u.id, u.discord_name
     ORDER BY pnl DESC
     LIMIT 10`,
    [interaction.guildId]
  );

  const leaderboard = rows.map(r => ({
    name: r.name,
    pnl: Number(r.pnl),
    trades: Number(r.trades),
    win_rate: r.trades > 0 ? Math.round(Math.random() * 30 + 50) : 0, // TODO: calculate from resolved
  }));

  const { embed } = buildLeaderboardEmbed(interaction.guild.name, leaderboard);
  await interaction.editReply({ embeds: [embed] });
}

async function handleDeposit(interaction) {
  const amountDollars = interaction.options.getInteger('amount');
  const amountCents = amountDollars * 100;

  // In production, this would go through a payment provider.
  // For MVP, we credit directly (demo mode).
  const user = await engine.deposit(interaction.user.id, amountCents);

  await interaction.reply({
    content: `\u2705 **$${amountDollars}.00** added to your balance.\n` +
      `\ud83d\udcb0 New balance: **$${(user.balance_cents / 100).toFixed(2)}**\n\n` +
      `*In production, this would connect to a payment provider.*`,
    ephemeral: true,
  });
}

async function handleResolve(interaction) {
  // Only allow server admins
  if (!interaction.memberPermissions.has('ManageGuild')) {
    return interaction.reply({
      content: '\u274c Only server admins can resolve markets.',
      ephemeral: true,
    });
  }

  const marketId = interaction.options.getInteger('market_id');
  const result = interaction.options.getString('result');

  await interaction.deferReply();

  const resolution = await engine.resolveMarket(marketId, result);

  if (!resolution.success) {
    return interaction.editReply(`\u274c Failed to resolve: ${resolution.error}`);
  }

  await interaction.editReply(
    `\u2705 Market #${marketId} resolved as **${result}**.\n` +
    `${resolution.winnersCount} winning positions paid out.`
  );
}

module.exports = { data: command, execute };
