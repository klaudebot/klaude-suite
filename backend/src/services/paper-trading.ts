import type {
  Portfolio,
  Position,
  Trade,
  SafeConfig,
  PortfolioStats,
  Activity,
  Network,
} from "../types/index.js";
import { db, generateId } from "../db/schema.js";
import { EventEmitter } from "events";

const INITIAL_SOL_BALANCE = 10.0; // Start with 10 SOL for paper trading

export class PaperTradingEngine extends EventEmitter {
  constructor() {
    super();
  }

  // Portfolio management
  getOrCreatePortfolio(walletAddress: string, network: Network = "devnet"): Portfolio {
    let portfolio = this.getPortfolio(walletAddress, network);
    if (!portfolio) {
      portfolio = this.createPortfolio(walletAddress, network);
    }
    return portfolio;
  }

  private createPortfolio(walletAddress: string, network: Network): Portfolio {
    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO portfolios (
        id, wallet_address, network, sol_balance, total_deposited,
        total_pnl, total_trades, win_rate, best_trade, rugs_avoided,
        daily_spent, daily_spent_reset, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, walletAddress, network, INITIAL_SOL_BALANCE, INITIAL_SOL_BALANCE,
      0, 0, 0, 0, 0, 0, now, now, now
    );

    this.logActivity(id, "alert", `Paper trading portfolio created with ${INITIAL_SOL_BALANCE} SOL`);

    return this.getPortfolio(walletAddress, network)!;
  }

