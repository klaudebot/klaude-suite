"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, ws, type Token, type Opportunity, type Portfolio, type PortfolioStats, type Activity, type WSMessage } from "@/lib/api";

// Hook for fetching tokens
export function useTokens(limit = 20, source?: string) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { tokens } = await api.getTokens(limit, source);
      setTokens(tokens);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tokens");
    } finally {
      setLoading(false);
    }
  }, [limit, source]);

  useEffect(() => {
    refresh();

    // Listen for new tokens via WebSocket
    const handleNewToken = (msg: WSMessage) => {
      if (msg.type === "token_discovered") {
        setTokens((prev) => [msg.data as Token, ...prev.slice(0, limit - 1)]);
      }
    };

    ws.on("token_discovered", handleNewToken);
    return () => ws.off("token_discovered", handleNewToken);
  }, [refresh, limit]);

  return { tokens, loading, error, refresh };
}

// Hook for opportunities
export function useOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { opportunities } = await api.getOpportunities();
      setOpportunities(opportunities);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch opportunities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Listen for new opportunities
    const handleNewOpp = (msg: WSMessage) => {
      if (msg.type === "opportunity_found") {
        setOpportunities((prev) => [msg.data as Opportunity, ...prev]);
      }
    };

    ws.on("opportunity_found", handleNewOpp);
    return () => ws.off("opportunity_found", handleNewOpp);
  }, [refresh]);

  return { opportunities, loading, error, refresh };
}

// Hook for portfolio
export function usePortfolio(walletAddress: string | null, network = "devnet") {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setPortfolio(null);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await api.getPortfolio(walletAddress, network);
      setPortfolio(result.portfolio);
      setStats(result.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  }, [walletAddress, network]);

  useEffect(() => {
    refresh();

    // Subscribe to updates for this wallet
    if (walletAddress) {
      ws.subscribe(walletAddress);
    }

    // Poll every 10 seconds for position updates
    const interval = setInterval(refresh, 10000);

    // Listen for position updates
    const handleUpdate = (msg: WSMessage) => {
      if (msg.type === "position_updated" || msg.type === "trade_executed") {
        refresh();
      }
    };

    ws.on("position_updated", handleUpdate);
    ws.on("trade_executed", handleUpdate);

    return () => {
      clearInterval(interval);
      ws.off("position_updated", handleUpdate);
      ws.off("trade_executed", handleUpdate);
    };
  }, [walletAddress, refresh]);

  const reset = useCallback(async () => {
    if (!walletAddress) return;
    await api.resetPortfolio(walletAddress, network);
    refresh();
  }, [walletAddress, network, refresh]);

  return { portfolio, stats, loading, error, refresh, reset };
}

// Hook for activities
export function useActivities(walletAddress: string | null, network = "devnet", limit = 50) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { activities } = await api.getActivities(walletAddress, network, limit);
      setActivities(activities);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activities");
    } finally {
      setLoading(false);
    }
  }, [walletAddress, network, limit]);

  useEffect(() => {
    refresh();

    // Listen for new activities
    const handleActivity = (msg: WSMessage) => {
      if (msg.type === "activity") {
        const activityData = msg.data as Record<string, unknown>;
        const activity: Activity = {
          id: (activityData.id as string) || crypto.randomUUID(),
          type: (activityData.type as string) || "alert",
          message: (activityData.message as string) || "",
          createdAt: msg.timestamp || new Date().toISOString(),
        };
        setActivities((prev) => [activity, ...prev.slice(0, limit - 1)]);
      }
    };

    ws.on("activity", handleActivity);
    return () => ws.off("activity", handleActivity);
  }, [refresh, limit]);

  return { activities, loading, error, refresh };
}

// Hook for executing trades
export function useTrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeTrade = useCallback(async (params: {
    walletAddress: string;
    tokenAddress: string;
    tokenSymbol: string;
    side: "buy" | "sell";
    amount: number;
    price: number;
    source?: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.executeTrade(params);
      if (!result.success) {
        setError(result.error || "Trade failed");
        return null;
      }
      return result.trade;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trade failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { executeTrade, loading, error };
}

// Hook for WebSocket connection
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const connectAttempted = useRef(false);

  useEffect(() => {
    if (connectAttempted.current) return;
    connectAttempted.current = true;

    ws.connect();

    // Check connection status
    const checkConnection = () => {
      // @ts-ignore - accessing private property for status
      setConnected(ws["ws"]?.readyState === WebSocket.OPEN);
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => {
      clearInterval(interval);
    };
  }, []);

  return { connected };
}
