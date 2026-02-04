"use client";

import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { ws } from "@/lib/api";

interface BackendContextType {
  connected: boolean;
  backendUrl: string;
}

const BackendContext = createContext<BackendContextType>({
  connected: false,
  backendUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:3001",
});

export const useBackend = () => useContext(BackendContext);

interface Props {
  children: ReactNode;
}

export const BackendProvider = ({ children }: Props) => {
  const [connected, setConnected] = useState(false);
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3001");

  useEffect(() => {
    // Connect WebSocket
    ws.connect();

    // Monitor connection status
    const checkConnection = setInterval(() => {
      // @ts-ignore
      const wsInstance = ws["ws"];
      setConnected(wsInstance?.readyState === WebSocket.OPEN);
    }, 1000);

    return () => {
      clearInterval(checkConnection);
      ws.disconnect();
    };
  }, []);

  return (
    <BackendContext.Provider value={{ connected, backendUrl }}>
      {children}
    </BackendContext.Provider>
  );
};
