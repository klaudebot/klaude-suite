import OpenAI from "openai";
import { EventEmitter } from "events";
import type { Token, Opportunity, RiskLevel } from "../types/index.js";
import { paperTrading } from "./paper-trading.js";
import { db, generateId } from "../db/schema.js";
import { pumpPortal, type PumpTokenData } from "./pumpportal.js";

interface TradeDecision {
  action: "buy" | "watch" | "skip";
  confidence: number;
  reasoning: string;
  size?: number;
}

interface Position {
  tokenAddress: string;
  tokenSymbol: string;
  entryPrice: number;
  quantity: number;
  entryTime: Date;
}

export class AITrader extends EventEmitter {
  private openai: OpenAI | null = null;
  private isRunning = false;
  private walletAddress: string = "";
  private positions: Map<string, Position> = new Map();
  private seenTokens: Map<string, number> = new Map(); // address -> timestamp
  private dailySpent = 0;
  private dailyLimit = 10; // SOL - match portfolio balance
  private maxTradeSize = 0.5; // SOL
  private profitTargets = { at2x: 0.25, at5x: 0.5, at10x: 1.0 };
  private checkInterval: NodeJS.Timeout | null = null;
  private lastTradeTime = 0;

  constructor() {
    super();
  }

  async initialize(walletAddress: string, openaiKey?: string) {
    this.walletAddress = walletAddress;

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
      console.log("[AITrader] OpenAI initialized");
    } else if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log("[AITrader] OpenAI initialized from env");
    } else {
      console.log("[AITrader] No OpenAI key - using rule-based trading");
    }

    // Load config from DB
    await this.loadConfig();
  }

  private async loadConfig() {
    try {
      // Load config
      let config = db
        .prepare("SELECT * FROM configs WHERE wallet_address = ?")
        .get(this.walletAddress) as any;

      // Create config if it doesn't exist
      if (!config) {
        const configId = generateId();
        db.prepare(`
          INSERT INTO configs (id, wallet_address, daily_limit, max_trade_size, profit_taking)
          VALUES (?, ?, 10.0, 0.5, ?)
        `).run(configId, this.walletAddress, JSON.stringify({ sellAt2x: 25, sellAt5x: 50, sellAt10x: 100 }));

        config = db
          .prepare("SELECT * FROM configs WHERE wallet_address = ?")
          .get(this.walletAddress) as any;
        console.log(`[AITrader] Created config for ${this.walletAddress}`);
      }

      if (config) {
        this.dailyLimit = config.daily_limit || 10;
        this.maxTradeSize = config.max_trade_size || 0.5;
        if (config.profit_taking) {
          const pt = JSON.parse(config.profit_taking);
          this.profitTargets = {
            at2x: pt.sellAt2x / 100,
            at5x: pt.sellAt5x / 100,
            at10x: pt.sellAt10x / 100,
          };
        }
      }

      // Load daily spent from portfolio
      const portfolio = db
        .prepare("SELECT daily_spent, daily_spent_reset FROM portfolios WHERE wallet_address = ?")
        .get(this.walletAddress) as any;

      if (portfolio) {
        // Check if it's a new day
        const resetDate = new Date(portfolio.daily_spent_reset);
        const now = new Date();
        if (now.toDateString() !== resetDate.toDateString()) {
          this.dailySpent = 0;
        } else {
          this.dailySpent = portfolio.daily_spent || 0;
        }
        console.log(`[AITrader] Loaded daily spent: ${this.dailySpent.toFixed(2)}/${this.dailyLimit} SOL`);
      }

      // Load existing positions
      const positions = db
        .prepare(`
          SELECT p.* FROM positions p
          JOIN portfolios pf ON p.portfolio_id = pf.id
          WHERE pf.wallet_address = ?
        `)
        .all(this.walletAddress) as any[];

      for (const pos of positions) {
        this.positions.set(pos.token_address, {
          tokenAddress: pos.token_address,
          tokenSymbol: pos.token_symbol,
          entryPrice: pos.avg_entry_price,
          quantity: pos.quantity,
          entryTime: new Date(pos.opened_at),
        });
      }
      console.log(`[AITrader] Loaded ${this.positions.size} existing positions`);

    } catch (e) {
      console.error("[AITrader] Config load error:", e);
    }
  }

  start() {
    if (this.isRunning) {
      console.log("[AITrader] Already running");
      return;
    }
    this.isRunning = true;
    console.log(`[AITrader] ====== STARTING AUTONOMOUS TRADING ======`);
    console.log(`[AITrader] Wallet: ${this.walletAddress}`);
    console.log(`[AITrader] Daily limit: ${this.dailyLimit} SOL`);
    console.log(`[AITrader] Daily spent: ${this.dailySpent} SOL`);
    console.log(`[AITrader] Remaining allowance: ${this.dailyLimit - this.dailySpent} SOL`);
    console.log(`[AITrader] Active positions: ${this.positions.size}`);
    console.log(`[AITrader] ==========================================`);

    // Check positions for profit-taking every 10 seconds
    this.checkInterval = setInterval(() => this.checkPositions(), 10000);

    // Listen for price updates from PumpPortal
    pumpPortal.on("tokenData", (data: PumpTokenData) => {
      this.handlePriceUpdate(data);
    });

    this.emit("activity", {
      type: "scan",
      message: "AI Trader activated - scanning for opportunities...",
    });
  }

  private handlePriceUpdate(data: PumpTokenData) {
    // Update token price in DB if we have a position
    if (this.positions.has(data.mint) && data.price > 0) {
      db.prepare("UPDATE tokens SET price = ?, updated_at = ? WHERE address = ?")
        .run(data.price, new Date().toISOString(), data.mint);

      const position = this.positions.get(data.mint)!;
      const multiplier = data.price / position.entryPrice;
      console.log(`[AITrader] Price update: ${position.tokenSymbol} now at ${multiplier.toFixed(2)}x`);
    }
  }

  stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("[AITrader] Stopped");
  }

  resetDaily() {
    this.dailySpent = 0;
    this.positions.clear();
    this.seenTokens.clear();
    console.log(`[AITrader] Daily state reset - ${this.dailyLimit} SOL allowance available`);
  }

  async evaluateToken(token: Token): Promise<TradeDecision> {
    // Skip if not running or already at daily limit
    if (!this.isRunning) {
      return { action: "skip", confidence: 0, reasoning: "Trader not active" };
    }

    if (this.dailySpent >= this.dailyLimit) {
      // Only log this once per minute to avoid spam
      return { action: "skip", confidence: 0, reasoning: "_dailylimit" };
    }

    // Skip if we already have a position
    if (this.positions.has(token.address)) {
      return { action: "skip", confidence: 0, reasoning: "Already holding" };
    }

    // Skip tokens with empty/weird symbols (keep alphanumeric only)
    const cleanSymbol = token.symbol.replace(/[$\s]/g, "").trim();
    if (cleanSymbol.length < 2 || !/^[a-zA-Z0-9]+$/.test(cleanSymbol)) {
      return { action: "skip", confidence: 0, reasoning: "_invalid" };
    }

    // Rate limit - max 1 trade per 15 seconds (silent skip)
    const lastTradeTime = this.lastTradeTime || 0;
    if (Date.now() - lastTradeTime < 15000) {
      return { action: "skip", confidence: 0, reasoning: "_ratelimit" }; // Silent
    }

    // Use AI if available, otherwise rule-based
    if (this.openai) {
      return await this.aiDecision(token);
    } else {
      return this.ruleBasedDecision(token);
    }
  }

  private async aiDecision(token: Token): Promise<TradeDecision> {
    try {
      const ageSeconds = Math.round((Date.now() - new Date(token.createdAt).getTime()) / 1000);

      const prompt = `You are a DEGEN shitcoin sniper on Solana. Your job is to APE INTO new tokens FAST.

THIS IS MEMECOIN TRADING - tokens launch with 0 holders and 0 liquidity. That's NORMAL. You buy BEFORE others do.

TOKEN:
- Symbol: ${token.symbol}
- Name: ${token.name}
- Age: ${ageSeconds} seconds old
- Holders: ${token.holders}
- Liquidity: ${token.liquidity} SOL

DEGEN RULES:
1. If token is <60 seconds old with a memeable/funny name → BUY IT (0.1 SOL)
2. If token is 1-5 minutes old → still consider buying
3. Only skip if: name is boring/scammy OR token is >10 min old
4. Zero holders/liquidity is EXPECTED for new tokens - don't skip for this reason
5. We have auto-exits at 2x, 5x, 10x - the goal is to catch pumps early

This is paper trading. Be AGGRESSIVE. We learn by doing.

Respond JSON only:
{
  "action": "buy" | "skip",
  "confidence": 50-95,
  "reasoning": "one short sentence",
  "size": 0.1
}`;

      const response = await this.openai!.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const decision = JSON.parse(content);

      return {
        action: decision.action || "skip",
        confidence: decision.confidence || 0,
        reasoning: decision.reasoning || "No reasoning provided",
        size: decision.size ? Math.min(decision.size, this.maxTradeSize) : undefined,
      };
    } catch (error: any) {
      console.error("[AITrader] AI decision error:", error.message);
      // Fallback to rule-based
      return this.ruleBasedDecision(token);
    }
  }

  private ruleBasedDecision(token: Token): TradeDecision {
    let score = 50; // Start at baseline for degen mode
    const reasons: string[] = [];

    // Age scoring - super fresh is good for degen
    const ageMinutes = (Date.now() - new Date(token.createdAt).getTime()) / 60000;
    if (ageMinutes < 1) {
      score += 25;
      reasons.push("just launched");
    } else if (ageMinutes <= 3) {
      score += 20;
      reasons.push("very fresh");
    } else if (ageMinutes <= 10) {
      score += 10;
      reasons.push("still early");
    } else if (ageMinutes > 60) {
      score -= 30;
      reasons.push("too old");
    }

    // Liquidity scoring - more lenient for new tokens
    if (token.liquidity >= 20) {
      score += 20;
      reasons.push("strong liq");
    } else if (token.liquidity >= 5) {
      score += 10;
      reasons.push("has liquidity");
    } else if (token.liquidity > 0) {
      // Small liquidity is ok for brand new tokens
      score += 5;
    }
    // No penalty for 0 liquidity on new tokens - they start at 0

    // Holder scoring - lenient for brand new
    if (token.holders >= 50) {
      score += 15;
      reasons.push("growing community");
    } else if (token.holders >= 10) {
      score += 5;
    }
    // No penalty for few holders on new tokens

    // Risk scoring - ignore for degen mode
    if (token.risk === "safe") {
      score += 10;
    }
    // Don't penalize danger in degen mode

    // Momentum
    if (token.priceChange24h > 100) {
      score += 15;
      reasons.push("pumping");
    } else if (token.priceChange24h > 20) {
      score += 5;
    }

    // Random factor for variety (5-15% chance boost)
    if (Math.random() < 0.10) {
      score += 20;
      reasons.push("YOLO");
    }

    // Decision thresholds - lower for degen
    if (score >= 60) {
      const size = score >= 80 ? 0.15 : 0.1;
      return {
        action: "buy",
        confidence: Math.min(score, 95),
        reasoning: reasons.slice(0, 3).join(", ") || "looks promising",
        size: Math.min(size, this.maxTradeSize),
      };
    } else if (score >= 40) {
      return {
        action: "watch",
        confidence: score,
        reasoning: reasons.slice(0, 3).join(", ") || "monitoring",
      };
    } else {
      return {
        action: "skip",
        confidence: Math.abs(score),
        reasoning: reasons.slice(0, 3).join(", ") || "doesn't meet criteria",
      };
    }
  }

  async handleNewToken(token: Token) {
    if (!this.isRunning) return;

    // Skip if we've already seen this token (by address)
    if (this.seenTokens.has(token.address)) {
      return;
    }

    // Mark as seen (cache for 10 minutes)
    this.seenTokens.set(token.address, Date.now());

    // Cleanup old entries (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [addr, timestamp] of this.seenTokens) {
      if (timestamp < tenMinutesAgo) {
        this.seenTokens.delete(addr);
      }
    }

    const decision = await this.evaluateToken(token);

    // Silent skip for rate limit and daily limit
    if (decision.reasoning.startsWith("_")) {
      return;
    }

    // Log all decisions so we can see activity
    console.log(`[AITrader] ${token.symbol}: ${decision.action} (${decision.confidence}%) - ${decision.reasoning}`);

    if (decision.action === "buy" && decision.size) {
      await this.executeBuy(token, decision);
    } else if (decision.action === "watch" && decision.confidence >= 40) {
      // Only show watch for promising tokens
      this.emit("activity", {
        type: "alert",
        message: `Watching ${token.symbol} - ${decision.reasoning}`,
      });
    }
    // Skip notifications are silent
  }

  private async executeBuy(token: Token, decision: TradeDecision) {
    if (!this.walletAddress) {
      console.log("[AITrader] No wallet address set, skipping buy");
      return;
    }

    if (!decision.size) {
      console.log("[AITrader] No size in decision, skipping buy");
      return;
    }

    if (this.dailySpent + decision.size > this.dailyLimit) {
      console.log(`[AITrader] Daily limit would be exceeded (${this.dailySpent} + ${decision.size} > ${this.dailyLimit})`);
      return;
    }

    try {
      const result = await paperTrading.executeTrade(
        this.walletAddress,
        token.address,
        token.symbol,
        "buy",
        decision.size,
        token.price || 0.00001,
        "auto",
        `AI: ${decision.reasoning}`
      );

      if (result.success && result.trade) {
        this.dailySpent += decision.size;
        this.lastTradeTime = Date.now();

        // Track position
        this.positions.set(token.address, {
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          entryPrice: token.price || 0.00001,
          quantity: result.trade.quantity,
          entryTime: new Date(),
        });

        // Subscribe to price updates for this token
        pumpPortal.subscribeToTokens([token.address]).catch(() => {});

        console.log(`[AITrader] Bought ${token.symbol} for ${decision.size} SOL`);

        this.emit("activity", {
          type: "snipe",
          message: `Sniped ${token.symbol} for ${decision.size} SOL (${decision.confidence}% confidence)`,
          amount: decision.size,
        });

        this.emit("trade", {
          type: "buy",
          token,
          amount: decision.size,
          trade: result.trade,
        });
      }
    } catch (error: any) {
      console.error(`[AITrader] Buy failed:`, error.message);
    }
  }

  private async checkPositions() {
    if (!this.isRunning || this.positions.size === 0) return;

    console.log(`[AITrader] Checking ${this.positions.size} positions...`);

    for (const [address, position] of this.positions) {
      try {
        // Get current price from DB
        const token = db
          .prepare("SELECT * FROM tokens WHERE address = ?")
          .get(address) as any;

        if (!token) continue;

        // Use actual token price from scanner (no fake simulation)
        const currentPrice = token.price > 0 ? token.price : position.entryPrice;

        // Check for dead positions (no price movement after 5 minutes)
        const ageMinutes = (Date.now() - position.entryTime.getTime()) / 60000;
        const hasNoPriceData = !token.price || token.price === position.entryPrice;

        if (ageMinutes > 5 && hasNoPriceData) {
          // Dead token - sell at 50% loss to clean up
          console.log(`[AITrader] Dead token: ${position.tokenSymbol} (${ageMinutes.toFixed(0)}m old, no price data)`);
          const lossPrice = position.entryPrice * 0.5;
          await this.executeSell(position, 1.0, 0.5, lossPrice, true);

          this.emit("activity", {
            type: "rug",
            message: `Dumped dead token ${position.tokenSymbol} (-50% assumed loss)`,
          });
          continue;
        }
        const multiplier = currentPrice / position.entryPrice;
        const pnl = (currentPrice - position.entryPrice) * position.quantity;
        const pnlPercent = (multiplier - 1) * 100;

        // Update position in paper trading DB
        db.prepare(`
          UPDATE positions
          SET current_price = ?, current_value = ?, pnl = ?, pnl_percent = ?, updated_at = ?
          WHERE token_address = ? AND portfolio_id = (
            SELECT id FROM portfolios WHERE wallet_address = ?
          )
        `).run(
          currentPrice,
          currentPrice * position.quantity,
          pnl,
          pnlPercent,
          new Date().toISOString(),
          address,
          this.walletAddress
        );

        // Broadcast position update
        this.emit("position_update", {
          tokenAddress: address,
          tokenSymbol: position.tokenSymbol,
          multiplier,
          pnl,
          pnlPercent,
        });

        // Check profit targets
        if (multiplier >= 10 && this.profitTargets.at10x > 0) {
          await this.executeSell(position, this.profitTargets.at10x, multiplier, currentPrice);
        } else if (multiplier >= 5 && this.profitTargets.at5x > 0) {
          await this.executeSell(position, this.profitTargets.at5x, multiplier, currentPrice);
        } else if (multiplier >= 2 && this.profitTargets.at2x > 0) {
          await this.executeSell(position, this.profitTargets.at2x, multiplier, currentPrice);
        }

        // Stop loss at -50%
        if (multiplier <= 0.5) {
          await this.executeSell(position, 1.0, multiplier, currentPrice, true);
        }
      } catch (error: any) {
        console.error(`[AITrader] Position check error:`, error.message);
      }
    }
  }

  private async executeSell(
    position: Position,
    sellPercent: number,
    multiplier: number,
    currentPrice: number,
    isStopLoss = false
  ) {
    const sellQuantity = position.quantity * sellPercent;

    try {
      const result = await paperTrading.executeTrade(
        this.walletAddress,
        position.tokenAddress,
        position.tokenSymbol,
        "sell",
        sellQuantity,
        currentPrice,
        isStopLoss ? "stop-loss" : "profit-take",
        `${multiplier.toFixed(1)}x exit`
      );

      if (result.success) {
        // Update position
        position.quantity -= sellQuantity;
        if (position.quantity <= 0) {
          this.positions.delete(position.tokenAddress);
        }

        const pnl = (currentPrice - position.entryPrice) * sellQuantity;
        const emoji = isStopLoss ? "🛑" : "💰";
        const action = isStopLoss ? "Stop loss" : `Sold ${Math.round(sellPercent * 100)}%`;

        console.log(`[AITrader] ${action} ${position.tokenSymbol} at ${multiplier.toFixed(1)}x`);

        this.emit("activity", {
          type: isStopLoss ? "blocked" : "exit",
          message: `${emoji} ${action} ${position.tokenSymbol} at ${multiplier.toFixed(1)}x`,
          profit: pnl,
          multiplier: `${multiplier.toFixed(1)}x`,
        });
      }
    } catch (error: any) {
      console.error(`[AITrader] Sell failed:`, error.message);
    }
  }

  async handleOpportunity(opportunity: Opportunity) {
    if (!this.isRunning) return;

    // Opportunities are already pre-filtered, so be more aggressive
    if (opportunity.suggestedAction === "buy" && opportunity.score >= 60) {
      const size = Math.min(opportunity.suggestedSize || 0.1, this.maxTradeSize);
      await this.executeBuy(opportunity.token, {
        action: "buy",
        confidence: opportunity.score,
        reasoning: opportunity.reason,
        size,
      });
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      dailySpent: this.dailySpent,
      dailyLimit: this.dailyLimit,
      positionCount: this.positions.size,
      positions: Array.from(this.positions.values()),
    };
  }
}

export const aiTrader = new AITrader();
