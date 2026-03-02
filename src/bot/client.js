const { Client, GatewayIntentBits, Events } = require('discord.js');
const config = require('../config');
const predict = require('./commands/predict');
const { handleButton } = require('./interactions/buttons');
const { handleModal } = require('./interactions/modals');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
});

// ── Command registry ──
const commands = new Map();
commands.set(predict.data.name, predict);

// ── Ready ──
client.once(Events.ClientReady, (c) => {
  console.log(`Discord bot logged in as ${c.user.tag}`);
  console.log(`Serving ${c.guilds.cache.size} servers`);
});

// ── Interaction handler ──
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (command) {
        await command.execute(interaction);
      }
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    // Modals
    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }
  } catch (err) {
    console.error('Interaction error:', err);

    const reply = {
      content: '\u274c Something went wrong. Please try again.',
      ephemeral: true,
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    } catch {
      // Interaction may have timed out
    }
  }
});

function startBot() {
  return client.login(config.discord.token);
}

module.exports = { client, startBot };
