import axios from "axios";
import type { Token, RiskLevel, Opportunity } from "../types/index.js";
import { db, generateId } from "../db/schema.js";
import { EventEmitter } from "events";
import { withRetry } from "../utils/retry.js";
import { pumpPortal, type PumpTokenData } from "./pumpportal.js";

// Headers that work for Pump.fun (from bhive-trading-bot)
const PUMPFUN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.pump.fun/",
  "Origin": "https://www.pump.fun",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "cross-site",
};

const DEXSCREENER_HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
};

export class DexScanner extends EventEmitter {
  private isRunning = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private readonly SCAN_INTERVAL_MS = 15000;

  constructor() {
    super();
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[DexScanner] Starting...");

    // Connect to PumpPortal WebSocket for real-time new tokens
    try {
      await pumpPortal.connect();
      await pumpPortal.subscribeNewTokens();

      pumpPortal.on("tokenData", (data: PumpTokenData) => {
        this.handlePumpPortalToken(data);
      });

      console.log("[DexScanner] PumpPortal connected");
    } catch (error) {
      console.warn("[DexScanner] PumpPortal connection failed, using HTTP fallback");
    }

    // Initial scan
    await this.scan();

    // Schedule recurring scans
    this.scanInterval = setInterval(() => this.scan(), this.SCAN_INTERVAL_MS);
  }

  stop() {
    this.isRunning = false;
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    pumpPortal.close();
    console.log("[DexScanner] Stopped");
  }

  private handlePumpPortalToken(data: PumpTokenData) {
    const token: Token = {
      id: generateId(),
      address: data.mint,
      symbol: `$${data.symbol}`,
      name: data.name,
      decimals: 6,
      source: "pumpfun",
      createdAt: new Date(),
      price: data.price || 0,
      priceChange24h: 0,
      marketCap: data.usd_market_cap || 0,
      volume24h: 0,
      liquidity: data.virtual_sol_reserves || 0,
      holders: 0,
      risk: this.assessRisk(data.usd_market_cap || 0, data.virtual_sol_reserves || 0, 0),
      riskReasons: [],
    };

    const existing = this.getTokenByAddress(token.address);
    if (!existing) {
      this.saveToken(token);
      this.emit("token_discovered", token);
      console.log(`[PumpPortal] New token: ${token.symbol}`);

      const opportunity = this.evaluateOpportunity(token);
      if (opportunity) {
        this.saveOpportunity(opportunity);
        this.emit("opportunity_found", opportunity);
      }
    }
  }

  private async scan() {
    try {
      // PumpPortal WebSocket handles Pump.fun tokens in real-time
      // DexScreener provides additional Solana tokens
      const dexscreenerTokens = await this.scanDexScreener();

      const allTokens = [...dexscreenerTokens];
      let newCount = 0;

      for (const token of allTokens) {
        const existing = this.getTokenByAddress(token.address);
        if (!existing) {
          this.saveToken(token);
          this.emit("token_discovered", token);
          newCount++;

          const opportunity = this.evaluateOpportunity(token);
          if (opportunity) {
            this.saveOpportunity(opportunity);
            this.emit("opportunity_found", opportunity);
          }
        } else {
          this.updateTokenPrice(token.address, token.price, token.priceChange24h);
        }
      }

      if (newCount > 0) {
        console.log(`[DexScanner] Found ${newCount} new tokens`);
      }

      this.cleanupExpiredOpportunities();
    } catch (error) {
      console.error("[DexScanner] Scan error:", error);
    }
  }

  // Pump.fun API with proper headers
  private async scanPumpFun(): Promise<Token[]> {
    try {
      const response = await withRetry(
        () =>
          axios.get(
            "https://frontend-api.pump.fun/coins?offset=0&limit=20&sort=created_timestamp&order=DESC&includeNsfw=false",
            { headers: PUMPFUN_HEADERS, timeout: 10000 }
          ),
        { apiName: "PumpFun", maxRetries: 3, initialDelay: 500 }
      );

      if (response.status !== 200) {
        console.warn(`[PumpFun] API returned ${response.status}`);
        return [];
      }

      const tokens: Token[] = [];
      for (const coin of response.data || []) {
        const token = this.mapPumpFunCoin(coin);
        if (token) tokens.push(token);
      }

      console.log(`[PumpFun] Fetched ${tokens.length} tokens`);
      return tokens;
    } catch (error: any) {
      console.error(`[PumpFun] Error: ${error.message}`);
      return [];
    }
  }

