const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.db.url,
  // Neon requires SSL; rejectUnauthorized: false for free tier certs
  ssl: config.server.env === 'production' ? { rejectUnauthorized: false } : false,
  max: 5, // Neon free tier has limited connections
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL error:', err);
});

module.exports = pool;
