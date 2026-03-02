const path = require('path');
const express = require('express');
const pool = require('../db/pool');
const config = require('../config');

const app = express();
app.use(express.json());

// ── Serve interactive prototype at /prototype ──
app.use('/prototype', express.static(path.join(__dirname, '../../prototype')));
app.get('/', (req, res) => res.redirect('/prototype'));

// ── Health check (Render uses this) ──
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime: process.uptime() });
  } catch {
    res.status(500).json({ status: 'error', message: 'Database unreachable' });
  }
});

// ── Public API: List markets for a guild ──
app.get('/api/markets/:guildId', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, slug, question, category, yes_price_cents, no_price_cents,
            volume_cents, trader_count, status, closes_at, created_at
     FROM markets
     WHERE guild_id = $1 AND status = 'open' AND closes_at > NOW()
     ORDER BY volume_cents DESC LIMIT 20`,
    [req.params.guildId]
  );
  res.json({ markets: rows });
});

// ── Public API: Market detail ──
app.get('/api/markets/:guildId/:marketId', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM markets WHERE id = $1 AND guild_id = $2',
    [req.params.marketId, req.params.guildId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json({ market: rows[0] });
});

// ── Public API: Price history for charts ──
app.get('/api/markets/:guildId/:marketId/prices', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT yes_price_cents, no_price_cents, volume_cents, recorded_at
     FROM price_snapshots
     WHERE market_id = $1
     ORDER BY recorded_at ASC LIMIT 500`,
    [req.params.marketId]
  );
  res.json({ prices: rows });
});

// ── Public API: Server dashboard stats ──
app.get('/api/dashboard/:guildId', async (req, res) => {
  const guildId = req.params.guildId;

  const [volumeRes, tradersRes, marketsRes, feesRes] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(volume_cents), 0) as total_volume
       FROM markets WHERE guild_id = $1`,
      [guildId]
    ),
    pool.query(
      `SELECT COUNT(DISTINCT t.user_id) as active_traders
       FROM trades t JOIN markets m ON t.market_id = m.id
       WHERE m.guild_id = $1 AND t.created_at > NOW() - INTERVAL '30 days'`,
      [guildId]
    ),
    pool.query(
      `SELECT COUNT(*) as total_markets
       FROM markets WHERE guild_id = $1`,
      [guildId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(server_share), 0) as server_revenue,
              COALESCE(SUM(total_fee), 0) as total_fees
       FROM fee_ledger
       WHERE guild_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [guildId]
    ),
  ]);

  res.json({
    dashboard: {
      totalVolumeCents: Number(volumeRes.rows[0].total_volume),
      activeTraders: Number(tradersRes.rows[0].active_traders),
      totalMarkets: Number(marketsRes.rows[0].total_markets),
      serverRevenueCents: Number(feesRes.rows[0].server_revenue),
      totalFeesCents: Number(feesRes.rows[0].total_fees),
    },
  });
});

function startServer() {
  return new Promise((resolve) => {
    app.listen(config.server.port, () => {
      console.log(`API server listening on port ${config.server.port}`);
      resolve();
    });
  });
}

module.exports = { app, startServer };
