"use client";

import Link from "next/link";

const ASCII_LOGO = `
╦╔═╦  ╔═╗╦ ╦╔╦╗╔═╗
╠╩╗║  ╠═╣║ ║ ║║║╣
╩ ╩╩═╝╩ ╩╚═╝═╩╝╚═╝
DOCUMENTATION`;

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      {/* Grid background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(39,39,42,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(39,39,42,0.15)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-12">
        {/* Nav */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-mono text-zinc-500 hover:text-amber-500 transition-colors"
          >
            &larr; Back to Klaude Suite
          </Link>
        </div>

        {/* Main card */}
        <div className="bg-[#0c0c12] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#111118] border-b border-zinc-800">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-xs font-mono text-zinc-500 hidden sm:block">
              klaude-suite // docs
            </span>
            <div className="w-16" />
          </div>

          <div className="p-6 md:p-8">
            {/* ASCII Logo */}
            <pre
              className="text-amber-500 text-[10px] sm:text-xs leading-tight mb-6 whitespace-pre"
              style={{
                fontFamily:
                  '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace',
              }}
            >
              {ASCII_LOGO}
            </pre>

            {/* Title */}
            <h1 className="text-2xl md:text-4xl font-bold text-zinc-100 mb-2 leading-tight">
              The <span className="text-amber-500">Smart Safe</span> for
              OpenClaw
            </h1>
            <p className="text-zinc-400 text-sm md:text-base mb-8 max-w-2xl">
              Financial guardrails and autonomous trading for your OpenClaw
              agent on Solana.
            </p>

            {/* Table of contents */}
            <div className="p-4 bg-[#111118] border border-zinc-800 rounded-lg mb-8">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-3">
                Contents
              </p>
              <nav className="space-y-1">
                {[
                  ["Why This Exists", "#why"],
                  ["How It Connects to OpenClaw", "#architecture"],
                  ["Features", "#features"],
                  ["Getting Started", "#getting-started"],
                  ["Architecture Summary", "#arch-summary"],
                  ["What This Is Not", "#disclaimer"],
                ].map(([label, href]) => (
                  <a
                    key={href}
                    href={href}
                    className="block text-sm font-mono text-zinc-400 hover:text-amber-500 transition-colors"
                  >
                    <span className="text-amber-500/50 mr-2">&gt;</span>
                    {label}
                  </a>
                ))}
              </nav>
            </div>

            {/* ───── Why This Exists ───── */}
            <section id="why" className="mb-10">
              <SectionHeading>Why This Exists</SectionHeading>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                OpenClaw is built around a simple idea: an AI agent that{" "}
                <em>actually does things</em>. It sends emails, books meetings,
                runs commands, and remembers what you care about. But the moment
                your agent touches money, &ldquo;actually does things&rdquo;
                becomes a liability.
              </p>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Klaude Suite solves this by sitting between your OpenClaw
                instance and the Solana blockchain. It enforces hard limits on
                trade sizes, daily spending, and slippage. It scores tokens for
                risk before your agent can act on them. And it does all of this
                in a paper-trading sandbox first, so you can watch your agent
                learn without burning real SOL.
              </p>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-200/90 font-mono">
                  Core principle:{" "}
                  <span className="text-amber-400 font-bold">
                    your agent proposes, the Smart Safe disposes.
                  </span>{" "}
                  No trade executes unless it passes every rule you configured.
                </p>
              </div>
            </section>

            {/* ───── Architecture ───── */}
            <section id="architecture" className="mb-10">
              <SectionHeading>How It Connects to OpenClaw</SectionHeading>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Klaude Suite runs as a single service alongside your OpenClaw
                gateway:
              </p>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-4 overflow-x-auto">
                <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre">
                  {`OpenClaw Gateway (ws://127.0.0.1:18789)
    |
    |  Your agent decides it wants to trade
    |
    v
Klaude Suite (http://localhost:3001)
    |-- Static frontend: dashboard, wizard, wallet
    |-- REST API: config, trades, portfolio, activity
    |-- WebSocket: real-time token feeds, trade alerts
    |-- SQLite database: ~/.klaude/klaude.db`}
                </pre>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Klaude Suite runs as a single server on one port. The frontend
                is pre-built as static HTML/CSS/JS and served by the Express
                backend alongside the API and WebSocket. During setup, you point
                Klaude Suite at your OpenClaw gateway URL. The Smart Safe wizard
                verifies the connection, pulls your agent&apos;s name and active
                skills, and then walks you through rule configuration. Once
                deployed, the backend runs continuously&mdash;scanning DEXes,
                feeding opportunities to the AI trader, and enforcing your
                limits on every action.
              </p>
            </section>

            {/* ───── Features ───── */}
            <section id="features" className="mb-10">
              <SectionHeading>Features</SectionHeading>

              {/* Trading Modes */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Four Trading
                Modes
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Every OpenClaw user has a different risk tolerance. Klaude Suite
                maps that to four autonomous modes, each changing how
                aggressively the AI trader behaves:
              </p>
              <div className="grid gap-3 mb-6">
                {[
                  {
                    name: "Conservative",
                    icon: "🛡️",
                    desc: "Manual trades only. The agent never buys on its own.",
                    for: "Monitoring and alerts without autonomous action.",
                  },
                  {
                    name: "Moderate",
                    icon: "⚖️",
                    desc: "Trades on clear opportunities — price moves above 5%, strong liquidity.",
                    for: "Light automation with a safety net.",
                  },
                  {
                    name: "Aggressive",
                    icon: "🎯",
                    desc: "Actively hunts alpha, arbitrage, and dip-buying opportunities.",
                    for: "Higher frequency trading.",
                  },
                  {
                    name: "Degen",
                    icon: "🦧",
                    desc: "Snipes new token launches on Pump.fun, hunts early-stage gems, quick profits.",
                    for: "Testing aggressive memecoin strategies in paper mode.",
                  },
                ].map((mode) => (
                  <div
                    key={mode.name}
                    className="p-4 bg-[#111118] border border-zinc-800 rounded-lg flex gap-4"
                  >
                    <span className="text-2xl">{mode.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-zinc-200 mb-1">
                        {mode.name}
                      </p>
                      <p className="text-xs text-zinc-400">{mode.desc}</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        Best for: {mode.for}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Safety Limits */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Safety Limits
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Three hard limits apply to every trade, regardless of mode.
                These are not suggestions — the paper trading engine validates
                every trade against all three before execution.
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-6">
                {[
                  {
                    label: "Max Trade Size",
                    value: "0.5 SOL",
                    desc: "Most SOL per single buy",
                  },
                  {
                    label: "Daily Limit",
                    value: "2 SOL",
                    desc: "Total SOL per 24-hour window",
                  },
                  {
                    label: "Slippage Cap",
                    value: "1%",
                    desc: "Max acceptable slippage",
                  },
                ].map((limit) => (
                  <div
                    key={limit.label}
                    className="p-4 border border-zinc-800 rounded-lg text-center"
                  >
                    <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-1">
                      {limit.label}
                    </p>
                    <p className="text-xl font-bold text-amber-500 mb-1">
                      {limit.value}
                    </p>
                    <p className="text-xs text-zinc-500">{limit.desc}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
                <p className="text-xs text-red-300/80 font-mono">
                  If a trade violates any rule, it is rejected and logged as a
                  &ldquo;blocked&rdquo; activity so you can see what your agent
                  tried to do.
                </p>
              </div>

              {/* Token Risk */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Token Risk
                Assessment
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Every token discovered by the DEX scanner is scored before it
                reaches the AI trader:
              </p>
              <div className="space-y-2 mb-6">
                {[
                  {
                    level: "Safe",
                    color: "green",
                    criteria:
                      "Liquidity > 20 SOL, 100+ holders, market cap > $50k",
                  },
                  {
                    level: "Risky",
                    color: "amber",
                    criteria:
                      "Liquidity 5-20 SOL, 30-100 holders, market cap $10k-$50k",
                  },
                  {
                    level: "Danger",
                    color: "red",
                    criteria:
                      "Liquidity < 5 SOL, fewer than 30 holders, market cap < $10k",
                  },
                ].map((r) => (
                  <div
                    key={r.level}
                    className="flex items-center gap-3 p-3 bg-[#111118] border border-zinc-800 rounded-lg"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        r.color === "green"
                          ? "bg-green-500"
                          : r.color === "amber"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                    />
                    <span className="text-sm font-bold text-zinc-200 w-16">
                      {r.level}
                    </span>
                    <span className="text-xs text-zinc-400">{r.criteria}</span>
                  </div>
                ))}
              </div>

              {/* Paper Trading */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Paper Trading
                Engine
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                No real SOL is spent. The paper trading engine simulates a full
                portfolio:
              </p>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-6">
                <ul className="space-y-2 text-xs font-mono text-zinc-400">
                  <li>
                    <span className="text-green-400 mr-2">+</span>Starts with 10
                    SOL balance on devnet or mainnet-beta (simulation only)
                  </li>
                  <li>
                    <span className="text-green-400 mr-2">+</span>Tracks
                    positions with entry price, quantity, current price,
                    unrealized P&L
                  </li>
                  <li>
                    <span className="text-green-400 mr-2">+</span>Supports
                    partial buys (averaging in) and partial sells
                  </li>
                  <li>
                    <span className="text-green-400 mr-2">+</span>Records full
                    trade history with timestamps, amounts, and outcomes
                  </li>
                  <li>
                    <span className="text-green-400 mr-2">+</span>Persists to
                    SQLite — survives restarts
                  </li>
                  <li>
                    <span className="text-green-400 mr-2">+</span>Reset anytime
                    through the dashboard or API
                  </li>
                </ul>
              </div>

              {/* AI Trade Decisions */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>AI-Powered Trade
                Decisions
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                When a new token opportunity arrives, the AI trader evaluates it
                using one of two paths:
              </p>
              <div className="grid md:grid-cols-2 gap-3 mb-6">
                <div className="p-4 bg-[#111118] border border-zinc-800 rounded-lg">
                  <p className="text-xs text-amber-500 font-mono uppercase tracking-wider mb-2">
                    With OpenAI Key
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Sends token data to GPT-4o-mini with a custom prompt.
                    Returns a buy/skip/watch decision, confidence percentage,
                    and recommended position size.
                  </p>
                </div>
                <div className="p-4 bg-[#111118] border border-zinc-800 rounded-lg">
                  <p className="text-xs text-amber-500 font-mono uppercase tracking-wider mb-2">
                    Without OpenAI Key
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Rule-based scoring: weighs token age, liquidity depth,
                    holder count, risk rating, and momentum. A randomized factor
                    adds variance.
                  </p>
                </div>
              </div>

              {/* Position Management */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Automated
                Position Management
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Once a position is open, the AI trader monitors it every 10
                seconds:
              </p>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-6 space-y-2 text-xs font-mono">
                <p className="text-zinc-500">
                  <span className="text-blue-400">[profit-taking]</span>{" "}
                  <span className="text-zinc-400">
                    Sell 25% at 2x, 50% at 5x, 100% at 10x (configurable in
                    degen mode)
                  </span>
                </p>
                <p className="text-zinc-500">
                  <span className="text-red-400">[stop-loss]</span>{" "}
                  <span className="text-zinc-400">
                    Auto-exit if position drops to 50% of entry price
                  </span>
                </p>
                <p className="text-zinc-500">
                  <span className="text-amber-400">[dead-token]</span>{" "}
                  <span className="text-zinc-400">
                    No price data for 5 min? Flagged dead, position closed at
                    50% haircut
                  </span>
                </p>
              </div>

              {/* Token Scanner */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Real-Time Token
                Scanner
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                The backend connects to multiple data sources for token
                discovery:
              </p>
              <div className="grid md:grid-cols-3 gap-3 mb-6">
                {[
                  {
                    name: "PumpPortal WS",
                    desc: "Real-time feed of new launches on Pump.fun. Primary source in degen mode.",
                  },
                  {
                    name: "Pump.fun API",
                    desc: "HTTP fallback for new token data if WebSocket drops.",
                  },
                  {
                    name: "DexScreener",
                    desc: "Broader Solana token data for moderate and aggressive modes.",
                  },
                ].map((src) => (
                  <div
                    key={src.name}
                    className="p-4 border border-zinc-800 rounded-lg"
                  >
                    <p className="text-sm font-bold text-zinc-200 mb-1">
                      {src.name}
                    </p>
                    <p className="text-xs text-zinc-500">{src.desc}</p>
                  </div>
                ))}
              </div>

              {/* Dashboard */}
              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Live Dashboard
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Real-time view of everything happening inside the Smart Safe.
                The layout adapts to your trading mode:
              </p>
              <div className="grid md:grid-cols-2 gap-3 mb-6">
                <div className="p-4 bg-[#111118] border border-zinc-800 rounded-lg">
                  <p className="text-xs text-amber-500 font-mono uppercase tracking-wider mb-2">
                    Degen Dashboard
                  </p>
                  <ul className="space-y-1 text-xs text-zinc-400">
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>Token
                      scanner with live launches + snipe buttons
                    </li>
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>Active
                      positions with multiplier progress bars
                    </li>
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>
                      Activity feed: snipes, exits, stop-losses
                    </li>
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>Stats:
                      win rate, best trade, rugs avoided
                    </li>
                  </ul>
                </div>
                <div className="p-4 bg-[#111118] border border-zinc-800 rounded-lg">
                  <p className="text-xs text-amber-500 font-mono uppercase tracking-wider mb-2">
                    Conservative / Moderate
                  </p>
                  <ul className="space-y-1 text-xs text-zinc-400">
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>
                      Simplified stats and activity feed
                    </li>
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>Safe
                      rules panel with current limits
                    </li>
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>
                      Connected OpenClaw instance info
                    </li>
                    <li>
                      <span className="text-zinc-600 mr-1">&bull;</span>Pause
                      button to halt trading instantly
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* ───── Getting Started ───── */}
            <section id="getting-started" className="mb-10">
              <SectionHeading>Getting Started</SectionHeading>

              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-4 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Prerequisites
              </h3>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-6">
                <ul className="space-y-2 text-xs font-mono text-zinc-400">
                  <li>
                    <span className="text-amber-400 mr-2">$</span>Node 18+
                  </li>
                  <li>
                    <span className="text-amber-400 mr-2">$</span>A running
                    OpenClaw gateway (
                    <span className="text-zinc-300">openclaw gateway</span>)
                  </li>
                  <li>
                    <span className="text-amber-400 mr-2">$</span>A Solana
                    wallet (Phantom, Solflare) — or use demo mode
                  </li>
                </ul>
              </div>

              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Installation
              </h3>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-6 overflow-x-auto">
                <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre">
                  {`# Install globally from npm
npm install -g @klaudebot/suite

# Or install the OpenClaw skill via ClawHub
clawhub install klaude-suite`}
                </pre>
              </div>

              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Configuration
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                Configuration is done via environment variables. Set them before
                running or export them in your shell profile:
              </p>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-6 overflow-x-auto">
                <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre">
                  {`# Required for AI-powered decisions (optional — falls back to rules)
OPENAI_API_KEY=sk-...

# Database path (default: ~/.klaude/klaude.db)
DATABASE_PATH=~/.klaude/klaude.db

# Port (default: 3001, or use --port flag)
PORT=3001`}
                </pre>
              </div>

              <h3 className="text-sm font-bold text-zinc-200 mb-3 mt-6 font-mono uppercase tracking-wider">
                <span className="text-amber-500 mr-2">//</span>Running
              </h3>
              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-4 overflow-x-auto">
                <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre">
                  {`# Start the server (frontend + API on one port)
klaude start

# Or with a custom port
klaude start --port 8080`}
                </pre>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Open{" "}
                <code className="text-amber-400 text-xs">
                  http://localhost:3001
                </code>
                . Connect your wallet (or click &ldquo;Try Demo&rdquo;) and walk
                through the Smart Safe wizard:
              </p>
              <div className="space-y-2 mb-6">
                {[
                  {
                    step: "1",
                    title: "Connect OpenClaw",
                    desc: "Enter your gateway URL. The wizard verifies the connection.",
                  },
                  {
                    step: "2",
                    title: "Configure Rules",
                    desc: "Pick your trading mode, set limits, select tokens and DEXes.",
                  },
                  {
                    step: "3",
                    title: "Deploy",
                    desc: "Review your config and activate. Scanning begins within your rules.",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    className="flex items-start gap-3 p-3 bg-[#111118] border border-zinc-800 rounded-lg"
                  >
                    <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                      {s.step}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-zinc-200">
                        {s.title}
                      </p>
                      <p className="text-xs text-zinc-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-xs text-green-400 font-mono uppercase tracking-wider mb-1">
                  Demo Mode
                </p>
                <p className="text-xs text-green-300/80">
                  No wallet or OpenClaw instance needed. Click &ldquo;Try
                  Demo&rdquo; on the landing page. Uses a simulated wallet and
                  pre-populated activity data. All features work.
                </p>
              </div>
            </section>

            {/* ───── Architecture Summary ───── */}
            <section id="arch-summary" className="mb-10">
              <SectionHeading>Architecture Summary</SectionHeading>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 pr-4 text-zinc-500 uppercase tracking-wider">
                        Component
                      </th>
                      <th className="text-left py-2 pr-4 text-zinc-500 uppercase tracking-wider">
                        Technology
                      </th>
                      <th className="text-left py-2 pr-4 text-zinc-500 uppercase tracking-wider">
                        Port
                      </th>
                      <th className="text-left py-2 text-zinc-500 uppercase tracking-wider">
                        Role
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-400">
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 pr-4 text-zinc-200">Server</td>
                      <td className="py-2 pr-4">
                        Express, WebSocket, static files
                      </td>
                      <td className="py-2 pr-4 text-amber-500">3001</td>
                      <td className="py-2">Frontend, API, scanning, paper trading, AI</td>
                    </tr>
                    <tr className="border-b border-zinc-800/50">
                      <td className="py-2 pr-4 text-zinc-200">Frontend</td>
                      <td className="py-2 pr-4">Next.js 16, React 19, Tailwind</td>
                      <td className="py-2 pr-4 text-zinc-600">&mdash;</td>
                      <td className="py-2">Pre-built static HTML/CSS/JS served by Express</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4 text-zinc-200">Database</td>
                      <td className="py-2 pr-4">SQLite (WAL mode)</td>
                      <td className="py-2 pr-4 text-zinc-600">&mdash;</td>
                      <td className="py-2">
                        ~/.klaude/klaude.db — configs, portfolios, trades
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Everything runs on a single port. The Express server serves the
                pre-built static frontend, the REST API, and the WebSocket feed.
                Services communicate through Node.js EventEmitters, and all
                state changes are broadcast over WebSocket to the frontend.
                SQLite WAL mode handles concurrent read/write access without
                locking.
              </p>
            </section>

            {/* ───── Disclaimer ───── */}
            <section id="disclaimer" className="mb-6">
              <SectionHeading>What This Is Not</SectionHeading>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                <p className="text-sm text-red-300/90 leading-relaxed">
                  Klaude Suite is a{" "}
                  <span className="font-bold text-red-200">
                    paper trading sandbox
                  </span>
                  . It does not execute real blockchain transactions. No SOL
                  leaves your wallet. The Solana wallet connection is used for
                  identity only — not for signing transactions today.
                </p>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                This is intentional. The goal is to let your OpenClaw agent
                develop and demonstrate trading instincts in a safe environment
                before you ever consider giving it access to real funds. Watch
                the paper portfolio. Study the activity logs. Tune the limits.
                Then decide if and when to go live.
              </p>
            </section>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-zinc-600 font-mono mt-6">
          Works with any OpenClaw instance. Your keys never leave your machine.
        </p>
      </div>

      {/* Footer */}
      <footer className="relative z-10 py-8 px-4 border-t border-zinc-800 bg-[#0a0a0f]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold font-mono">
              <span className="text-amber-500">K</span>
              <span className="text-zinc-100">LAUDE</span>
              <span className="text-zinc-500 text-sm ml-2">for OpenClaw</span>
            </span>
          </div>
          <p className="text-xs font-mono text-zinc-600">
            Financial guardrails for the AI that actually does things.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/docs"
              className="text-xs font-mono text-amber-500 transition-colors"
            >
              Docs
            </Link>
            <a
              href="#"
              className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href="#"
              className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-1 h-6 bg-amber-500 rounded-full" />
      <h2 className="text-lg md:text-xl font-bold text-zinc-100">{children}</h2>
    </div>
  );
}
