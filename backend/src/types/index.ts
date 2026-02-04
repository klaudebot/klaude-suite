// Network types
export type Network = "mainnet-beta" | "devnet";

// Risk levels for tokens
export type RiskLevel = "safe" | "risky" | "danger" | "unknown";

// Token discovered from DEX scanning
export interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  source: "pumpfun" | "raydium" | "jupiter" | "unknown";
  createdAt: Date;
  // Market data
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  // Risk assessment
  risk: RiskLevel;
  riskReasons: string[];
  // Metadata
  imageUrl?: string;
  website?: string;
  twitter?: string;
}

// User's Safe configuration
export interface SafeConfig {
  id: string;
  walletAddress: string;
  // Limits
  maxTradeSize: number; // in SOL
  dailyLimit: number; // in SOL
  slippageCap: number; // percentage
  // Allowed assets
  allowedTokens: string[]; // "ALL" or specific symbols
  allowedDexes: string[];
  // Trading style
  autonomousMode: "conservative" | "moderate" | "aggressive" | "degen";
  // Profit taking (for degen mode)
  profitTaking?: {
    sellAt2x: number;
    sellAt5x: number;
    sellAt10x: number;
  };
  // Risk filters
  minLiquidity: number;
  minHolders: number;
  maxRisk: RiskLevel;
  // Status
  isActive: boolean;
  isPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Paper trading portfolio
export interface Portfolio {
  id: string;
  walletAddress: string;
  network: Network;
  // Balances
  solBalance: number;
  positions: Position[];
  // Stats
  totalDeposited: number;
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  bestTrade: number; // multiplier
  rugsAvoided: number;
  // Limits tracking
  dailySpent: number;
  dailySpentReset: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Single position in portfolio
export interface Position {
  id: string;
  portfolioId: string;
  tokenAddress: string;
  tokenSymbol: string;
  // Position data
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  entryValue: number; // in SOL
  currentValue: number; // in SOL
  pnl: number;
  pnlPercent: number;
  // Tracking
  openedAt: Date;
  updatedAt: Date;
}

// Trade record
export interface Trade {
  id: string;
  portfolioId: string;
  tokenAddress: string;
  tokenSymbol: string;
  // Trade details
  side: "buy" | "sell";
  quantity: number;
  price: number;
  value: number; // in SOL
  // For sells
  pnl?: number;
  multiplier?: number;
  // Execution
  source: "manual" | "auto" | "dca" | "profit-take" | "stop-loss";
  reason?: string;
  // Status
  status: "pending" | "executed" | "failed";
  executedAt?: Date;
  createdAt: Date;
}

// Opportunity detected by scanner
export interface Opportunity {
  id: string;
  token: Token;
  type: "new_launch" | "price_dip" | "volume_spike" | "breakout" | "arbitrage";
  score: number; // 0-100
  reason: string;
  suggestedAction: "buy" | "watch" | "avoid";
  suggestedSize: number; // in SOL
  expiresAt: Date;
  createdAt: Date;
}

// Activity log entry
export interface Activity {
  id: string;
  portfolioId?: string;
  type: "trade" | "scan" | "blocked" | "learning" | "alert" | "launch" | "snipe" | "exit" | "rug";
  message: string;
  data?: Record<string, unknown>;
  createdAt: Date;
}

// WebSocket message types
export type WSMessageType =
  | "token_discovered"
  | "opportunity_found"
  | "trade_executed"
  | "position_updated"
  | "activity"
  | "price_update"
  | "error";

export interface WSMessage {
  type: WSMessageType;
  data: unknown;
  timestamp: Date;
}

// API request/response types
export interface CreateConfigRequest {
  walletAddress: string;
  maxTradeSize: number;
  dailyLimit: number;
  slippageCap: number;
  allowedTokens: string[];
  allowedDexes: string[];
  autonomousMode: SafeConfig["autonomousMode"];
  profitTaking?: SafeConfig["profitTaking"];
  minLiquidity?: number;
  minHolders?: number;
  maxRisk?: RiskLevel;
}

export interface ExecuteTradeRequest {
  walletAddress: string;
  tokenAddress: string;
  side: "buy" | "sell";
  amount: number; // in SOL for buys, in token quantity for sells
  source?: Trade["source"];
}

export interface PortfolioStats {
  totalValue: number;
  solBalance: number;
  positionsValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailySpent: number;
  dailyRemaining: number;
  positionCount: number;
  winRate: number;
  bestTrade: number;
  rugsAvoided: number;
}
