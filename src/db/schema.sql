-- Discord Prediction Markets — Database Schema
-- All statements use IF NOT EXISTS, safe to run on every boot.

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  discord_id      VARCHAR(32) UNIQUE NOT NULL,
  discord_name    VARCHAR(128),
  balance_cents   INTEGER NOT NULL DEFAULT 0,
  total_deposited INTEGER NOT NULL DEFAULT 0,
  total_withdrawn INTEGER NOT NULL DEFAULT 0,
  kyc_tier        SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS markets (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR(128) UNIQUE NOT NULL,
  question        TEXT NOT NULL,
  description     TEXT,
  category        VARCHAR(32) NOT NULL DEFAULT 'general',
  resolution_source TEXT,
  yes_shares      NUMERIC(16,4) NOT NULL DEFAULT 0,
  no_shares       NUMERIC(16,4) NOT NULL DEFAULT 0,
  liquidity_param NUMERIC(16,4) NOT NULL DEFAULT 100,
  yes_price_cents INTEGER NOT NULL DEFAULT 50,
  no_price_cents  INTEGER NOT NULL DEFAULT 50,
  volume_cents    BIGINT NOT NULL DEFAULT 0,
  trader_count    INTEGER NOT NULL DEFAULT 0,
  guild_id        VARCHAR(32) NOT NULL,
  channel_id      VARCHAR(32),
  creator_id      VARCHAR(32) NOT NULL,
  message_id      VARCHAR(32),
  status          VARCHAR(16) NOT NULL DEFAULT 'open',
  resolution      VARCHAR(8),
  closes_at       TIMESTAMPTZ NOT NULL,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_guild ON markets(guild_id);
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_closes ON markets(closes_at);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  market_id       INTEGER NOT NULL REFERENCES markets(id),
  side            VARCHAR(3) NOT NULL CHECK (side IN ('YES', 'NO')),
  quantity        NUMERIC(16,4) NOT NULL,
  limit_price     INTEGER NOT NULL,
  slippage        INTEGER NOT NULL DEFAULT 2,
  max_price       INTEGER NOT NULL,
  cost_cents      INTEGER NOT NULL,
  fill_price      INTEGER,
  filled_qty      NUMERIC(16,4) DEFAULT 0,
  status          VARCHAR(16) NOT NULL DEFAULT 'created',
  fill_type       VARCHAR(16) NOT NULL DEFAULT 'fill_or_kill',
  ttl_seconds     INTEGER NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filled_at       TIMESTAMPTZ,
  expired_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_market ON orders(market_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS positions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  market_id       INTEGER NOT NULL REFERENCES markets(id),
  side            VARCHAR(3) NOT NULL CHECK (side IN ('YES', 'NO')),
  shares          NUMERIC(16,4) NOT NULL DEFAULT 0,
  avg_price_cents INTEGER NOT NULL DEFAULT 0,
  total_cost      INTEGER NOT NULL DEFAULT 0,
  realized_pnl    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, market_id, side)
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);

CREATE TABLE IF NOT EXISTS trades (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id),
  market_id       INTEGER NOT NULL REFERENCES markets(id),
  user_id         INTEGER NOT NULL REFERENCES users(id),
  side            VARCHAR(3) NOT NULL,
  quantity        NUMERIC(16,4) NOT NULL,
  price_cents     INTEGER NOT NULL,
  cost_cents      INTEGER NOT NULL,
  fee_cents       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id);

CREATE TABLE IF NOT EXISTS fee_ledger (
  id              SERIAL PRIMARY KEY,
  trade_id        INTEGER NOT NULL REFERENCES trades(id),
  market_id       INTEGER NOT NULL REFERENCES markets(id),
  guild_id        VARCHAR(32) NOT NULL,
  total_fee       INTEGER NOT NULL,
  platform_share  INTEGER NOT NULL,
  server_share    INTEGER NOT NULL,
  creator_share   INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id              SERIAL PRIMARY KEY,
  market_id       INTEGER NOT NULL REFERENCES markets(id),
  yes_price_cents INTEGER NOT NULL,
  no_price_cents  INTEGER NOT NULL,
  volume_cents    BIGINT NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_snap_market ON price_snapshots(market_id, recorded_at);
