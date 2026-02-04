"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { NetworkToggle } from "./NetworkToggle";

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

const TOKENS = [
  { symbol: "SOL", name: "Solana", selected: true },
  { symbol: "USDC", name: "USD Coin", selected: true },
  { symbol: "USDT", name: "Tether", selected: false },
  { symbol: "JUP", name: "Jupiter", selected: false },
  { symbol: "RAY", name: "Raydium", selected: false },
  { symbol: "BONK", name: "Bonk", selected: false },
  { symbol: "WIF", name: "dogwifhat", selected: false },
  { symbol: "POPCAT", name: "Popcat", selected: false },
  { symbol: "MEW", name: "cat in a dogs world", selected: false },
  { symbol: "NEW", name: "New Launches", selected: false, isDegen: true },
];

const DEXES = [
  { id: "jupiter", name: "Jupiter", selected: true },
  { id: "raydium", name: "Raydium", selected: true },
  { id: "orca", name: "Orca", selected: false },
  { id: "pumpfun", name: "Pump.fun", selected: false, isDegen: true },
  { id: "meteora", name: "Meteora", selected: false },
];

const AUTONOMOUS_MODES = [
  { id: "conservative", name: "Conservative", desc: "Only trades when you ask or on scheduled DCA", icon: "🛡️" },
  { id: "moderate", name: "Moderate", desc: "Trades on clear opportunities (>5% moves)", icon: "⚖️" },
  { id: "aggressive", name: "Aggressive", desc: "Actively hunts alpha, arbitrage, and dips", icon: "🎯" },
  { id: "degen", name: "Degen", desc: "Snipes new launches, hunts 100x gems, quick profit-taking", icon: "🦧", isDegen: true },
];

interface SmartSafeProps {
  onComplete: (config: SafeConfig) => void;
  onBack: () => void;
  isDemoMode?: boolean;
  walletAddress?: string;
}

