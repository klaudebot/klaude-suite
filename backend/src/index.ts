import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { initializeDatabase } from "./db/schema.js";
import { router as apiRouter } from "./routes/api.js";
import { dexScanner } from "./services/dex-scanner.js";
import { paperTrading } from "./services/paper-trading.js";
import { aiTrader } from "./services/ai-trader.js";
import type { WSMessage } from "./types/index.js";

const PORT = parseInt(process.env.PORT || "3001");
const STATIC_DIR = process.env.KLAUDE_STATIC_DIR || "";

// Initialize database
initializeDatabase();

// Express app
const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use("/api", apiRouter);

// Serve static frontend if KLAUDE_STATIC_DIR is set and exists
if (STATIC_DIR && fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));

  // SPA fallback: serve index.html for non-API, non-WS routes
  app.get("*", (req, res) => {
    const indexPath = path.join(STATIC_DIR, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not found");
    }
  });
}

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });

// Track connected clients
const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  console.log("[WS] Client connected");
  clients.add(ws);

  // Send welcome message
  sendToClient(ws, {
    type: "activity",
    data: { type: "alert", message: "Connected to Klaude backend" },
    timestamp: new Date(),
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(ws, message);
    } catch (error) {
      console.error("[WS] Invalid message:", error);
    }
  });

  ws.on("close", () => {
    console.log("[WS] Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (error) => {
    console.error("[WS] Client error:", error);
    clients.delete(ws);
  });
});

function sendToClient(ws: WebSocket, message: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(message: WSMessage) {
  const data = JSON.stringify(message);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

function handleClientMessage(ws: WebSocket, message: any) {
  switch (message.type) {
    case "subscribe":
      // Client wants to subscribe to updates for a wallet
      console.log(`[WS] Client subscribed to wallet: ${message.walletAddress}`);
      // In a production app, we'd track which wallets each client is interested in
      break;

    case "ping":
      sendToClient(ws, { type: "activity", data: { type: "alert", message: "pong" }, timestamp: new Date() });
      break;

    default:
      console.log("[WS] Unknown message type:", message.type);
  }
}

// Wire up event listeners to broadcast updates

// DEX Scanner events
dexScanner.on("token_discovered", (token) => {
  broadcast({
    type: "token_discovered",
    data: token,
    timestamp: new Date(),
  });
});

dexScanner.on("opportunity_found", (opportunity) => {
  broadcast({
    type: "opportunity_found",
    data: opportunity,
    timestamp: new Date(),
  });
});

// Paper Trading events
paperTrading.on("trade_executed", (trade) => {
  broadcast({
    type: "trade_executed",
    data: trade,
    timestamp: new Date(),
  });
});

paperTrading.on("trade_blocked", (data) => {
  broadcast({
    type: "activity",
    data: { type: "blocked", message: data.reason },
    timestamp: new Date(),
  });
});

paperTrading.on("position_updated", (data) => {
  broadcast({
    type: "position_updated",
    data,
    timestamp: new Date(),
  });
});

paperTrading.on("activity", (activity) => {
  broadcast({
    type: "activity",
    data: activity,
    timestamp: new Date(),
  });
});

// AI Trader events - broadcast activities
aiTrader.on("activity", (activity) => {
  broadcast({
    type: "activity",
    data: activity,
    timestamp: new Date(),
  });
});

aiTrader.on("trade", (data) => {
  broadcast({
    type: "trade_executed",
    data: data.trade,
    timestamp: new Date(),
  });
});

aiTrader.on("position_update", (data) => {
  broadcast({
    type: "position_updated",
    data,
    timestamp: new Date(),
  });
});

// Wire DEX Scanner tokens to AI Trader
dexScanner.on("token_discovered", (token) => {
  aiTrader.handleNewToken(token);
});

dexScanner.on("opportunity_found", (opportunity) => {
  aiTrader.handleOpportunity(opportunity);
});

// API endpoint to start AI trader
apiRouter.post("/ai-trader/start", async (req, res) => {
  try {
    const { walletAddress, openaiKey } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress required" });
    }

    await aiTrader.initialize(walletAddress, openaiKey);
    aiTrader.start();

    res.json({
      success: true,
      message: "AI Trader started",
      stats: aiTrader.getStats()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

apiRouter.post("/ai-trader/stop", (req, res) => {
  aiTrader.stop();
  res.json({ success: true, message: "AI Trader stopped" });
});

apiRouter.get("/ai-trader/stats", (req, res) => {
  res.json({ stats: aiTrader.getStats() });
});

// Start server
server.listen(PORT, () => {
  const staticStatus = STATIC_DIR && fs.existsSync(STATIC_DIR)
    ? `Frontend:   http://localhost:${PORT}/`
    : "Frontend:   not configured (set KLAUDE_STATIC_DIR)";

  console.log(`
╦╔═╦  ╔═╗╦ ╦╔╦╗╔═╗
╠╩╗║  ╠═╣║ ║ ║║║╣
╩ ╩╩═╝╩ ╩╚═╝═╩╝╚═╝  v0.1.0

${staticStatus}
API:        http://localhost:${PORT}/api
WebSocket:  ws://localhost:${PORT}/ws

Endpoints:
  GET  /api/health              - Health check
  GET  /api/tokens              - Recent tokens
  GET  /api/opportunities       - Active opportunities
  GET  /api/config/:wallet      - Get Safe config
  POST /api/config              - Create/update config
  POST /api/config/:wallet/pause - Pause trading
  GET  /api/portfolio/:wallet   - Get portfolio
  POST /api/portfolio/:wallet/reset - Reset portfolio
  POST /api/trade               - Execute paper trade
  GET  /api/trades/:wallet      - Trade history
  GET  /api/activity/:wallet    - Activity feed
  `);

  // Start the DEX scanner
  dexScanner.start();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down...");
  dexScanner.stop();
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down...");
  dexScanner.stop();
  server.close(() => {
    process.exit(0);
  });
});
