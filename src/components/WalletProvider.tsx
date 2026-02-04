"use client";

import { FC, ReactNode, useMemo, useState, createContext, useContext, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import "@solana/wallet-adapter-react-ui/styles.css";

type Network = "mainnet-beta" | "devnet";

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
  isDevnet: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  network: "devnet",
  setNetwork: () => {},
  isDevnet: true,
});

export const useNetwork = () => useContext(NetworkContext);

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  const [network, setNetwork] = useState<Network>("devnet");
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [], []);
  const isDevnet = network === "devnet";

  return (
    <NetworkContext.Provider value={{ network, setNetwork, isDevnet }}>
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>{children}</WalletModalProvider>
        </SolanaWalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
};

// Airdrop hook - must be used inside WalletProvider
export const useAirdrop = () => {
  const { publicKey } = useWallet();
  const { network, isDevnet } = useNetwork();
  const [isAirdropping, setIsAirdropping] = useState(false);
  const [airdropError, setAirdropError] = useState<string | null>(null);
  const [airdropSuccess, setAirdropSuccess] = useState(false);

  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const connection = useMemo(() => new Connection(endpoint, "confirmed"), [endpoint]);

  const requestAirdrop = useCallback(async (): Promise<string | null> => {
    if (!publicKey) {
      setAirdropError("Connect wallet first");
      return null;
    }
    if (!isDevnet) {
      setAirdropError("Airdrop only available on devnet");
      return null;
    }

    setIsAirdropping(true);
    setAirdropError(null);
    setAirdropSuccess(false);

    try {
      const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(signature);
      setIsAirdropping(false);
      setAirdropSuccess(true);
      return signature;
    } catch (error) {
      setIsAirdropping(false);
      const msg = error instanceof Error ? error.message : "Airdrop failed";
      // Devnet rate limiting is common
      if (msg.includes("429") || msg.includes("rate")) {
        setAirdropError("Rate limited - try again in a minute");
      } else {
        setAirdropError(msg);
      }
      return null;
    }
  }, [publicKey, isDevnet, connection]);

  return {
    requestAirdrop,
    isAirdropping,
    airdropError,
    airdropSuccess,
    canAirdrop: isDevnet && !!publicKey,
  };
};
