"use client";

import { useNetwork, useAirdrop } from "./WalletProvider";
import { useWallet } from "@solana/wallet-adapter-react";

export const NetworkToggle = () => {
  const { network, setNetwork, isDevnet } = useNetwork();
  const { connected } = useWallet();
  const { requestAirdrop, isAirdropping, airdropError, airdropSuccess, canAirdrop } = useAirdrop();

  return (
    <div className="flex items-center gap-3">
      {/* Network Toggle */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
        <button
          onClick={() => setNetwork("devnet")}
          className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
            isDevnet
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          DEVNET
        </button>
        <button
          onClick={() => setNetwork("mainnet-beta")}
          className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
            !isDevnet
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          MAINNET
        </button>
      </div>

      {/* Airdrop Button (devnet only, when connected) */}
      {isDevnet && connected && (
        <button
          onClick={requestAirdrop}
          disabled={isAirdropping || !canAirdrop}
          className={`px-3 py-1.5 text-[10px] font-mono rounded-lg border transition-all ${
            airdropSuccess
              ? "bg-green-500/20 border-green-500/30 text-green-400"
              : airdropError
              ? "bg-red-500/20 border-red-500/30 text-red-400"
              : "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30"
          } disabled:opacity-50`}
        >
          {isAirdropping ? (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
              Airdropping...
            </span>
          ) : airdropSuccess ? (
            "Got 1 SOL!"
          ) : airdropError ? (
            "Try Again"
          ) : (
            "Get Test SOL"
          )}
        </button>
      )}

      {/* Devnet Indicator */}
      {isDevnet && (
        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-400 font-mono">
          TEST MODE
        </span>
      )}
    </div>
  );
};
