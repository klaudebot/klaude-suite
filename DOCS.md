# Klaude Suite: The Smart Safe for OpenClaw

**Financial guardrails and autonomous trading for your OpenClaw agent on Solana.**

Klaude Suite is a companion add-on for [OpenClaw](https://github.com/openclaw/openclaw) that gives your agent the ability to discover, evaluate, and paper-trade tokens on Solana DEXes — all within safety limits you define. Think of it as a vault with rules: your OpenClaw agent gets the keys, but the vault decides how wide the door opens.

---

## Why This Exists

OpenClaw is built around a simple idea: an AI agent that *actually does things*. It sends emails, books meetings, runs commands, and remembers what you care about. But the moment your agent touches money, "actually does things" becomes a liability.

Klaude Suite solves this by sitting between your OpenClaw instance and the Solana blockchain. It enforces hard limits on trade sizes, daily spending, and slippage. It scores tokens for risk before your agent can act on them. And it does all of this in a paper-trading sandbox first, so you can watch your agent learn without burning real SOL.

The core principle: **your agent proposes, the Smart Safe disposes.** No trade executes unless it passes every rule you configured.

---

## How It Connects to OpenClaw

Klaude Suite runs as a single service alongside your OpenClaw gateway:

```
OpenClaw Gateway (ws://127.0.0.1:18789)
    |
    |  Your agent decides it wants to trade
    |
    v
Klaude Suite (http://localhost:3001)
    |-- Static frontend: dashboard, wizard, wallet connection
    |-- REST API: config, trades, portfolio, activity
    |-- WebSocket: real-time token feeds, trade alerts, position updates
    |-- SQLite database: ~/.klaude/klaude.db
```

During setup, you point Klaude Suite at your OpenClaw gateway URL. The Smart Safe wizard verifies the connection, pulls your agent's name and active skills, and then walks you through rule configuration. Once deployed, the backend runs continuously — scanning DEXes, feeding opportunities to the AI trader, and enforcing your limits on every action.

The frontend is served by the same Express server on the same port. You see what your agent sees, what it decided, and why. You can pause trading, adjust limits, or reset the paper portfolio at any time without touching the OpenClaw config.

---

## Features

### Four Trading Modes

Every OpenClaw user has a different risk tolerance. Klaude Suite maps that to four autonomous modes, each changing how aggressively the AI trader behaves:

| Mode | Behavior | Best For |
|------|----------|----------|
| **Conservative** | Manual trades only. The agent never buys on its own. | Users who want monitoring and alerts without autonomous action. |
| **Moderate** | Trades on clear opportunities — price moves above 5%, strong liquidity signals. | Users who want light automation with a safety net. |
| **Aggressive** | Actively hunts alpha, arbitrage, and dip-buying opportunities. | Experienced users comfortable with higher frequency trading. |
| **Degen** | Snipes new token launches on Pump.fun, hunts early-stage gems, takes quick profits. | Users who want to test aggressive memecoin strategies in paper mode. |

The mode you pick determines which tokens, DEXes, and scoring thresholds the AI trader uses. Conservative mode disables the token scanner entirely. Degen mode enables Pump.fun integration and unlocks the profit-taking configuration.

### Safety Limits (The "Safe" in Smart Safe)

Three hard limits apply to every trade, regardless of mode:

- **Max Trade Size** — The most SOL your agent can spend on a single buy. Default: 0.5 SOL.
- **Daily Spending Limit** — Total SOL your agent can spend in a 24-hour window. Resets automatically. Default: 2 SOL.
- **Slippage Cap** — Maximum acceptable slippage percentage. Trades that would exceed this are blocked. Default: 1%.

These are not suggestions. The paper trading engine validates every trade against all three limits before execution. If a trade violates any rule, it is rejected and logged as a "blocked" activity so you can see what your agent tried to do.

### Token Risk Assessment

Every token discovered by the DEX scanner is scored before it reaches the AI trader:

- **Safe** — Liquidity above 20 SOL, more than 100 holders, market cap above $50k.
- **Risky** — Liquidity between 5-20 SOL, 30-100 holders, or market cap between $10k-$50k.
- **Danger** — Liquidity below 5 SOL, fewer than 30 holders, or market cap below $10k.

In conservative and moderate modes, danger-rated tokens are filtered out. In degen mode, all tokens pass through — the AI trader makes its own call, but the risk label is always visible on the dashboard.

### Paper Trading Engine

No real SOL is spent. The paper trading engine simulates a full portfolio:

- Starts with 10 SOL balance on devnet or mainnet-beta (simulation only).
- Tracks positions with entry price, quantity, current price, unrealized P&L, and multiplier.
- Supports partial buys (averaging in) and partial sells.
- Calculates realized P&L on every close: `(sell price - entry price) * quantity`.
- Records full trade history with timestamps, amounts, and outcomes.
- Persists everything to SQLite at `~/.klaude/klaude.db` — survives restarts.

You can reset the portfolio to start fresh at any time through the dashboard or via the API.

### AI-Powered Trade Decisions

When a new token opportunity arrives, the AI trader evaluates it using one of two paths:

**With an OpenAI API key:** The trader sends the token data to GPT-4o-mini with a custom prompt. The model returns a decision (buy, skip, or watch), a confidence percentage, and a recommended position size. The prompt is tuned for the selected trading mode.

**Without an OpenAI API key:** The trader uses a rule-based scoring system. It weighs token age (newer scores higher in degen mode), liquidity depth, holder count, risk rating, and recent price momentum. A randomized "YOLO factor" adds variance to prevent predictable patterns. Tokens scoring above threshold trigger a buy.

Either path respects the same safety limits. The AI trader also rate-limits itself to one trade per 15 seconds and skips tokens it has already evaluated (10-minute cooldown).

### Automated Position Management

Once a position is open, the AI trader monitors it every 10 seconds:

- **Profit-taking** — In degen mode, you configure what percentage to sell at each multiplier milestone. Example: sell 25% at 2x, sell 50% at 5x, sell everything at 10x.
- **Stop-loss** — If a position drops to 50% of entry price, the AI trader exits automatically.
- **Dead token detection** — If no price data arrives for 5 minutes, the token is flagged as dead and the position is closed at a 50% haircut.

Each of these actions is logged as an activity and broadcast to the dashboard in real-time.

### Real-Time Token Scanner

The backend connects to multiple data sources for token discovery:

- **PumpPortal WebSocket** — Real-time feed of new token launches on Pump.fun. Primary source in degen mode.
- **Pump.fun HTTP API** — Fallback for new token data if the WebSocket drops.
- **DexScreener API** — Broader Solana token data for moderate and aggressive modes.

The scanner runs on a 15-second cycle, deduplicates tokens, and emits discoveries over WebSocket to all connected clients. Opportunities are scored 0-100 and expire after 5 minutes if not acted on.

### Live Dashboard

The frontend provides a real-time view of everything happening inside the Smart Safe:

**Degen mode dashboard:**
- Token scanner panel with live new launches, risk labels, and manual snipe buttons.
- Active positions table showing entry price, current multiplier, unrealized P&L, and progress toward profit targets.
- Activity feed scrolling with every snipe, exit, stop-loss, and blocked trade.
- Stats bar: total snipes, daily SOL spent, win rate, best multiplier, rugs avoided.

**Conservative/Moderate dashboard:**
- Simplified stats and activity feed.
- Safe rules panel showing your current limits.
- Connected OpenClaw instance info and status.

Both modes show backend connection status, AI trader running/stopped state, network selection (devnet/mainnet), and a pause button to halt all autonomous trading instantly.

---

## Getting Started

### Prerequisites

- Node 18+
- A running OpenClaw gateway (`openclaw gateway`)
- A Solana wallet (Phantom, Solflare, etc.) — or use demo mode without one

### Installation

```bash
# Install globally from npm
npm install -g @klaudebot/suite

# Or install the OpenClaw skill via ClawHub
clawhub install klaude-suite
```

### Configuration

Configuration is done via environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port (or use `--port` flag) |
| `DATABASE_PATH` | `~/.klaude/klaude.db` | SQLite database location |
| `OPENAI_API_KEY` | — | Enables AI-powered trade decisions (falls back to rule-based) |

### Running

```bash
# Start the server (frontend + API on one port)
klaude start

# Or with a custom port
klaude start --port 8080
```

Open `http://localhost:3001`. Connect your wallet (or click "Try Demo") and walk through the Smart Safe wizard:

1. **Connect OpenClaw** — Enter your gateway URL (default: `http://127.0.0.1:18789`). The wizard verifies the connection.
2. **Configure Rules** — Pick your trading mode, set limits, select tokens and DEXes. Degen mode unlocks profit-taking thresholds.
3. **Deploy** — Review your config and activate. The backend starts scanning and trading within your rules.

### Demo Mode

If you want to explore without connecting a wallet or OpenClaw instance, click "Try Demo" on the landing page. Demo mode uses a simulated wallet address and pre-populated activity data. All features work — you just cannot connect to a live OpenClaw gateway.

---

## Architecture Summary

| Component | Technology | Port | Role |
|-----------|-----------|------|------|
| Server | Express.js, WebSocket, static files | 3001 | Frontend, API, scanning, paper trading, AI |
| Frontend | Next.js 16, React 19, Tailwind CSS | — | Pre-built static HTML/CSS/JS served by Express |
| Database | SQLite (WAL mode) | — | ~/.klaude/klaude.db — configs, portfolios, trades |

Everything runs on a single port. The Express server serves the pre-built static frontend, the REST API, and the WebSocket feed. Services communicate through Node.js EventEmitters, and all state changes are broadcast over WebSocket to the frontend. The database uses WAL mode for concurrent read/write access without locking.

---

## What This Is Not

Klaude Suite is a **paper trading sandbox**. It does not execute real blockchain transactions. No SOL leaves your wallet. The Solana wallet connection is used for identity (your public key becomes your portfolio ID) and for future mainnet integration — not for signing transactions today.

This is intentional. The goal is to let your OpenClaw agent develop and demonstrate trading instincts in a safe environment before you ever consider giving it access to real funds. Watch the paper portfolio. Study the activity logs. Tune the limits. Then decide if and when to go live.
