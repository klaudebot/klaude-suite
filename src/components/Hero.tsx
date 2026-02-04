"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";
import { NetworkToggle } from "./NetworkToggle";

const ASCII_LOGO = `
╦╔═╦  ╔═╗╦ ╦╔╦╗╔═╗
╠╩╗║  ╠═╣║ ║ ║║║╣
╩ ╩╩═╝╩ ╩╚═╝═╩╝╚═╝
FOR OPENCLAW 🦞`;

interface HeroProps {
  onGetStarted?: () => void;
  onTryDemo?: () => void;
  isDemoMode?: boolean;
}

export const Hero = ({ onGetStarted, onTryDemo, isDemoMode }: HeroProps) => {
  const { connected } = useWallet();
  const isConnected = connected || isDemoMode;
  const [activeExample, setActiveExample] = useState(0);

  const examples = [
    { before: "Book me a flight to Tokyo", after: "Book me a flight + swap 2 SOL to USDC for the trip" },
    { before: "Find me the best deal on AirPods", after: "Find the deal + buy the dip on SOL while you're at it" },
    { before: "Summarize my emails", after: "Summarize emails + DCA $10 into ETH daily" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveExample((i) => (i + 1) % examples.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [examples.length]);

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-[#0a0a0f]">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(39,39,42,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(39,39,42,0.15)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-4xl mx-auto">
        {/* Main card */}
        <div className="bg-[#0c0c12] border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#111118] border-b border-zinc-800">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <span className="text-xs font-mono text-zinc-500 hidden sm:block">klaude-suite // openclaw skill</span>
            <NetworkToggle />
          </div>

          <div className="p-6 md:p-8">
            {/* Logo */}
            <pre
              className="text-amber-500 text-[10px] sm:text-xs leading-tight mb-6 whitespace-pre"
              style={{ fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace' }}
            >
              {ASCII_LOGO}
            </pre>

            {/* Main headline */}
            <h1 className="text-2xl md:text-4xl font-bold text-zinc-100 mb-4 leading-tight">
              Teach your OpenClaw to <span className="text-amber-500">trade</span>.
              <br />
              <span className="text-zinc-400">Autonomously. Securely.</span>
            </h1>

            <p className="text-zinc-400 text-sm md:text-base mb-8 max-w-2xl">
              Your claw already handles emails, bookings, and browsing.
              Klaude adds autonomous trading—with a Solana vault that enforces your rules.
            </p>

            {/* Before/After example */}
            <div className="p-4 bg-[#111118] border border-zinc-800 rounded-lg mb-8">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-3">
                Your OpenClaw today → With Klaude
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-1">Before</p>
                  <p className="text-sm text-zinc-300 font-mono">"{examples[activeExample].before}"</p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded border border-amber-500/30">
                  <p className="text-xs text-amber-500 mb-1">After</p>
                  <p className="text-sm text-amber-200 font-mono">"{examples[activeExample].after}"</p>
                </div>
              </div>
            </div>

            {/* What Klaude adds */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 border border-zinc-800 rounded-lg">
                <div className="text-xl mb-2">🧠</div>
                <h3 className="text-sm font-bold text-zinc-200 mb-1">Trading Skills</h3>
                <p className="text-xs text-zinc-500">
                  Installs as an OpenClaw skill. Teaches your claw to swap, DCA, and hunt alpha on Solana DEXes.
                </p>
              </div>
              <div className="p-4 border border-zinc-800 rounded-lg">
                <div className="text-xl mb-2">🔐</div>
                <h3 className="text-sm font-bold text-zinc-200 mb-1">Smart Safe</h3>
                <p className="text-xs text-zinc-500">
                  Solana vault with your rules baked in. Max trade size, daily limits, allowed tokens. Can't be overridden.
                </p>
              </div>
              <div className="p-4 border border-zinc-800 rounded-lg">
                <div className="text-xl mb-2">🦞</div>
                <h3 className="text-sm font-bold text-zinc-200 mb-1">Swarm Mode</h3>
                <p className="text-xs text-zinc-500">
                  Run multiple OpenClaws. They share learnings, spot opportunities together. One Safe executes.
                </p>
              </div>
            </div>

            {/* How it stays autonomous */}
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg mb-8">
              <p className="text-xs text-green-400 font-mono uppercase tracking-wider mb-2">Fully Autonomous</p>
              <p className="text-sm text-green-300/80">
                You set the rules once. Then your claw trades 24/7 without asking—swapping when it sees opportunity,
                DCA'ing on schedule, hunting arbitrage. All within your limits. Pause anytime.
              </p>
            </div>

            {/* Example flow */}
            <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg mb-8">
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-wider mb-3">Example: What happens after setup</p>
              <div className="space-y-2 text-xs font-mono">
                <p className="text-zinc-500"><span className="text-blue-400">[3:42 AM]</span> <span className="text-zinc-400">Molty spots SOL dip to $142</span></p>
                <p className="text-zinc-500"><span className="text-purple-400">[3:42 AM]</span> <span className="text-zinc-400">Checks Safe: 0.5 SOL swap allowed? ✓</span></p>
                <p className="text-zinc-500"><span className="text-green-400">[3:42 AM]</span> <span className="text-zinc-400">Executes via Jupiter: 0.5 SOL → 71.2 USDC</span></p>
                <p className="text-zinc-500"><span className="text-amber-400">[3:42 AM]</span> <span className="text-zinc-400">You wake up to a Telegram: "Bought the dip for you 🦞"</span></p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {!isConnected ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <WalletButton />
                    <span className="text-zinc-600">or</span>
                    <button
                      onClick={onTryDemo}
                      className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-mono text-sm rounded-lg transition-all"
                    >
                      Try Demo →
                    </button>
                  </div>
                  <span className="text-xs text-zinc-600 font-mono">// no wallet needed to explore</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={onGetStarted}
                    className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black font-mono text-sm font-bold uppercase tracking-wider rounded-lg transition-all hover:shadow-[0_0_30px_rgba(217,119,6,0.3)]"
                  >
                    Set Up Trading →
                  </button>
                  {isDemoMode && (
                    <span className="px-2 py-1 bg-amber-500/20 rounded text-xs text-amber-400 font-mono">DEMO MODE</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-zinc-600 font-mono mt-6">
          Works with any OpenClaw instance. Your keys never leave your machine.
        </p>
      </div>
    </section>
  );
};
