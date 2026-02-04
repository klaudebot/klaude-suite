"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useCallback, useMemo } from "react";

export const WalletButton = () => {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  const base58 = useMemo(() => publicKey?.toBase58(), [publicKey]);
  const displayAddress = useMemo(() => {
    if (!base58) return null;
    return `${base58.slice(0, 4)}...${base58.slice(-4)}`;
  }, [base58]);

  const handleClick = useCallback(() => {
    if (!connected) {
      setVisible(true);
    }
  }, [connected, setVisible]);

  if (connected && displayAddress) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 px-4 py-2 bg-[#111118] border border-zinc-800 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-sm text-zinc-200">{displayAddress}</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 text-xs font-mono text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 rounded-lg transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-mono text-sm uppercase tracking-wider rounded-lg border border-amber-500/30 transition-all disabled:opacity-50"
    >
      {connecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
};