export const SmartSafe = ({ onComplete, onBack, isDemoMode, walletAddress }: SmartSafeProps) => {
  const { publicKey } = useWallet();
  const displayAddress = walletAddress || publicKey?.toBase58() || "Not connected";
  const [step, setStep] = useState(1);

  // Step 1: OpenClaw connection
  const [openclawUrl, setOpenclawUrl] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [clawName, setClawName] = useState("");
  const [clawSkills, setClawSkills] = useState<string[]>([]);

  // Step 2: Rules
  const [maxTradeSize, setMaxTradeSize] = useState("0.5");
  const [dailyLimit, setDailyLimit] = useState("2");
  const [slippageCap, setSlippageCap] = useState("1");
  const [tokens, setTokens] = useState(TOKENS);
  const [dexes, setDexes] = useState(DEXES);
  const [autonomousMode, setAutonomousMode] = useState("moderate");

  // Profit-taking thresholds (for degen mode)
  const [sellAt2x, setSellAt2x] = useState("25");
  const [sellAt5x, setSellAt5x] = useState("50");
  const [sellAt10x, setSellAt10x] = useState("100");

  const isDegen = autonomousMode === "degen";

  // Step 3: Deploy
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);

  const handleConnectClaw = async () => {
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsConnected(true);
    setClawName("Molty");
    setClawSkills(["email-manager", "flight-booker", "coupon-finder", "web-browser"]);
    setIsConnecting(false);
  };

  const toggleToken = (symbol: string) => {
    setTokens(tokens.map(t => t.symbol === symbol ? { ...t, selected: !t.selected } : t));
  };

  const toggleDex = (id: string) => {
    setDexes(dexes.map(d => d.id === id ? { ...d, selected: !d.selected } : d));
  };

  const handleModeChange = (modeId: string) => {
    setAutonomousMode(modeId);
    if (modeId === "degen") {
      // Auto-enable degen tokens and dexes
      setTokens(prev => prev.map(t => ({ ...t, selected: t.selected || (t as typeof t & { isDegen?: boolean }).isDegen === true })));
      setDexes(prev => prev.map(d => ({ ...d, selected: d.selected || (d as typeof d & { isDegen?: boolean }).isDegen === true })));
      // Increase slippage for degen mode
      setSlippageCap("5");
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployStep(1);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setDeployStep(2);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setDeployStep(3);
    await new Promise(resolve => setTimeout(resolve, 1200));
    setDeployStep(4);
    await new Promise(resolve => setTimeout(resolve, 800));
    setDeployStep(5);
    await new Promise(resolve => setTimeout(resolve, 500));

    onComplete({
      maxTradeSize: parseFloat(maxTradeSize),
      dailyLimit: parseFloat(dailyLimit),
      slippageCap: parseFloat(slippageCap),
      allowedTokens: tokens.filter(t => t.selected).map(t => t.symbol),
      allowedDexes: dexes.filter(d => d.selected).map(d => d.id),
      openclawUrl,
      autonomousMode,
      ...(isDegen && {
        profitTaking: {
          sellAt2x: parseInt(sellAt2x),
          sellAt5x: parseInt(sellAt5x),
          sellAt10x: parseInt(sellAt10x),
        },
      }),
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 font-mono text-sm">
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <NetworkToggle />
            {isDemoMode && (
              <span className="px-2 py-0.5 bg-amber-500/20 rounded text-[10px] text-amber-400 font-mono">DEMO</span>
            )}
            <span className="font-mono text-xs text-zinc-500 hidden sm:block">
              {displayAddress.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-amber-500" : "bg-zinc-800"}`} />
          ))}
        </div>

        {/* Step 1: Connect */}
        {step === 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">Connect to your OpenClaw</h1>
              <p className="text-zinc-500 text-sm">We'll install the trading skill and connect it to your Safe.</p>
            </div>

            <div className="p-5 bg-[#111118] border border-zinc-800 rounded-xl">
              <label className="block text-xs text-zinc-500 font-mono mb-2">Gateway URL</label>
              <input
                type="text"
                value={openclawUrl}
                onChange={(e) => setOpenclawUrl(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-zinc-700 rounded-lg px-4 py-3 font-mono text-sm text-zinc-200 focus:border-amber-500 focus:outline-none mb-3"
              />
              <p className="text-xs text-zinc-600 mb-4">
                Run <code className="text-amber-500">openclaw status</code> to find your gateway URL
              </p>

              {!isConnected ? (
                <button
                  onClick={handleConnectClaw}
                  disabled={isConnecting}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 text-black font-mono text-sm font-bold rounded-lg"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              ) : (
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">🦞</span>
                    <div>
                      <p className="text-green-400 font-mono font-bold">{clawName}</p>
                      <p className="text-xs text-green-500/70">{openclawUrl}</p>
                    </div>
                    <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <div className="pt-3 border-t border-green-500/20">
                    <p className="text-xs text-zinc-500 mb-2">Current skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {clawSkills.map(skill => (
                        <span key={skill} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400 font-mono">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {isConnected && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400 font-mono mb-2">WHAT WE'LL ADD:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-amber-500/20 rounded text-xs text-amber-300 font-mono">klaude-trader</span>
                  <span className="px-2 py-1 bg-amber-500/20 rounded text-xs text-amber-300 font-mono">smart-safe</span>
                  <span className="px-2 py-1 bg-amber-500/20 rounded text-xs text-amber-300 font-mono">dex-aggregator</span>
                </div>
                <p className="text-xs text-amber-300/70 mt-2">
                  {clawName} will learn to trade on Solana DEXes, with all transactions secured by your Smart Safe.
                </p>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!isConnected}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-mono text-sm rounded-lg"
            >
              Continue →
            </button>
          </motion.div>
        )}

        {/* Step 2: Configure */}
        {step === 2 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">Configure Trading Rules</h1>
              <p className="text-zinc-500 text-sm">{clawName} will trade autonomously within these limits.</p>
            </div>

            {/* Autonomous Mode */}
            <div className="p-5 bg-[#111118] border border-zinc-800 rounded-xl">
              <label className="block text-xs text-zinc-500 font-mono mb-3">Trading Style</label>
              <div className="space-y-2">
                {AUTONOMOUS_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => handleModeChange(mode.id)}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      autonomousMode === mode.id
                        ? mode.id === "degen" ? "border-purple-500 bg-purple-500/10" : "border-amber-500 bg-amber-500/10"
                        : "border-zinc-700 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{mode.icon}</span>
                      <p className={`text-sm font-medium ${
                        autonomousMode === mode.id
                          ? mode.id === "degen" ? "text-purple-400" : "text-amber-400"
                          : "text-zinc-300"
                      }`}>
                        {mode.name}
                      </p>
                      {mode.id === "degen" && (
                        <span className="ml-auto px-2 py-0.5 bg-purple-500/20 rounded text-[10px] text-purple-400 font-mono">HIGH RISK</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 ml-7">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Profit-Taking (Degen mode only) */}
            {isDegen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-5 bg-purple-500/5 border border-purple-500/30 rounded-xl"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">🎰</span>
                  <label className="text-xs text-purple-400 font-mono">AUTO PROFIT-TAKING</label>
                </div>
                <p className="text-xs text-zinc-500 mb-4">Automatically sell portions when tokens moon.</p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">At 2x (double)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={sellAt2x}
                        onChange={(e) => setSellAt2x(e.target.value)}
                        className="w-16 bg-[#0a0a0f] border border-purple-500/30 rounded px-2 py-1 font-mono text-sm text-zinc-200 text-center"
                      />
                      <span className="text-xs text-zinc-500">% sell</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">At 5x</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={sellAt5x}
                        onChange={(e) => setSellAt5x(e.target.value)}
                        className="w-16 bg-[#0a0a0f] border border-purple-500/30 rounded px-2 py-1 font-mono text-sm text-zinc-200 text-center"
                      />
                      <span className="text-xs text-zinc-500">% sell</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">At 10x</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={sellAt10x}
                        onChange={(e) => setSellAt10x(e.target.value)}
                        className="w-16 bg-[#0a0a0f] border border-purple-500/30 rounded px-2 py-1 font-mono text-sm text-zinc-200 text-center"
                      />
                      <span className="text-xs text-zinc-500">% sell</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-purple-400/60 mt-4 font-mono">
                  Example: Buy 0.1 SOL of $NEWCOIN → at 2x, sell {sellAt2x}% → at 5x, sell {sellAt5x}% → at 10x, sell {sellAt10x}%
                </p>
              </motion.div>
            )}

            {/* Limits */}
            <div className="p-5 bg-[#111118] border border-zinc-800 rounded-xl space-y-4">
              <label className="block text-xs text-zinc-500 font-mono">Safety Limits</label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Max per trade</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={maxTradeSize}
                      onChange={(e) => setMaxTradeSize(e.target.value)}
                      className="flex-1 bg-[#0a0a0f] border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-200"
                    />
                    <span className="text-zinc-500 text-sm">SOL</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 mb-1">Daily limit</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={dailyLimit}
                      onChange={(e) => setDailyLimit(e.target.value)}
                      className="flex-1 bg-[#0a0a0f] border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-200"
                    />
                    <span className="text-zinc-500 text-sm">SOL</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-500 mb-1">Max slippage</p>
                <div className="flex items-center gap-2 w-1/2">
                  <input
                    type="number"
                    value={slippageCap}
                    onChange={(e) => setSlippageCap(e.target.value)}
                    className="flex-1 bg-[#0a0a0f] border border-zinc-700 rounded px-3 py-2 font-mono text-sm text-zinc-200"
                  />
                  <span className="text-zinc-500 text-sm">%</span>
                </div>
              </div>
            </div>

            {/* Tokens & DEXes */}
            <div className="p-5 bg-[#111118] border border-zinc-800 rounded-xl space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 font-mono mb-2">Allowed Tokens</label>
                <div className="flex flex-wrap gap-2">
                  {tokens.map((t) => (
                    <button
                      key={t.symbol}
                      onClick={() => toggleToken(t.symbol)}
                      className={`px-3 py-1.5 rounded border text-xs font-mono ${
                        t.selected ? "border-green-500 bg-green-500/10 text-green-400" : "border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {t.symbol}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 font-mono mb-2">Allowed DEXes</label>
                <div className="flex flex-wrap gap-2">
                  {dexes.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => toggleDex(d.id)}
                      className={`px-3 py-1.5 rounded border text-xs font-mono ${
                        d.selected ? "border-green-500 bg-green-500/10 text-green-400" : "border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 border border-zinc-700 text-zinc-400 font-mono text-sm rounded-lg">
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 py-3 bg-amber-500 text-black font-mono text-sm font-bold rounded-lg">
                Review →
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Deploy */}
        {step === 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-zinc-100 mb-2">Ready to Deploy</h1>
              <p className="text-zinc-500 text-sm">Here's what we're setting up for {clawName}.</p>
            </div>

            {/* Summary */}
            <div className={`p-5 border rounded-xl ${isDegen ? "bg-purple-500/5 border-purple-500/30" : "bg-[#111118] border-zinc-800"}`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                  <span className="text-zinc-500 text-sm">OpenClaw</span>
                  <span className="text-zinc-200 font-mono">{clawName} @ {openclawUrl}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                  <span className="text-zinc-500 text-sm">Trading Style</span>
                  <span className={`font-mono capitalize ${isDegen ? "text-purple-400" : "text-amber-400"}`}>
                    {isDegen && "🦧 "}{autonomousMode}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                  <span className="text-zinc-500 text-sm">Max per trade</span>
                  <span className="text-zinc-200 font-mono">{maxTradeSize} SOL</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                  <span className="text-zinc-500 text-sm">Daily limit</span>
                  <span className="text-zinc-200 font-mono">{dailyLimit} SOL</span>
                </div>
                {isDegen && (
                  <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                    <span className="text-zinc-500 text-sm">Profit-taking</span>
                    <span className="text-purple-400 font-mono text-xs">{sellAt2x}% @2x → {sellAt5x}% @5x → {sellAt10x}% @10x</span>
                  </div>
                )}
                <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                  <span className="text-zinc-500 text-sm">Tokens</span>
                  <span className="text-green-400 font-mono text-xs">{tokens.filter(t => t.selected).map(t => t.symbol).join(", ")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-sm">DEXes</span>
                  <span className="text-green-400 font-mono text-xs">{dexes.filter(d => d.selected).map(d => d.name).join(", ")}</span>
                </div>
              </div>
            </div>

            {isDegen && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-xs text-red-400 font-mono flex items-center gap-2">
                  <span>⚠️</span>
                  DEGEN MODE: High risk. Your claw will snipe new launches and trade volatile tokens. Only risk what you can afford to lose.
                </p>
              </div>
            )}

            {/* Deployment steps */}
            <div className="p-5 bg-[#111118] border border-zinc-800 rounded-xl">
              <p className="text-xs text-zinc-500 font-mono mb-4">DEPLOYMENT STEPS:</p>
              <div className="space-y-3 text-sm">
                <div className={`flex items-center gap-3 ${deployStep >= 1 ? (deployStep > 1 ? "text-green-400" : "text-amber-400") : "text-zinc-600"}`}>
                  {deployStep > 1 ? "✓" : deployStep === 1 ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "○"}
                  <span>Create Smart Safe on Solana</span>
                </div>
                <div className={`flex items-center gap-3 ${deployStep >= 2 ? (deployStep > 2 ? "text-green-400" : "text-amber-400") : "text-zinc-600"}`}>
                  {deployStep > 2 ? "✓" : deployStep === 2 ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "○"}
                  <span>Install klaude-trader skill on {clawName}</span>
                </div>
                <div className={`flex items-center gap-3 ${deployStep >= 3 ? (deployStep > 3 ? "text-green-400" : "text-amber-400") : "text-zinc-600"}`}>
                  {deployStep > 3 ? "✓" : deployStep === 3 ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "○"}
                  <span>Configure DEX aggregators</span>
                </div>
                <div className={`flex items-center gap-3 ${deployStep >= 4 ? (deployStep > 4 ? "text-green-400" : "text-amber-400") : "text-zinc-600"}`}>
                  {deployStep > 4 ? "✓" : deployStep === 4 ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : "○"}
                  <span>Enable autonomous trading</span>
                </div>
                <div className={`flex items-center gap-3 ${deployStep >= 5 ? "text-green-400" : "text-zinc-600"}`}>
                  {deployStep >= 5 ? "✓" : "○"}
                  <span>Ready!</span>
                </div>
              </div>
            </div>

            {!isDeploying && (
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 border border-zinc-700 text-zinc-400 font-mono text-sm rounded-lg">
                  ← Back
                </button>
                <button onClick={handleDeploy} className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-black font-mono text-sm font-bold rounded-lg">
                  Deploy & Activate
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
