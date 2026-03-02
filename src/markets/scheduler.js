const pool = require('../db/pool');

/**
 * Periodically close expired markets and clean up stale orders.
 * Runs every 60 seconds.
 */
class MarketScheduler {
  constructor() {
    this.interval = null;
  }

  start() {
    // Run immediately, then every 60s
    this.tick();
    this.interval = setInterval(() => this.tick(), 60_000);
    console.log('Market scheduler started (60s interval)');
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async tick() {
    try {
      // Close expired markets that haven't been resolved yet
      const { rowCount } = await pool.query(
        `UPDATE markets
         SET status = 'closed', updated_at = NOW()
         WHERE status = 'open' AND closes_at <= NOW()`
      );
      if (rowCount > 0) {
        console.log(`Closed ${rowCount} expired market(s)`);
      }

      // Expire old pending orders (shouldn't happen with AMM, but safety net)
      await pool.query(
        `UPDATE orders
         SET status = 'expired', expired_at = NOW()
         WHERE status IN ('created', 'submitted')
           AND created_at < NOW() - INTERVAL '1 minute'`
      );
    } catch (err) {
      console.error('Scheduler tick error:', err);
    }
  }
}

module.exports = new MarketScheduler();
