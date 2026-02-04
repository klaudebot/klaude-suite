import WebSocket from "ws";
import { EventEmitter } from "events";
//w
export interface PumpTokenData {
  mint: string;
  name: string;
  symbol: string;
  price: number;
  usd_market_cap: number;
  total_supply: number;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  bonding_curve: string;
  associated_bonding_curve: string;
}

export class PumpPortalService extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 5000;
  private subscribedTokens: Set<string> = new Set();
  private isConnecting = false;

  constructor() {
    super();
  }

  public async connect(): Promise<void> {
    if (this.isConnecting) {
      return new Promise((resolve) => {
        this.once("connected", () => resolve());
      });
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.close();
      }

      console.log("[PumpPortal] Connecting to WebSocket...");
      this.ws = new WebSocket("wss://pumpportal.fun/api/data");

      const connectionTimeout = setTimeout(() => {
        this.isConnecting = false;
        reject(new Error("WebSocket connection timeout"));
      }, 10000);

      this.ws.on("open", () => {
        console.log("[PumpPortal] Connected");
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        clearTimeout(connectionTimeout);
        this.emit("connected");
        resolve();
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const strData = data instanceof Buffer ? data.toString() : data.toString();
          const message = JSON.parse(strData);

          if (message.mint) {
            this.emit("tokenData", message);
          } else if (message.data && message.data.mint) {
            this.emit("tokenData", message.data);
          }
        } catch (error) {
          // Silently ignore parse errors
        }
      });

      this.ws.on("close", () => {
        console.log("[PumpPortal] Disconnected");
        this.isConnecting = false;
        this.handleReconnect();
      });

      this.ws.on("error", (error) => {
        console.error("[PumpPortal] Error:", error.message);
        this.isConnecting = false;
        clearTimeout(connectionTimeout);
      });
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++;
      console.log(
        `[PumpPortal] Reconnecting (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`
      );
      setTimeout(() => this.connect(), this.RECONNECT_DELAY * this.reconnectAttempts);
    }
  }

  public async subscribeNewTokens(): Promise<void> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect();
      }

      // Subscribe to new token creations
      const payload = { method: "subscribeNewToken" };
      console.log("[PumpPortal] Subscribing to new tokens");
      this.ws?.send(JSON.stringify(payload));
    } catch (error) {
      console.error("[PumpPortal] Subscribe error:", error);
    }
  }

  public async subscribeToTokens(tokenMints: string[]): Promise<void> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        await this.connect();
      }

      const payload = {
        method: "subscribeTokenTrade",
        keys: tokenMints,
      };

      this.ws?.send(JSON.stringify(payload));
      tokenMints.forEach((mint) => this.subscribedTokens.add(mint));
    } catch (error) {
      console.error("[PumpPortal] Subscribe error:", error);
    }
  }

  public async getTokenData(mint: string): Promise<PumpTokenData | null> {
    return new Promise(async (resolve) => {
      try {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          await this.connect();
        }

        const dataHandler = (data: PumpTokenData) => {
          if (data.mint === mint) {
            clearTimeout(timeout);
            this.removeListener("tokenData", dataHandler);
            resolve(data);
          }
        };

        const timeout = setTimeout(() => {
          this.removeListener("tokenData", dataHandler);
          resolve(null);
        }, 10000);

        this.on("tokenData", dataHandler);
        await this.subscribeToTokens([mint]);
      } catch (error) {
        resolve(null);
      }
    });
  }

  public close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const pumpPortal = new PumpPortalService();
