import { Router } from "express";
import { dexScanner } from "../services/dex-scanner.js";
import { paperTrading } from "../services/paper-trading.js";
import { aiTrader } from "../services/ai-trader.js";
import type { CreateConfigRequest, ExecuteTradeRequest, Network } from "../types/index.js";

export const router = Router();

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============ TOKENS ============

// Get recent tokens
router.get("/tokens", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const source = req.query.source as string;

  const tokens = source
    ? dexScanner.getTokensBySource(source, limit)
    : dexScanner.getRecentTokens(limit);

  res.json({ tokens });
});

// Get active opportunities
router.get("/opportunities", (req, res) => {
  const opportunities = dexScanner.getActiveOpportunities();
  res.json({ opportunities });
});

// ============ CONFIG ============

// Get Safe config
router.get("/config/:walletAddress", (req, res) => {
  const config = paperTrading.getConfig(req.params.walletAddress);
  if (!config) {
    return res.status(404).json({ error: "Config not found" });
  }
  res.json({ config });
});

// Create/update Safe config
router.post("/config", (req, res) => {
  const body = req.body as CreateConfigRequest;

  if (!body.walletAddress) {
    return res.status(400).json({ error: "walletAddress is required" });
  }

  const config = paperTrading.saveConfig({
    walletAddress: body.walletAddress,
    maxTradeSize: body.maxTradeSize,
    dailyLimit: body.dailyLimit,
    slippageCap: body.slippageCap,
    allowedTokens: body.allowedTokens,
    allowedDexes: body.allowedDexes,
    autonomousMode: body.autonomousMode,
    profitTaking: body.profitTaking,
    minLiquidity: body.minLiquidity,
    minHolders: body.minHolders,
    maxRisk: body.maxRisk,
  });

  res.json({ config });
});

// Pause/unpause trading
router.post("/config/:walletAddress/pause", (req, res) => {
  const { paused } = req.body;
  const config = paperTrading.saveConfig({
    walletAddress: req.params.walletAddress,
    isPaused: paused,
  });
  res.json({ config });
});

// ============ PORTFOLIO ============

// Get portfolio
router.get("/portfolio/:walletAddress", (req, res) => {
  const network = (req.query.network as Network) || "devnet";
  const portfolio = paperTrading.getOrCreatePortfolio(req.params.walletAddress, network);
  const stats = paperTrading.getPortfolioStats(req.params.walletAddress, network);

  res.json({ portfolio, stats });
});

// Get portfolio stats
router.get("/portfolio/:walletAddress/stats", (req, res) => {
  const network = (req.query.network as Network) || "devnet";
  const stats = paperTrading.getPortfolioStats(req.params.walletAddress, network);

  if (!stats) {
    return res.status(404).json({ error: "Portfolio not found" });
  }

  res.json({ stats });
});

// Reset portfolio
router.post("/portfolio/:walletAddress/reset", (req, res) => {
  const network = (req.query.network as Network) || "devnet";
  paperTrading.resetPortfolio(req.params.walletAddress, network);
  aiTrader.resetDaily(); // Also reset AI trader's state
  const portfolio = paperTrading.getOrCreatePortfolio(req.params.walletAddress, network);
  res.json({ portfolio, message: "Portfolio reset successfully" });
});

// ============ TRADES ============

// Execute a trade
router.post("/trade", (req, res) => {
  const body = req.body as ExecuteTradeRequest & { tokenSymbol: string; price: number };

  if (!body.walletAddress || !body.tokenAddress || !body.side || !body.amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // For paper trading, we need the current price
  // In production, we'd fetch this from Jupiter/Raydium
  const price = body.price || 0.0001; // Default price for testing

  paperTrading
    .executeTrade(
      body.walletAddress,
      body.tokenAddress,
      body.tokenSymbol || body.tokenAddress.slice(0, 6),
      body.side,
      body.amount,
      price,
      body.source || "manual"
    )
    .then((result) => {
      if (result.success) {
        res.json({ success: true, trade: result.trade });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    });
});

// Get trade history
router.get("/trades/:walletAddress", (req, res) => {
  const network = (req.query.network as Network) || "devnet";
  const limit = parseInt(req.query.limit as string) || 50;

  const portfolio = paperTrading.getPortfolio(req.params.walletAddress, network);
  if (!portfolio) {
    return res.status(404).json({ error: "Portfolio not found" });
  }

  const trades = paperTrading.getTradeHistory(portfolio.id, limit);
  res.json({ trades });
});

// ============ ACTIVITY ============

// Get activity feed
router.get("/activity/:walletAddress", (req, res) => {
  const network = (req.query.network as Network) || "devnet";
  const limit = parseInt(req.query.limit as string) || 50;

  const portfolio = paperTrading.getPortfolio(req.params.walletAddress, network);
  if (!portfolio) {
    return res.status(404).json({ error: "Portfolio not found" });
  }

  const activities = paperTrading.getActivities(portfolio.id, limit);
  res.json({ activities });
});
