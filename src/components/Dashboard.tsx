"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { NetworkToggle } from "./NetworkToggle";
import { useBackend } from "./BackendProvider";
import { useTokens, usePortfolio, useActivities, useTrade } from "@/hooks/useKlaude";
import { api, type Token as BackendToken, type Activity as BackendActivity } from "@/lib/api";

interface SafeConfig {
  maxTradeSize: number;
  dailyLimit: number;
  slippageCap: number;
  allowedTokens: string[];
  allowedDexes: string[];
  openclawUrl: string;
  autonomousMode: string;
  profitTaking?: {
    sellAt2x: number;
    sellAt5x: number;
    sellAt10x: number;
  };
}

interface Activity {
  id: string;
  timestamp: Date;
  type: "trade" | "scan" | "blocked" | "learning" | "alert" | "launch" | "snipe" | "exit" | "rug";
  message: string;
  amount?: number;
  profit?: number;
  multiplier?: string;
}

type RiskLevel = "safe" | "risky" | "danger";

interface NewToken {
  id: string;
  symbol: string;
  name: string;
  age: string;
  holders: number;
  liquidity: string;
  risk: RiskLevel;
  change: number;
}

const getTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};


interface DashboardProps {
  config: SafeConfig;
  onPause: () => void;
  isDemoMode?: boolean;
  walletAddress?: string;
  onDisconnect?: () => void;
}