  private mapPumpFunCoin(coin: any): Token | null {
    try {
      const liquidity = coin.virtual_sol_reserves || 0;
      const holders = coin.holder_count || 0;
      const marketCap = coin.usd_market_cap || 0;

      return {
        id: generateId(),
        address: coin.mint,
        symbol: `$${coin.symbol}`,
        name: coin.name,
        decimals: 6,
        source: "pumpfun",
        createdAt: new Date(coin.created_timestamp),
        price: coin.price || 0,
        priceChange24h: 0,
        marketCap,
        volume24h: coin.volume_24h || 0,
        liquidity,
        holders,
        risk: this.assessRisk(marketCap, liquidity, holders),
        riskReasons: this.getRiskReasons(marketCap, liquidity, holders),
        imageUrl: coin.image_uri,
        website: coin.website,
        twitter: coin.twitter,
      };
    } catch {
      return null;
    }
  }

  // DexScreener API (reliable fallback)
  private async scanDexScreener(): Promise<Token[]> {
    const tokens: Token[] = [];

    try {
      // Get latest Solana token profiles
      const profilesRes = await axios.get(
        "https://api.dexscreener.com/token-profiles/latest/v1",
        { headers: DEXSCREENER_HEADERS, timeout: 10000 }
      );

      if (profilesRes.status === 200) {
        const solanaProfiles = (profilesRes.data || [])
          .filter((p: any) => p.chainId === "solana")
          .slice(0, 10);

        for (const profile of solanaProfiles) {
          try {
            const pairRes = await axios.get(
              `https://api.dexscreener.com/latest/dex/tokens/${profile.tokenAddress}`,
              { headers: DEXSCREENER_HEADERS, timeout: 5000 }
            );

            if (pairRes.status === 200) {
              const pair = pairRes.data?.pairs?.[0];
              if (pair) {
                const token = this.mapDexScreenerPair(pair, profile);
                if (token) tokens.push(token);
              }
            }
          } catch {
            // Skip individual errors
          }
        }

        console.log(`[DexScreener] Fetched ${tokens.length} tokens`);
      }
    } catch (error: any) {
      console.error(`[DexScreener] Error: ${error.message}`);
    }

    return tokens;
  }

  private mapDexScreenerPair(pair: any, profile: any): Token | null {
    try {
      const liquidity = (pair.liquidity?.usd || 0) / 100;
      const marketCap = pair.marketCap || pair.fdv || 0;

      return {
        id: generateId(),
        address: pair.baseToken?.address || profile?.tokenAddress,
        symbol: `$${pair.baseToken?.symbol || "???"}`,
        name: pair.baseToken?.name || profile?.name || "Unknown",
        decimals: 9,
        source: "raydium",
        createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : new Date(),
        price: parseFloat(pair.priceUsd || "0"),
        priceChange24h: pair.priceChange?.h24 || 0,
        marketCap,
        volume24h: pair.volume?.h24 || 0,
        liquidity,
        holders: profile?.holders || 0,
        risk: this.assessRisk(marketCap, liquidity, 0),
        riskReasons: this.getRiskReasons(marketCap, liquidity, 0),
        imageUrl: profile?.icon || pair.info?.imageUrl,
      };
    } catch {
      return null;
    }
  }

  // Risk assessment
  private assessRisk(marketCap: number, liquidity: number, holders: number): RiskLevel {
    if (liquidity < 5) return "danger";
    if (holders > 0 && holders < 30) return "danger";
    if (marketCap > 0 && marketCap < 10000) return "danger";

    if (liquidity < 20) return "risky";
    if (holders > 0 && holders < 100) return "risky";
    if (marketCap > 0 && marketCap < 50000) return "risky";

    return "safe";
  }

  private getRiskReasons(marketCap: number, liquidity: number, holders: number): string[] {
    const reasons: string[] = [];
    if (liquidity < 5) reasons.push("Very low liquidity");
    else if (liquidity < 20) reasons.push("Low liquidity");
    if (holders > 0 && holders < 30) reasons.push("Very few holders");
    else if (holders > 0 && holders < 100) reasons.push("Few holders");
    if (marketCap > 0 && marketCap < 10000) reasons.push("Micro cap");
    else if (marketCap > 0 && marketCap < 50000) reasons.push("Low cap");
    return reasons;
  }

