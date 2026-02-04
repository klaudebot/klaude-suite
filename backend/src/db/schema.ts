import Database, { Database as DatabaseType } from "better-sqlite3";
import path from "path";
import os from "os";

const dbPath = process.env.DATABASE_PATH || path.join(os.homedir(), ".klaude", "klaude.db");

// Ensure data directory exists
import fs from "fs";
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Initialize schema
export function initializeDatabase() {
  db.exec(`
    -- Safe configurations
    CREATE TABLE IF NOT EXISTS configs (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      max_trade_size REAL NOT NULL DEFAULT 0.5,
      daily_limit REAL NOT NULL DEFAULT 10.0,
      slippage_cap REAL NOT NULL DEFAULT 1.0,
      allowed_tokens TEXT NOT NULL DEFAULT '["SOL","USDC"]',
      allowed_dexes TEXT NOT NULL DEFAULT '["jupiter","raydium"]',
      autonomous_mode TEXT NOT NULL DEFAULT 'moderate',
      profit_taking TEXT,
      min_liquidity REAL NOT NULL DEFAULT 10.0,
      min_holders INTEGER NOT NULL DEFAULT 50,
      max_risk TEXT NOT NULL DEFAULT 'risky',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_paused INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Paper trading portfolios
    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      network TEXT NOT NULL DEFAULT 'devnet',
      sol_balance REAL NOT NULL DEFAULT 10.0,
      total_deposited REAL NOT NULL DEFAULT 10.0,
      total_pnl REAL NOT NULL DEFAULT 0.0,
      total_trades INTEGER NOT NULL DEFAULT 0,
      win_rate REAL NOT NULL DEFAULT 0.0,
      best_trade REAL NOT NULL DEFAULT 0.0,
      rugs_avoided INTEGER NOT NULL DEFAULT 0,
      daily_spent REAL NOT NULL DEFAULT 0.0,
      daily_spent_reset TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Positions (open trades)
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      token_address TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      quantity REAL NOT NULL,
      avg_entry_price REAL NOT NULL,
      current_price REAL NOT NULL,
      entry_value REAL NOT NULL,
      current_value REAL NOT NULL,
      pnl REAL NOT NULL DEFAULT 0.0,
      pnl_percent REAL NOT NULL DEFAULT 0.0,
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id),
      UNIQUE(portfolio_id, token_address)
    );

    -- Trade history
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      token_address TEXT NOT NULL,
      token_symbol TEXT NOT NULL,
      side TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      value REAL NOT NULL,
      pnl REAL,
      multiplier REAL,
      source TEXT NOT NULL DEFAULT 'manual',
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'executed',
      executed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
    );

    -- Discovered tokens cache
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY,
      address TEXT UNIQUE NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      decimals INTEGER NOT NULL DEFAULT 9,
      source TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0.0,
      price_change_24h REAL NOT NULL DEFAULT 0.0,
      market_cap REAL NOT NULL DEFAULT 0.0,
      volume_24h REAL NOT NULL DEFAULT 0.0,
      liquidity REAL NOT NULL DEFAULT 0.0,
      holders INTEGER NOT NULL DEFAULT 0,
      risk TEXT NOT NULL DEFAULT 'unknown',
      risk_reasons TEXT NOT NULL DEFAULT '[]',
      image_url TEXT,
      website TEXT,
      twitter TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Activity log
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
    );

    -- Opportunities (short-lived, for real-time trading decisions)
    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      token_address TEXT NOT NULL,
      type TEXT NOT NULL,
      score INTEGER NOT NULL,
      reason TEXT NOT NULL,
      suggested_action TEXT NOT NULL,
      suggested_size REAL NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (token_address) REFERENCES tokens(address)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_trades_portfolio ON trades(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at);
    CREATE INDEX IF NOT EXISTS idx_tokens_source ON tokens(source);
    CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at);
    CREATE INDEX IF NOT EXISTS idx_activities_portfolio ON activities(portfolio_id);
    CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
    CREATE INDEX IF NOT EXISTS idx_opportunities_expires ON opportunities(expires_at);
  `);

  console.log("Database initialized successfully");
}

// Helper to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}
