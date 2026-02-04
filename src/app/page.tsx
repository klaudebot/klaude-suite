"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { Hero, SmartSafe, Dashboard } from "@/components";

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

type AppView = "landing" | "setup" | "dashboard";

// Demo wallet address
const DEMO_WALLET = "DeMo...WaLLeT";

export default function Home() {
  const { connected, publicKey } = useWallet();
  const [view, setView] = useState<AppView>("landing");
  const [safeConfig, setSafeConfig] = useState<SafeConfig | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const isConnected = connected || isDemoMode;
  const displayAddress = isDemoMode ? DEMO_WALLET : publicKey?.toBase58();

  const handleGetStarted = () => {
    setView("setup");
  };

  const handleTryDemo = () => {
    setIsDemoMode(true);
  };

  const handleSetupComplete = (config: SafeConfig) => {
    setSafeConfig(config);
    setView("dashboard");
  };

  const handlePause = () => {
    console.log("Safe paused");
  };

  const handleDisconnectDemo = () => {
    setIsDemoMode(false);
    setView("landing");
    setSafeConfig(null);
  };

  // Not connected and not demo - show landing
  if (!isConnected) {
    return (
      <main className="min-h-screen bg-[#0a0a0f]">
        <Hero onTryDemo={handleTryDemo} />
        <Footer />
      </main>
    );
  }

  // Connected or demo - show appropriate view
  if (view === "setup") {
    return (
      <main className="min-h-screen bg-[#0a0a0f]">
        <SmartSafe
          onComplete={handleSetupComplete}
          onBack={() => setView("landing")}
          isDemoMode={isDemoMode}
          walletAddress={displayAddress}
        />
      </main>
    );
  }

  if (view === "dashboard" && safeConfig) {
    return (
      <main className="min-h-screen bg-[#0a0a0f]">
        <Dashboard
          config={safeConfig}
          onPause={handlePause}
          isDemoMode={isDemoMode}
          walletAddress={displayAddress}
          onDisconnect={handleDisconnectDemo}
        />
        <Footer />
      </main>
    );
  }

  // Default: landing with setup button (connected state)
  return (
    <main className="min-h-screen bg-[#0a0a0f]">
      <Hero onGetStarted={handleGetStarted} isDemoMode={isDemoMode} onTryDemo={handleTryDemo} />
      <Footer />
    </main>
  );
}

function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-zinc-800 bg-[#0a0a0f]">
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
          <Link href="/docs" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
            Docs
          </Link>
          <a href="#" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
            GitHub
          </a>
          <a href="#" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
            Discord
          </a>
        </div>
      </div>
    </footer>
  );
}
