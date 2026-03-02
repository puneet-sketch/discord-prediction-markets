require('dotenv').config();

const http = require('http');
const config = require('./config');
const pool = require('./db/pool');
const { app } = require('./api/server');
const priceFeed = require('./api/websocket');
const { startBot } = require('./bot/client');
const scheduler = require('./markets/scheduler');
const { startKeepAlive } = require('./api/keepalive');

// Migration SQL — runs on every boot (all IF NOT EXISTS, safe to re-run)
const SCHEMA = require('fs').readFileSync(
  require('path').join(__dirname, 'db', 'schema.sql'), 'utf8'
);

async function main() {
  console.log('=== Discord Prediction Markets ===');
  console.log(`Environment: ${config.server.env}`);

  // 1. Run database migrations
  console.log('\n[1/5] Running database migrations...');
  try {
    await pool.query(SCHEMA);
    console.log('  Migrations completed.');
  } catch (err) {
    console.error('  Migration failed:', err.message);
    console.log('  Continuing anyway (tables may already exist)...');
  }

  // 2. Start API server + WebSocket
  console.log('\n[2/5] Starting API server...');
  const httpServer = http.createServer(app);
  priceFeed.attach(httpServer);

  await new Promise((resolve) => {
    httpServer.listen(config.server.port, () => {
      console.log(`  API server on port ${config.server.port}`);
      console.log(`  WebSocket at /ws/prices`);
      resolve();
    });
  });

  // 3. Start Discord bot
  console.log('\n[3/5] Connecting Discord bot...');
  try {
    await startBot();
    console.log('  Discord bot connected.');
  } catch (err) {
    console.error('  Discord bot failed to connect:', err.message);
    console.log('  Set DISCORD_TOKEN to enable the bot.');
  }

  // 4. Start scheduler
  console.log('\n[4/5] Starting market scheduler...');
  scheduler.start();

  // 5. Start keep-alive (Render free tier anti-sleep)
  console.log('\n[5/5] Starting keep-alive...');
  startKeepAlive();

  console.log('\n=== All systems online ===\n');

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down...`);
    scheduler.stop();
    httpServer.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
