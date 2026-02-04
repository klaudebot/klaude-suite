---
name: klaude-suite
description: Financial guardrails and AI-powered paper trading for Solana. Lets the agent monitor tokens, execute simulated trades, manage risk, and track portfolio performance through the Klaude Suite backend.
metadata: { "openclaw": { "emoji": "🛡️", "homepage": "https://www.npmjs.com/package/@klaudebot/suite", "requires": { "bins": ["klaude"], "env": [] }, "primaryEnv": "OPENAI_API_KEY", "install": [ { "id": "npm", "kind": "npm", "package": "@klaudebot/suite", "bins": ["klaude"], "label": "Install Klaude Suite (npm)" } ] } }
---

## What this does

Klaude Suite is a paper trading sandbox for Solana. It runs a local server that provides:

- **Smart Safe**: configurable financial guardrails (max trade size, daily limits, slippage caps, risk thresholds)
- **Paper Trading Engine**: simulated portfolio with positions, P&L tracking, trade history — no real SOL spent
- **AI Trader**: autonomous trading decisions using GPT-4o-mini (with OpenAI key) or rule-based scoring (without)
- **Token Scanner**: real-time feed from PumpPortal, Pump.fun, and DexScreener
- **Risk Assessment**: every token scored as safe/risky/danger before the agent can act on it

The agent proposes trades. The Smart Safe enforces your rules. Nothing executes unless it passes every limit you configured.

## How to use

Start the Klaude Suite server first:

```
klaude start
```

Then ask the agent things like:

- "Check what tokens Klaude has discovered"
- "Show my paper trading portfolio"
- "Buy 0.2 SOL worth of that new token"
- "What's my win rate so far?"
- "Pause all trading"
- "Start the AI trader in moderate mode"
- "Set my daily limit to 5 SOL"

## API reference

The Klaude Suite backend runs at `http://localhost:3001` by default. All endpoints are under `/api`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/tokens` | Recently discovered tokens |
| GET | `/api/opportunities` | Active trading opportunities |
| GET | `/api/config/:wallet` | Get Smart Safe configuration |
| POST | `/api/config` | Create or update Safe config |
| POST | `/api/config/:wallet/pause` | Pause/unpause trading |
| GET | `/api/portfolio/:wallet` | Get portfolio and stats |
| POST | `/api/portfolio/:wallet/reset` | Reset paper portfolio |
| POST | `/api/trade` | Execute a paper trade |
| GET | `/api/trades/:wallet` | Trade history |
| GET | `/api/activity/:wallet` | Activity feed |
| POST | `/api/ai-trader/start` | Start AI trader |
| POST | `/api/ai-trader/stop` | Stop AI trader |
| GET | `/api/ai-trader/stats` | AI trader status |

WebSocket is available at `ws://localhost:3001/ws` for real-time token discoveries, trade alerts, and position updates.

## Notes

- This is a **paper trading sandbox only**. No real blockchain transactions are executed. No SOL leaves any wallet.
- Data persists in SQLite at `~/.klaude/klaude.db` across restarts.
- The `OPENAI_API_KEY` environment variable is optional. Without it, the AI trader uses rule-based scoring instead of GPT.
- Custom port: `klaude start --port 8080`
- The dashboard UI is available in the browser at the same URL as the API.
