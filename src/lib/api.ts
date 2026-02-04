// API client for Klaude backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  (typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`
    : "ws://localhost:3001/ws");

// Types matching backend
export type RiskLevel = "safe" | "risky" | "danger" | "unknown";

export interface Token {
  id: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  source: "pumpfun" | "raydium" | "jupiter" | "unknown";
  createdAt: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
  risk: RiskLevel;
  riskReasons: string[];
  imageUrl?: string;
}

export interface Opportunity {
  id: string;
  token: Token;
  type: "new_launch" | "price_dip" | "volume_spike" | "breakout" | "arbitrage";
  score: number;
  reason: string;
  suggestedAction: "buy" | "watch" | "avoid";
  suggestedSize: number;
  expiresAt: string;
  createdAt: string;
}

export interface SafeConfig {
  id: string;
  walletAddress: string;
  maxTradeSize: number;
  dailyLimit: number;
  slippageCap: number;
  allowedTokens: string[];
  allowedDexes: string[];
  autonomousMode: "conservative" | "moderate" | "aggressive" | "degen";
  profitTaking?: {
    sellAt2x: number;
    sellAt5x: number;
    sellAt10x: number;
  };
  minLiquidity: number;
  minHolders: number;
  maxRisk: RiskLevel;
  isActive: boolean;
  isPaused: boolean;
}

export interface Position {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  quantity: number;
  avgEntryPrice: number;
  currentPrice: number;
  entryValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  openedAt: string;
}

export interface Portfolio {
  id: string;
  walletAddress: string;
  network: "mainnet-beta" | "devnet";
  solBalance: number;
  positions: Position[];
  totalDeposited: number;
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  bestTrade: number;
  rugsAvoided: number;
  dailySpent: number;
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

export interface Trade {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  value: number;
  pnl?: number;
  multiplier?: number;
  source: string;
  reason?: string;
  status: string;
  executedAt?: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  type: string;
  message: string;
  data?: Record<string, unknown>;
  createdAt: string;
}

// API client
class KlaudeAPI {
  private baseUrl: string;

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health
  async health(): Promise<{ status: string; timestamp: string }> {
    return this.fetch("/health");
  }

  // Tokens
  async getTokens(limit = 20, source?: string): Promise<{ tokens: Token[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (source) params.set("source", source);
    return this.fetch(`/tokens?${params}`);
  }

  async getOpportunities(): Promise<{ opportunities: Opportunity[] }> {
    return this.fetch("/opportunities");
  }

  // Config
  async getConfig(walletAddress: string): Promise<{ config: SafeConfig }> {
    return this.fetch(`/config/${walletAddress}`);
  }

  async saveConfig(config: Partial<SafeConfig> & { walletAddress: string }): Promise<{ config: SafeConfig }> {
    return this.fetch("/config", {
      method: "POST",
      body: JSON.stringify(config),
    });
  }

  async pauseTrading(walletAddress: string, paused: boolean): Promise<{ config: SafeConfig }> {
    return this.fetch(`/config/${walletAddress}/pause`, {
      method: "POST",
      body: JSON.stringify({ paused }),
    });
  }

  // Portfolio
  async getPortfolio(walletAddress: string, network = "devnet"): Promise<{ portfolio: Portfolio; stats: PortfolioStats }> {
    return this.fetch(`/portfolio/${walletAddress}?network=${network}`);
  }

  async getPortfolioStats(walletAddress: string, network = "devnet"): Promise<{ stats: PortfolioStats }> {
    return this.fetch(`/portfolio/${walletAddress}/stats?network=${network}`);
  }

  async resetPortfolio(walletAddress: string, network = "devnet"): Promise<{ portfolio: Portfolio }> {
    return this.fetch(`/portfolio/${walletAddress}/reset?network=${network}`, {
      method: "POST",
    });
  }

  // Trades
  async executeTrade(params: {
    walletAddress: string;
    tokenAddress: string;
    tokenSymbol: string;
    side: "buy" | "sell";
    amount: number;
    price: number;
    source?: string;
  }): Promise<{ success: boolean; trade?: Trade; error?: string }> {
    return this.fetch("/trade", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getTradeHistory(walletAddress: string, network = "devnet", limit = 50): Promise<{ trades: Trade[] }> {
    return this.fetch(`/trades/${walletAddress}?network=${network}&limit=${limit}`);
  }

  // Activity
  async getActivities(walletAddress: string, network = "devnet", limit = 50): Promise<{ activities: Activity[] }> {
    return this.fetch(`/activity/${walletAddress}?network=${network}&limit=${limit}`);
  }

  // AI Trader
  async startAITrader(walletAddress: string, openaiKey?: string): Promise<{ success: boolean; message: string }> {
    return this.fetch("/ai-trader/start", {
      method: "POST",
      body: JSON.stringify({ walletAddress, openaiKey }),
    });
  }

  async stopAITrader(): Promise<{ success: boolean }> {
    return this.fetch("/ai-trader/stop", { method: "POST" });
  }

  async getAITraderStats(): Promise<{ stats: { isRunning: boolean; dailySpent: number; positionCount: number } }> {
    return this.fetch("/ai-trader/stats");
  }
}

// WebSocket client
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
  timestamp: string;
}

type WSCallback = (message: WSMessage) => void;

class KlaudeWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private callbacks: Map<WSMessageType | "all", Set<WSCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string = WS_URL) {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.emit(message);
        } catch (error) {
          console.error("[WS] Parse error:", error);
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("[WS] Error:", error);
      };
    } catch (error) {
      console.error("[WS] Connection error:", error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("[WS] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[WS] Reconnecting in ${delay}ms...`);

    setTimeout(() => this.connect(), delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(walletAddress: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", walletAddress }));
    }
  }

  on(type: WSMessageType | "all", callback: WSCallback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, new Set());
    }
    this.callbacks.get(type)!.add(callback);
  }

  off(type: WSMessageType | "all", callback: WSCallback) {
    this.callbacks.get(type)?.delete(callback);
  }

  private emit(message: WSMessage) {
    // Call type-specific callbacks
    this.callbacks.get(message.type)?.forEach((cb) => cb(message));
    // Call "all" callbacks
    this.callbacks.get("all")?.forEach((cb) => cb(message));
  }
}

// Singleton instances
export const api = new KlaudeAPI();
export const ws = new KlaudeWebSocket();