  getPortfolio(walletAddress: string, network: Network = "devnet"): Portfolio | null {
    const row = db
      .prepare("SELECT * FROM portfolios WHERE wallet_address = ? AND network = ?")
      .get(walletAddress, network) as any;

    if (!row) return null;

    return {
      id: row.id,
      walletAddress: row.wallet_address,
      network: row.network,
      solBalance: row.sol_balance,
      positions: this.getPositions(row.id),
      totalDeposited: row.total_deposited,
      totalPnl: row.total_pnl,
      totalTrades: row.total_trades,
      winRate: row.win_rate,
      bestTrade: row.best_trade,
      rugsAvoided: row.rugs_avoided,
      dailySpent: row.daily_spent,
      dailySpentReset: new Date(row.daily_spent_reset),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  getPortfolioStats(walletAddress: string, network: Network = "devnet"): PortfolioStats | null {
    const portfolio = this.getPortfolio(walletAddress, network);
    if (!portfolio) return null;

    const config = this.getConfig(walletAddress);
    const dailyLimit = config?.dailyLimit || 2.0;

    // Reset daily spent if it's a new day
    this.checkDailyReset(portfolio);

    const positionsValue = portfolio.positions.reduce((sum, p) => sum + p.currentValue, 0);
    const totalValue = portfolio.solBalance + positionsValue;

    // Calculate actual P&L from positions (not stored value)
    const unrealizedPnl = portfolio.positions.reduce((sum, p) => sum + (p.pnl || 0), 0);
    const totalPnl = unrealizedPnl + portfolio.totalPnl; // unrealized + realized

    const totalPnlPercent = portfolio.totalDeposited > 0
      ? ((totalValue - portfolio.totalDeposited) / portfolio.totalDeposited) * 100
      : 0;

    // Calculate win rate from positions
    const winners = portfolio.positions.filter(p => (p.pnl || 0) > 0).length;
    const totalPositions = portfolio.positions.length;
    const winRate = totalPositions > 0 ? (winners / totalPositions) * 100 : 0;

    // Find best trade multiplier
    const bestMultiplier = portfolio.positions.reduce((best, p) => {
      const mult = p.avgEntryPrice > 0 ? p.currentPrice / p.avgEntryPrice : 1;
      return mult > best ? mult : best;
    }, portfolio.bestTrade || 1);

    return {
      totalValue,
      solBalance: portfolio.solBalance,
      positionsValue,
      totalPnl,
      totalPnlPercent,
      dailyPnl: unrealizedPnl,
      dailySpent: portfolio.dailySpent,
      dailyRemaining: Math.max(0, dailyLimit - portfolio.dailySpent),
      positionCount: portfolio.positions.length,
      winRate,
      bestTrade: bestMultiplier,
      rugsAvoided: portfolio.rugsAvoided,
    };
  }

  // Position management
  private getPositions(portfolioId: string): Position[] {
    const rows = db
      .prepare("SELECT * FROM positions WHERE portfolio_id = ?")
      .all(portfolioId) as any[];

    return rows.map((row) => ({
      id: row.id,
      portfolioId: row.portfolio_id,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      quantity: row.quantity,
      avgEntryPrice: row.avg_entry_price,
      currentPrice: row.current_price,
      entryValue: row.entry_value,
      currentValue: row.current_value,
      pnl: row.pnl,
      pnlPercent: row.pnl_percent,
      openedAt: new Date(row.opened_at),
      updatedAt: new Date(row.updated_at),
    }));
  }

  // Execute a paper trade
  async executeTrade(
    walletAddress: string,
    tokenAddress: string,
    tokenSymbol: string,
    side: "buy" | "sell",
    amount: number, // SOL for buys, token quantity for sells
    price: number,
    source: Trade["source"] = "manual",
    reason?: string
  ): Promise<{ success: boolean; trade?: Trade; error?: string }> {
    const portfolio = this.getOrCreatePortfolio(walletAddress, "devnet");
    const config = this.getConfig(walletAddress);

    // Validate against Safe rules
    if (config && !config.isPaused) {
      const validation = this.validateTrade(portfolio, config, side, amount, price);
      if (!validation.valid) {
        this.logActivity(portfolio.id, "blocked", validation.reason!);
        this.emit("trade_blocked", { walletAddress, reason: validation.reason });
        return { success: false, error: validation.reason };
      }
    }

    if (side === "buy") {
      return this.executeBuy(portfolio, tokenAddress, tokenSymbol, amount, price, source, reason);
    } else {
      return this.executeSell(portfolio, tokenAddress, tokenSymbol, amount, price, source, reason);
    }
  }

  private executeBuy(
    portfolio: Portfolio,
    tokenAddress: string,
    tokenSymbol: string,
    solAmount: number,
    price: number,
    source: Trade["source"],
    reason?: string
  ): { success: boolean; trade?: Trade; error?: string } {
    // Check balance
    if (portfolio.solBalance < solAmount) {
      return { success: false, error: "Insufficient SOL balance" };
    }

    const quantity = solAmount / price;
    const tradeId = generateId();
    const now = new Date();

    // Check if position exists
    const existingPosition = portfolio.positions.find((p) => p.tokenAddress === tokenAddress);

    if (existingPosition) {
      // Add to existing position (average up/down)
      const newQuantity = existingPosition.quantity + quantity;
      const newEntryValue = existingPosition.entryValue + solAmount;
      const newAvgPrice = newEntryValue / newQuantity;

      db.prepare(`
        UPDATE positions SET
          quantity = ?, avg_entry_price = ?, entry_value = ?,
          current_price = ?, current_value = ?, updated_at = ?
        WHERE id = ?
      `).run(newQuantity, newAvgPrice, newEntryValue, price, newQuantity * price, now.toISOString(), existingPosition.id);
    } else {
      // Create new position
      db.prepare(`
        INSERT INTO positions (
          id, portfolio_id, token_address, token_symbol,
          quantity, avg_entry_price, current_price, entry_value, current_value,
          pnl, pnl_percent, opened_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(), portfolio.id, tokenAddress, tokenSymbol,
        quantity, price, price, solAmount, solAmount,
        0, 0, now.toISOString(), now.toISOString()
      );
    }

    // Update portfolio balance
    db.prepare(`
      UPDATE portfolios SET
        sol_balance = sol_balance - ?,
        daily_spent = daily_spent + ?,
        total_trades = total_trades + 1,
        updated_at = ?
      WHERE id = ?
    `).run(solAmount, solAmount, now.toISOString(), portfolio.id);

    // Record trade
    const trade: Trade = {
      id: tradeId,
      portfolioId: portfolio.id,
      tokenAddress,
      tokenSymbol,
      side: "buy",
      quantity,
      price,
      value: solAmount,
      source,
      reason,
      status: "executed",
      executedAt: now,
      createdAt: now,
    };

    db.prepare(`
      INSERT INTO trades (
        id, portfolio_id, token_address, token_symbol,
        side, quantity, price, value, source, reason, status, executed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.id, trade.portfolioId, trade.tokenAddress, trade.tokenSymbol,
      trade.side, trade.quantity, trade.price, trade.value,
      trade.source, trade.reason || null, trade.status, trade.executedAt?.toISOString(), trade.createdAt.toISOString()
    );

    this.logActivity(
      portfolio.id,
      source === "manual" ? "trade" : "snipe",
      `Bought ${quantity.toFixed(4)} ${tokenSymbol} for ${solAmount.toFixed(4)} SOL @ ${price.toFixed(8)}`
    );

    this.emit("trade_executed", trade);
    this.emit("position_updated", { walletAddress: portfolio.walletAddress, tokenAddress });

    return { success: true, trade };
  }

  private executeSell(
    portfolio: Portfolio,
    tokenAddress: string,
    tokenSymbol: string,
    quantity: number, // Token quantity to sell
    price: number,
    source: Trade["source"],
    reason?: string
  ): { success: boolean; trade?: Trade; error?: string } {
    const position = portfolio.positions.find((p) => p.tokenAddress === tokenAddress);

    if (!position) {
      return { success: false, error: "No position found" };
    }

    if (position.quantity < quantity) {
      return { success: false, error: "Insufficient token balance" };
    }

    const solReceived = quantity * price;
    const costBasis = (quantity / position.quantity) * position.entryValue;
    const pnl = solReceived - costBasis;
    const multiplier = solReceived / costBasis;
    const isWin = pnl > 0;

    const tradeId = generateId();
    const now = new Date();

    // Update or close position
    const remainingQuantity = position.quantity - quantity;
    if (remainingQuantity <= 0.0001) {
      // Close position
      db.prepare("DELETE FROM positions WHERE id = ?").run(position.id);
    } else {
      // Partial sell
      const remainingEntryValue = position.entryValue - costBasis;
      db.prepare(`
        UPDATE positions SET
          quantity = ?, entry_value = ?,
          current_price = ?, current_value = ?, updated_at = ?
        WHERE id = ?
      `).run(remainingQuantity, remainingEntryValue, price, remainingQuantity * price, now.toISOString(), position.id);
    }

    // Update portfolio
    const updateQuery = db.prepare(`
      UPDATE portfolios SET
        sol_balance = sol_balance + ?,
        total_pnl = total_pnl + ?,
        total_trades = total_trades + 1,
        win_rate = CASE WHEN ? THEN (win_rate * (total_trades - 1) + 100) / total_trades ELSE (win_rate * (total_trades - 1)) / total_trades END,
        best_trade = CASE WHEN ? > best_trade THEN ? ELSE best_trade END,
        updated_at = ?
      WHERE id = ?
    `);
    updateQuery.run(solReceived, pnl, isWin ? 1 : 0, multiplier, multiplier, now.toISOString(), portfolio.id);

    // Record trade
    const trade: Trade = {
      id: tradeId,
      portfolioId: portfolio.id,
      tokenAddress,
      tokenSymbol,
      side: "sell",
      quantity,
      price,
      value: solReceived,
      pnl,
      multiplier,
      source,
      reason,
      status: "executed",
      executedAt: now,
      createdAt: now,
    };

    db.prepare(`
      INSERT INTO trades (
        id, portfolio_id, token_address, token_symbol,
        side, quantity, price, value, pnl, multiplier, source, reason, status, executed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trade.id, trade.portfolioId, trade.tokenAddress, trade.tokenSymbol,
      trade.side, trade.quantity, trade.price, trade.value,
      trade.pnl, trade.multiplier, trade.source, trade.reason || null, trade.status,
      trade.executedAt?.toISOString(), trade.createdAt.toISOString()
    );

    const pnlStr = pnl >= 0 ? `+${pnl.toFixed(4)}` : pnl.toFixed(4);
    const multiplierStr = multiplier >= 1 ? `${multiplier.toFixed(2)}x` : `${(multiplier * 100).toFixed(1)}%`;

    this.logActivity(
      portfolio.id,
      "exit",
      `Sold ${quantity.toFixed(4)} ${tokenSymbol} for ${solReceived.toFixed(4)} SOL (${pnlStr} SOL, ${multiplierStr})`
    );

    this.emit("trade_executed", trade);
    this.emit("position_updated", { walletAddress: portfolio.walletAddress, tokenAddress });

    return { success: true, trade };
  }

  // Trade validation against Safe rules
  private validateTrade(
    portfolio: Portfolio,
    config: SafeConfig,
    side: "buy" | "sell",
    amount: number,
    price: number
  ): { valid: boolean; reason?: string } {
    if (side !== "buy") return { valid: true };

    // Check max trade size
    if (amount > config.maxTradeSize) {
      return { valid: false, reason: `Trade exceeds max size (${amount} > ${config.maxTradeSize} SOL)` };
    }

    // Check daily limit
    this.checkDailyReset(portfolio);
    if (portfolio.dailySpent + amount > config.dailyLimit) {
      return {
        valid: false,
        reason: `Trade would exceed daily limit (${(portfolio.dailySpent + amount).toFixed(2)} > ${config.dailyLimit} SOL)`,
      };
    }

    return { valid: true };
  }

  private checkDailyReset(portfolio: Portfolio) {
    const now = new Date();
    const resetDate = new Date(portfolio.dailySpentReset);
    const hoursSinceReset = (now.getTime() - resetDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceReset >= 24) {
      db.prepare(`
        UPDATE portfolios SET daily_spent = 0, daily_spent_reset = ? WHERE id = ?
      `).run(now.toISOString(), portfolio.id);
      portfolio.dailySpent = 0;
      portfolio.dailySpentReset = now;
    }
  }

  // Config management
  getConfig(walletAddress: string): SafeConfig | null {
    const row = db
      .prepare("SELECT * FROM configs WHERE wallet_address = ?")
      .get(walletAddress) as any;

    if (!row) return null;

    return {
      id: row.id,
      walletAddress: row.wallet_address,
      maxTradeSize: row.max_trade_size,
      dailyLimit: row.daily_limit,
      slippageCap: row.slippage_cap,
      allowedTokens: JSON.parse(row.allowed_tokens),
      allowedDexes: JSON.parse(row.allowed_dexes),
      autonomousMode: row.autonomous_mode,
      profitTaking: row.profit_taking ? JSON.parse(row.profit_taking) : undefined,
      minLiquidity: row.min_liquidity,
      minHolders: row.min_holders,
      maxRisk: row.max_risk,
      isActive: !!row.is_active,
      isPaused: !!row.is_paused,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  saveConfig(config: Partial<SafeConfig> & { walletAddress: string }): SafeConfig {
    const existing = this.getConfig(config.walletAddress);
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(`
        UPDATE configs SET
          max_trade_size = COALESCE(?, max_trade_size),
          daily_limit = COALESCE(?, daily_limit),
          slippage_cap = COALESCE(?, slippage_cap),
          allowed_tokens = COALESCE(?, allowed_tokens),
          allowed_dexes = COALESCE(?, allowed_dexes),
          autonomous_mode = COALESCE(?, autonomous_mode),
          profit_taking = COALESCE(?, profit_taking),
          min_liquidity = COALESCE(?, min_liquidity),
          min_holders = COALESCE(?, min_holders),
          max_risk = COALESCE(?, max_risk),
          is_paused = COALESCE(?, is_paused),
          updated_at = ?
        WHERE wallet_address = ?
      `).run(
        config.maxTradeSize,
        config.dailyLimit,
        config.slippageCap,
        config.allowedTokens ? JSON.stringify(config.allowedTokens) : null,
        config.allowedDexes ? JSON.stringify(config.allowedDexes) : null,
        config.autonomousMode,
        config.profitTaking ? JSON.stringify(config.profitTaking) : null,
        config.minLiquidity,
        config.minHolders,
        config.maxRisk,
        config.isPaused !== undefined ? (config.isPaused ? 1 : 0) : null,
        now,
        config.walletAddress
      );
    } else {
      db.prepare(`
        INSERT INTO configs (
          id, wallet_address, max_trade_size, daily_limit, slippage_cap,
          allowed_tokens, allowed_dexes, autonomous_mode, profit_taking,
          min_liquidity, min_holders, max_risk, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        config.walletAddress,
        config.maxTradeSize || 0.5,
        config.dailyLimit || 2.0,
        config.slippageCap || 1.0,
        JSON.stringify(config.allowedTokens || ["SOL", "USDC"]),
        JSON.stringify(config.allowedDexes || ["jupiter", "raydium"]),
        config.autonomousMode || "moderate",
        config.profitTaking ? JSON.stringify(config.profitTaking) : null,
        config.minLiquidity || 10,
        config.minHolders || 50,
        config.maxRisk || "risky",
        now,
        now
      );
    }

    return this.getConfig(config.walletAddress)!;
  }

  // Activity logging
  logActivity(portfolioId: string | null, type: Activity["type"], message: string, data?: Record<string, unknown>) {
    const activity: Activity = {
      id: generateId(),
      portfolioId: portfolioId || undefined,
      type,
      message,
      data,
      createdAt: new Date(),
    };

    db.prepare(`
      INSERT INTO activities (id, portfolio_id, type, message, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(activity.id, activity.portfolioId || null, activity.type, activity.message, data ? JSON.stringify(data) : null, activity.createdAt.toISOString());

    this.emit("activity", activity);
    return activity;
  }

  getActivities(portfolioId: string, limit = 50): Activity[] {
    const rows = db
      .prepare("SELECT * FROM activities WHERE portfolio_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(portfolioId, limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      portfolioId: row.portfolio_id,
      type: row.type,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  getTradeHistory(portfolioId: string, limit = 50): Trade[] {
    const rows = db
      .prepare("SELECT * FROM trades WHERE portfolio_id = ? ORDER BY created_at DESC LIMIT ?")
      .all(portfolioId, limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      portfolioId: row.portfolio_id,
      tokenAddress: row.token_address,
      tokenSymbol: row.token_symbol,
      side: row.side,
      quantity: row.quantity,
      price: row.price,
      value: row.value,
      pnl: row.pnl,
      multiplier: row.multiplier,
      source: row.source,
      reason: row.reason,
      status: row.status,
      executedAt: row.executed_at ? new Date(row.executed_at) : undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  // Reset portfolio (for testing)
  resetPortfolio(walletAddress: string, network: Network = "devnet") {
    const portfolio = this.getPortfolio(walletAddress, network);
    if (!portfolio) return;

    db.prepare("DELETE FROM positions WHERE portfolio_id = ?").run(portfolio.id);
    db.prepare("DELETE FROM trades WHERE portfolio_id = ?").run(portfolio.id);
    db.prepare("DELETE FROM activities WHERE portfolio_id = ?").run(portfolio.id);
    db.prepare(`
      UPDATE portfolios SET
        sol_balance = ?, total_deposited = ?, total_pnl = 0, total_trades = 0,
        win_rate = 0, best_trade = 0, rugs_avoided = 0, daily_spent = 0, updated_at = ?
      WHERE id = ?
    `).run(INITIAL_SOL_BALANCE, INITIAL_SOL_BALANCE, new Date().toISOString(), portfolio.id);

    this.logActivity(portfolio.id, "alert", `Portfolio reset with ${INITIAL_SOL_BALANCE} SOL`);
  }
}

// Singleton instance
export const paperTrading = new PaperTradingEngine();
