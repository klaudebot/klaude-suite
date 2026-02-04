# @klaudebot/suite

AI-powered Solana trading suite with paper trading, risk management, and real-time market scanning. Smart Safe for your OpenClaw agent.

## Install

### Via npm (standalone)

```bash
npm install -g @klaudebot/suite
```

### Via ClawHub (OpenClaw skill)

```bash
clawhub install klaude-suite
```

## Usage

```bash
# Start the server (frontend + API on one port)
klaude start

# Custom port
klaude start --port 8080

# Help
klaude --help
```

Open `http://localhost:3001` in your browser.

### With OpenClaw

Once the server is running and the skill is installed, ask your agent:

- "Check what tokens Klaude has discovered"
- "Show my paper trading portfolio"
- "Buy 0.2 SOL worth of that new token"
- "Start the AI trader in moderate mode"
- "Pause all trading"

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port (or use `--port`) |
| `DATABASE_PATH` | `~/.klaude/klaude.db` | SQLite database location |
| `OPENAI_API_KEY` | — | Enables AI-powered trade decisions (falls back to rule-based) |

## Development

```bash
# Clone the repo
git clone https://github.com/klaudebot/klaude-suite.git
cd klaude-suite

# Install all dependencies
npm install
cd backend && npm install && cd ..

# Frontend dev server
npm run dev

# Backend dev server (separate terminal)
cd backend && npm run dev
```

## Build

```bash
# Build frontend (out/) + backend (backend/dist/)
npm run build
```

## License

MIT
