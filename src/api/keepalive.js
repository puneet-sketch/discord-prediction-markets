/**
 * Self-ping keep-alive for Render free tier.
 *
 * Render spins down free web services after 15 minutes of no inbound
 * HTTP traffic. This kills the Discord bot's WebSocket connection.
 *
 * Solution: ping our own /health endpoint every 14 minutes.
 * Render sets RENDER_EXTERNAL_URL automatically on deploy.
 */

const https = require('https');
const http = require('http');

const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;

  if (!url) {
    console.log('  RENDER_EXTERNAL_URL not set — keep-alive disabled (local dev)');
    return;
  }

  const healthUrl = `${url}/health`;
  console.log(`  Keep-alive pinging ${healthUrl} every 14 min`);

  const ping = () => {
    const client = healthUrl.startsWith('https') ? https : http;
    client.get(healthUrl, (res) => {
      // Drain response so the socket closes
      res.resume();
    }).on('error', (err) => {
      console.warn('Keep-alive ping failed:', err.message);
    });
  };

  // First ping after 14 min, then repeat
  setInterval(ping, INTERVAL_MS);
}

module.exports = { startKeepAlive };
