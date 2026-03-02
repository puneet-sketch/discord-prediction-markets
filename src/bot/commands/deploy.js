/**
 * Deploy slash commands to Discord.
 * Run: node src/bot/commands/deploy.js
 */
const { REST, Routes } = require('discord.js');
const config = require('../../config');
const predict = require('./predict');

const commands = [predict.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log(`Deploying ${commands.length} slash commands...`);

    await rest.put(
      Routes.applicationCommands(config.discord.clientId),
      { body: commands }
    );

    console.log('Slash commands deployed successfully.');
  } catch (err) {
    console.error('Failed to deploy commands:', err);
    process.exit(1);
  }
})();