  private evaluateOpportunity(token: Token): Opportunity | null {
    if (token.risk === "danger" || token.liquidity < 5) return null;

    let score = 50;
    let type: Opportunity["type"] = "new_launch";
    let reason = "";

    const ageMinutes = (Date.now() - token.createdAt.getTime()) / 60000;
    if (ageMinutes < 30) {
      score += 20;
      reason = `New (${Math.round(ageMinutes)}m ago)`;
    }

    if (token.liquidity > 50) {
      score += 15;
      reason += reason ? " | Good liq" : "Good liquidity";
    }

    if (token.priceChange24h > 20) {
      score += 15;
      type = "breakout";
      reason += reason ? ` | +${token.priceChange24h.toFixed(0)}%` : `+${token.priceChange24h.toFixed(0)}%`;
    }

    if (score < 50) return null;

    return {
      id: generateId(),
      token,
      type,
      score,
      reason: reason || "Meets criteria",
      suggestedAction: score >= 70 && token.risk === "safe" ? "buy" : "watch",
      suggestedSize: score >= 70 ? 0.1 : 0,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(),
    };
  }

  // Database operations
  private getTokenByAddress(address: string): Token | null {
    const row = db.prepare("SELECT * FROM tokens WHERE address = ?").get(address) as any;
    return row ? this.rowToToken(row) : null;
  }

  private saveToken(token: Token) {
    db.prepare(`
      INSERT OR REPLACE INTO tokens (
        id, address, symbol, name, decimals, source,
        price, price_change_24h, market_cap, volume_24h, liquidity, holders,
        risk, risk_reasons, image_url, website, twitter, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token.id, token.address, token.symbol, token.name, token.decimals, token.source,
      token.price, token.priceChange24h, token.marketCap, token.volume24h, token.liquidity, token.holders,
      token.risk, JSON.stringify(token.riskReasons), token.imageUrl || null, token.website || null, token.twitter || null,
      token.createdAt.toISOString(), new Date().toISOString()
    );
  }

  private updateTokenPrice(address: string, price: number, priceChange: number) {
    db.prepare("UPDATE tokens SET price = ?, price_change_24h = ?, updated_at = ? WHERE address = ?")
      .run(price, priceChange, new Date().toISOString(), address);
  }

  private saveOpportunity(opp: Opportunity) {
    db.prepare(`
      INSERT INTO opportunities (id, token_address, type, score, reason, suggested_action, suggested_size, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(opp.id, opp.token.address, opp.type, opp.score, opp.reason, opp.suggestedAction, opp.suggestedSize, opp.expiresAt.toISOString(), opp.createdAt.toISOString());
  }

  private cleanupExpiredOpportunities() {
    db.prepare("DELETE FROM opportunities WHERE expires_at < ?").run(new Date().toISOString());
  }

  private rowToToken(row: any): Token {
    return {
      id: row.id,
      address: row.address,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      source: row.source,
      createdAt: new Date(row.created_at),
      price: row.price,
      priceChange24h: row.price_change_24h,
      marketCap: row.market_cap,
      volume24h: row.volume_24h,
      liquidity: row.liquidity,
      holders: row.holders,
      risk: row.risk,
      riskReasons: JSON.parse(row.risk_reasons || "[]"),
      imageUrl: row.image_url,
      website: row.website,
      twitter: row.twitter,
    };
  }

  getRecentTokens(limit = 20): Token[] {
    const rows = db.prepare("SELECT * FROM tokens ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
    return rows.map((r) => this.rowToToken(r));
  }

  getTokensBySource(source: string, limit = 20): Token[] {
    const rows = db.prepare("SELECT * FROM tokens WHERE source = ? ORDER BY created_at DESC LIMIT ?").all(source, limit) as any[];
    return rows.map((r) => this.rowToToken(r));
  }

  getActiveOpportunities(): Opportunity[] {
    const rows = db.prepare(`
      SELECT o.*, t.* FROM opportunities o
      JOIN tokens t ON o.token_address = t.address
      WHERE o.expires_at > ?
      ORDER BY o.score DESC
    `).all(new Date().toISOString()) as any[];

    return rows.map((row) => ({
      id: row.id,
      token: this.rowToToken(row),
      type: row.type,
      score: row.score,
      reason: row.reason,
      suggestedAction: row.suggested_action,
      suggestedSize: row.suggested_size,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    }));
  }
}

export const dexScanner = new DexScanner();