export const Dashboard = ({ config, onPause, isDemoMode, walletAddress, onDisconnect }: DashboardProps) => {
  const { publicKey, disconnect } = useWallet();
  const displayAddress = walletAddress || publicKey?.toBase58() || "";
  const isDegen = config.autonomousMode === "degen";
  const { connected: backendConnected } = useBackend();

  // Backend hooks - only used when not in demo mode
  const { tokens: backendTokens } = useTokens(20, isDegen ? "pumpfun" : undefined);
  const { portfolio, stats } = usePortfolio(isDemoMode ? null : displayAddress, "devnet");
  const { activities: backendActivities } = useActivities(isDemoMode ? null : displayAddress, "devnet");
  const { executeTrade } = useTrade();

  // AI Trader state
  const [aiTraderRunning, setAiTraderRunning] = useState(false);

  // Start AI trader when connected (re-start on every backend reconnect)
  useEffect(() => {
    if (backendConnected && displayAddress && !isDemoMode) {
      api.startAITrader(displayAddress).then((result) => {
        if (result.success) {
          setAiTraderRunning(true);
          console.log("[Dashboard] AI Trader started");
        }
      }).catch((err) => {
        console.error("[Dashboard] Failed to start AI Trader:", err);
        setAiTraderRunning(false);
      });
    } else {
      setAiTraderRunning(false);
    }
  }, [backendConnected, displayAddress, isDemoMode]);

  const handleDisconnect = () => {
    if (isDemoMode && onDisconnect) {
      onDisconnect();
    } else {
      disconnect();
    }
  };

  // Use backend data when available
  const useBackendData = backendConnected && !!portfolio;

  const [isPaused, setIsPaused] = useState(false);
  const [dailySpent, setDailySpent] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [tradesCount, setTradesCount] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);

  // Degen-specific stats
  const [tokensSniped, setTokensSniped] = useState(0);
  const [winRate, setWinRate] = useState(0);
  const [bestTrade, setBestTrade] = useState("N/A");
  const [rugsAvoided, setRugsAvoided] = useState(0);
  const [newTokens, setNewTokens] = useState<NewToken[]>([]);

  // Sync backend data to local state
  useEffect(() => {
    if (useBackendData && stats) {
      setDailySpent(stats.dailySpent);
      setTotalProfit(stats.totalPnl);
      setTradesCount(portfolio?.totalTrades || 0);
      setWinRate(stats.winRate);
      setBestTrade(stats.bestTrade > 0 ? `${stats.bestTrade.toFixed(1)}x` : "N/A");
      setRugsAvoided(stats.rugsAvoided);
      // Count buy trades (snipes), not just open positions
      setTokensSniped(Math.floor((portfolio?.totalTrades || 0) / 2) || portfolio?.positions.length || 0);
    }
  }, [useBackendData, stats, portfolio]);

  // Sync backend activities
  useEffect(() => {
    if (useBackendData && backendActivities.length > 0) {
      setActivities(backendActivities.map(a => ({
        id: a.id,
        timestamp: new Date(a.createdAt),
        type: a.type as Activity["type"],
        message: a.message,
      })));
    }
  }, [useBackendData, backendActivities]);

  // Sync backend tokens to scanner
  useEffect(() => {
    if (backendConnected && backendTokens.length > 0) {
      setNewTokens(backendTokens.slice(0, 5).map(t => ({
        id: t.address, // Use address for trading
        symbol: t.symbol,
        name: t.name,
        age: getTimeAgo(new Date(t.createdAt)),
        holders: t.holders,
        liquidity: `${t.liquidity.toFixed(1)} SOL`,
        risk: t.risk as RiskLevel,
        change: Math.round(t.priceChange24h), // Already a percentage
      })));
    }
  }, [backendConnected, backendTokens]);


  const handlePause = () => {
    setIsPaused(true);
    onPause();
  };

  // Handle snipe button click
  const handleSnipe = async (token: NewToken) => {
    if (!backendConnected || !displayAddress) {
      console.log("Cannot snipe: backend not connected");
      return;
    }

    const snipeAmount = 0.1; // SOL
    const estimatedPrice = 0.00001; // Estimated price for paper trading

    const result = await executeTrade({
      walletAddress: displayAddress,
      tokenAddress: token.id,
      tokenSymbol: token.symbol,
      side: "buy",
      amount: snipeAmount,
      price: estimatedPrice,
      source: "manual",
    });

    if (result) {
      console.log("Snipe executed:", result);
    }
  };

  const getActivityStyle = (type: Activity["type"]) => {
    switch (type) {
      case "trade": return { color: "text-green-400", icon: "💰" };
      case "scan": return { color: "text-blue-400", icon: "🔍" };
      case "blocked": return { color: "text-red-400", icon: "🚫" };
      case "learning": return { color: "text-purple-400", icon: "🧠" };
      case "alert": return { color: "text-amber-400", icon: "⚡" };
      case "launch": return { color: "text-cyan-400", icon: "🆕" };
      case "snipe": return { color: "text-pink-400", icon: "🎯" };
      case "exit": return { color: "text-green-400", icon: "💰" };
      case "rug": return { color: "text-red-500", icon: "🚨" };
      default: return { color: "text-zinc-400", icon: "•" };
    }
  };

  const getRiskStyle = (risk: RiskLevel) => {
    switch (risk) {
      case "safe": return { color: "text-green-400", bg: "bg-green-500/20", icon: "🟢" };
      case "risky": return { color: "text-amber-400", bg: "bg-amber-500/20", icon: "🟡" };
      case "danger": return { color: "text-red-400", bg: "bg-red-500/20", icon: "🔴" };
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-6 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="font-mono text-lg">
              <span className="text-amber-500">K</span>
              <span className="text-zinc-100">LAUDE</span>
            </h1>
            <div className={`px-3 py-1 rounded-full text-xs font-mono ${isPaused ? "bg-red-500/20 text-red-400" : isDegen ? "bg-purple-500/20 text-purple-400" : "bg-green-500/20 text-green-400"}`}>
              {isPaused ? "PAUSED" : isDegen ? "🦧 HUNTING" : "TRADING"}
            </div>
            {isDegen ? (
              <span className="px-2 py-0.5 bg-red-500/20 rounded text-[10px] text-red-400 font-mono">HIGH RISK</span>
            ) : (
              <span className="text-xs text-zinc-500 font-mono capitalize">{config.autonomousMode} mode</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <NetworkToggle />
            {/* Backend status */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono ${
              backendConnected
                ? "bg-green-500/20 text-green-400"
                : "bg-zinc-500/20 text-zinc-400"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? "bg-green-500" : "bg-zinc-500"}`} />
              {backendConnected ? "LIVE" : "DEMO"}
            </div>
            {/* AI Trader status */}
            {aiTraderRunning && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                AI TRADING
              </div>
            )}
            {isDemoMode && (
              <span className="px-2 py-0.5 bg-amber-500/20 rounded text-[10px] text-amber-400 font-mono">PAPER</span>
            )}
            <span className="text-xs text-zinc-500 font-mono hidden sm:block">{displayAddress.slice(0, 8)}...</span>
            <button onClick={handleDisconnect} className="text-xs text-zinc-500 hover:text-zinc-300 font-mono">
              {isDemoMode ? "Exit Demo" : "Disconnect"}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className={`grid grid-cols-2 ${isDegen ? "md:grid-cols-4 lg:grid-cols-8" : "md:grid-cols-4"} gap-4 mb-6`}>
          <div className={`p-4 border rounded-xl ${isDegen ? "bg-purple-500/5 border-purple-500/30" : "bg-[#111118] border-zinc-800"}`}>
            <p className="text-xs text-zinc-500 font-mono mb-1">{isDegen ? "Snipes" : "Today's Trades"}</p>
            <p className="text-2xl font-bold text-zinc-100 font-mono">{isDegen ? tokensSniped : tradesCount}</p>
          </div>
          <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-500 font-mono mb-1">Daily Spent</p>
            <p className="text-2xl font-bold text-amber-500 font-mono">{dailySpent.toFixed(2)}</p>
            <p className="text-xs text-zinc-600">/ {config.dailyLimit} SOL</p>
          </div>
          <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-500 font-mono mb-1">Total Profit</p>
            <p className={`text-2xl font-bold font-mono ${totalProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
              {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(3)}
            </p>
            <p className="text-xs text-zinc-600">SOL</p>
          </div>
          {isDegen ? (
            <>
              <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
                <p className="text-xs text-zinc-500 font-mono mb-1">Win Rate</p>
                <p className={`text-2xl font-bold font-mono ${winRate >= 50 ? "text-green-500" : "text-red-500"}`}>{winRate.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-xs text-green-400 font-mono mb-1">Best Trade</p>
                <p className="text-2xl font-bold text-green-400 font-mono">{bestTrade}</p>
              </div>
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-xs text-red-400 font-mono mb-1">Rugs Avoided</p>
                <p className="text-2xl font-bold text-red-400 font-mono">{rugsAvoided}</p>
              </div>
              <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
                <p className="text-xs text-zinc-500 font-mono mb-1">Total Trades</p>
                <p className="text-2xl font-bold text-zinc-100 font-mono">{tradesCount}</p>
              </div>
              <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
                <p className="text-xs text-zinc-500 font-mono mb-1">Safe Status</p>
                <p className="text-2xl font-bold text-green-500 font-mono">✓</p>
              </div>
            </>
          ) : (
            <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
              <p className="text-xs text-zinc-500 font-mono mb-1">Safe Status</p>
              <p className="text-2xl font-bold text-green-500 font-mono">✓</p>
              <p className="text-xs text-zinc-600">All rules enforced</p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Token Scanner (Degen mode only) */}
          {isDegen && (
            <div className="lg:col-span-3 bg-purple-500/5 border border-purple-500/30 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-purple-500/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span className="font-mono text-sm text-purple-300">🔭 Token Scanner</span>
                  <span className="text-[10px] text-purple-400/60 ml-2">Pump.fun + Raydium</span>
                </div>
                <div className="flex gap-3 text-[10px] font-mono">
                  <span className="text-green-400">🟢 SAFE</span>
                  <span className="text-amber-400">🟡 RISKY</span>
                  <span className="text-red-400">🔴 DANGER</span>
                </div>
              </div>
              <div className="p-4">
                {newTokens.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-sm">
                    {backendConnected ? "Scanning for new tokens..." : "Connecting to backend..."}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    {newTokens.map((token) => {
                      const riskStyle = getRiskStyle(token.risk);
                      return (
                        <div
                          key={token.id}
                          className={`p-3 rounded-lg border ${riskStyle.bg} border-zinc-800 hover:border-zinc-600 transition-all`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono font-bold text-zinc-100">{token.symbol}</span>
                            <span className="text-xs">{riskStyle.icon}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate mb-2">{token.name}</p>
                          <div className="space-y-1 text-[10px]">
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Age</span>
                              <span className="text-zinc-300 font-mono">{token.age}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Holders</span>
                              <span className="text-zinc-300 font-mono">{token.holders}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Liquidity</span>
                              <span className="text-zinc-300 font-mono">{token.liquidity}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-zinc-500">Change</span>
                              <span className={`font-mono ${token.change >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {token.change >= 0 ? "+" : ""}{token.change}%
                              </span>
                            </div>
                          </div>
                          {token.risk !== "danger" && (
                            <button
                              onClick={() => handleSnipe(token)}
                              disabled={isPaused || !backendConnected}
                              className="w-full mt-2 py-1.5 bg-pink-500/20 hover:bg-pink-500/30 border border-pink-500/30 text-pink-400 text-[10px] font-mono rounded transition-all disabled:opacity-50"
                            >
                              🎯 Snipe 0.1 SOL
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Activity feed */}
          <div className={`${isDegen ? "lg:col-span-2" : "lg:col-span-2"} bg-[#111118] border border-zinc-800 rounded-xl overflow-hidden`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                {!isPaused && <div className={`w-2 h-2 rounded-full ${isDegen ? "bg-purple-500" : "bg-green-500"} animate-pulse`} />}
                <span className="font-mono text-sm text-zinc-300">Live Activity</span>
              </div>
              <div className="flex gap-3 text-[10px] font-mono">
                {isDegen ? (
                  <>
                    <span className="text-cyan-400">NEW</span>
                    <span className="text-pink-400">SNIPE</span>
                    <span className="text-green-400">EXIT</span>
                    <span className="text-red-400">RUG</span>
                  </>
                ) : (
                  <>
                    <span className="text-green-400">TRADE</span>
                    <span className="text-blue-400">SCAN</span>
                    <span className="text-purple-400">LEARN</span>
                    <span className="text-red-400">BLOCK</span>
                  </>
                )}
              </div>
            </div>

            <div className="h-[400px] overflow-y-auto p-4">
              {activities.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-sm">
                  {isPaused ? "Trading paused" : "Starting up..."}
                </div>
              ) : (
                activities.map((activity) => {
                  const style = getActivityStyle(activity.type);
                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 mb-3 pb-3 border-b border-zinc-800/50 last:border-0"
                    >
                      <span className="text-xs text-zinc-600 font-mono shrink-0">
                        {activity.timestamp.toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                      <span>{style.icon}</span>
                      <span className={`text-sm ${style.color}`}>{activity.message}</span>
                      {activity.multiplier && (
                        <span className="ml-auto text-xs text-purple-400 font-mono shrink-0">
                          {activity.multiplier}
                        </span>
                      )}
                      {activity.profit && (
                        <span className={`${activity.multiplier ? "" : "ml-auto"} text-xs text-green-500 font-mono shrink-0`}>
                          +{activity.profit.toFixed(3)} SOL
                        </span>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Connected claw */}
            <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl">
              <p className="text-xs text-zinc-500 font-mono mb-3">CONNECTED OPENCLAW</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl">🦞</span>
                <div>
                  <p className="text-zinc-200 font-mono font-bold">Molty</p>
                  <p className="text-xs text-zinc-500">{config.openclawUrl ? (config.openclawUrl.includes("localhost") ? "Local instance" : config.openclawUrl) : "Not configured"}</p>
                </div>
                <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-2">Active skills:</p>
                <div className="flex flex-wrap gap-1">
                  {["klaude-trader", "smart-safe", "dex-agg"].map(skill => (
                    <span key={skill} className="px-2 py-0.5 bg-amber-500/20 rounded text-[10px] text-amber-400 font-mono">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Safe rules */}
            <div className={`p-4 border rounded-xl ${isDegen ? "bg-purple-500/5 border-purple-500/30" : "bg-[#111118] border-zinc-800"}`}>
              <p className={`text-xs font-mono mb-3 ${isDegen ? "text-purple-400" : "text-zinc-500"}`}>
                {isDegen ? "🦧 DEGEN RULES" : "SAFE RULES"}
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Max trade</span>
                  <span className="text-zinc-300 font-mono">{config.maxTradeSize} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Daily limit</span>
                  <span className="text-zinc-300 font-mono">{config.dailyLimit} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Slippage</span>
                  <span className="text-zinc-300 font-mono">{config.slippageCap}%</span>
                </div>
                {isDegen && config.profitTaking && (
                  <>
                    <div className="pt-2 mt-2 border-t border-zinc-800">
                      <p className="text-purple-400 font-mono mb-2">AUTO EXITS:</p>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">At 2x</span>
                      <span className="text-green-400 font-mono">sell {config.profitTaking.sellAt2x}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">At 5x</span>
                      <span className="text-green-400 font-mono">sell {config.profitTaking.sellAt5x}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">At 10x</span>
                      <span className="text-green-400 font-mono">sell {config.profitTaking.sellAt10x}%</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between pt-2">
                  <span className="text-zinc-500">Tokens</span>
                  <span className="text-green-400 font-mono text-[10px]">{config.allowedTokens.slice(0, 3).join(", ")}{config.allowedTokens.length > 3 ? "..." : ""}</span>
                </div>
              </div>
            </div>

            {/* Swarm (future) */}
            <div className="p-4 bg-[#111118] border border-zinc-800 rounded-xl opacity-60">
              <p className="text-xs text-zinc-500 font-mono mb-3">SWARM MODE</p>
              <p className="text-xs text-zinc-600">Connect more OpenClaws to share learnings and coordinate trades.</p>
              <button className="w-full mt-3 py-2 border border-dashed border-zinc-700 rounded text-xs text-zinc-500 font-mono">
                + Add Claw (Coming Soon)
              </button>
            </div>

            {/* Controls */}
            <button
              onClick={handlePause}
              disabled={isPaused}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 font-mono text-sm rounded-xl disabled:opacity-50"
            >
              {isPaused ? "Paused" : "⏸ Pause Trading"}
            </button>
            {isPaused && (
              <button
                onClick={() => setIsPaused(false)}
                className="w-full py-3 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-500 font-mono text-sm rounded-xl"
              >
                ▶ Resume Trading
              </button>
            )}
          </div>
        </div>

        {/* Active Positions Panel */}
        {isDegen && (
          <div className="mt-6 bg-[#111118] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                <span className="font-mono text-sm text-zinc-300">Active Positions</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {portfolio?.positions?.length || 0} open
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Refreshing every 10s
              </div>
            </div>

            {(!portfolio?.positions || portfolio.positions.length === 0) ? (
              <div className="p-8 text-center">
                {dailySpent >= config.dailyLimit ? (
                  <>
                    <p className="text-amber-400 font-mono text-sm mb-2">Daily limit reached ({dailySpent.toFixed(2)}/{config.dailyLimit} SOL)</p>
                    <p className="text-zinc-600 text-xs mb-4">AI trading paused until limit resets</p>
                    <button
                      onClick={async () => {
                        if (displayAddress) {
                          await api.resetPortfolio(displayAddress, "devnet");
                          window.location.reload();
                        }
                      }}
                      className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 text-xs font-mono rounded transition-all"
                    >
                      Reset Portfolio (Start Fresh with 10 SOL)
                    </button>
                  </>
                ) : (
                  <p className="text-zinc-600 font-mono text-sm">No active positions. AI is hunting for opportunities...</p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {portfolio.positions.map((pos) => {
                  const pnlPercent = pos.pnlPercent || 0;
                  const isProfit = pnlPercent >= 0;
                  const multiplier = 1 + (pnlPercent / 100);

                  return (
                    <div key={pos.id} className="p-4 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${
                            isProfit ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                          }`}>
                            {pos.tokenSymbol?.replace("$", "").slice(0, 2) || "??"}
                          </div>
                          <div>
                            <p className="font-mono font-bold text-zinc-100">{pos.tokenSymbol}</p>
                            <p className="text-[10px] text-zinc-500">
                              {pos.quantity?.toLocaleString()} tokens @ ${pos.avgEntryPrice?.toFixed(8)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className={`font-mono font-bold text-lg ${isProfit ? "text-green-400" : "text-red-400"}`}>
                            {isProfit ? "+" : ""}{pnlPercent.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-zinc-500 font-mono">
                            {multiplier.toFixed(2)}x · {pos.pnl?.toFixed(4) || "0.0000"} SOL
                          </p>
                        </div>
                      </div>

                      {/* Progress bar to next exit */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                          <span>Entry</span>
                          <span>2x ({config.profitTaking?.sellAt2x || 25}%)</span>
                          <span>5x ({config.profitTaking?.sellAt5x || 50}%)</span>
                          <span>10x</span>
                        </div>
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${isProfit ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(Math.max((multiplier - 1) / 9 * 100, 0), 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Portfolio summary */}
            {portfolio?.positions && portfolio.positions.length > 0 && (
              <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Total Invested</span>
                  <span className="text-zinc-300 font-mono">
                    {portfolio.positions.reduce((sum, p) => sum + (p.entryValue || 0), 0).toFixed(2)} SOL
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-zinc-500">Unrealized P&L</span>
                  <span className={`font-mono font-bold ${
                    (stats?.totalPnl || 0) >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {(stats?.totalPnl || 0) >= 0 ? "+" : ""}{(stats?.totalPnl || 0).toFixed(4)} SOL
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
