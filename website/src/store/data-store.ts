/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Stock, NewsArticle, CandlestickDataPoint } from "@/types";
import { toast } from "sonner";

// Predefined set of top stocks so our dashboard doesn't have an empty screen
// We will lazy load their actual data from Finnhub to preserve API rate limits.
export const INITIAL_UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "JPM", "WMT", "JNJ"
];

interface DataState {
  stocks: Record<string, Stock>;
  news: Record<string, NewsArticle[]>;
  candles: Record<string, CandlestickDataPoint[]>;
  isFetching: Record<string, boolean>;

  // Actions
  fetchStockProfile: (symbol: string) => Promise<Stock | null>;
  fetchNews: (symbol: string) => Promise<NewsArticle[]>;
  fetchCandles: (symbol: string, resolution: "D" | "W" | "M", count?: number) => Promise<CandlestickDataPoint[]>;
}

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

// Helper for generic fetch
async function fetchFinnhub<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}&token=${FINNHUB_KEY}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 429) {
      console.warn("Finnhub Rate Limit Hit!");
      toast.error("API Rate Limit Reached! Data may be delayed.");
    }
    throw new Error(`Finnhub error: ${res.status}`);
  }
  return res.json();
}

export const useDataStore = create<DataState>((set, get) => ({
  stocks: {},
  news: {},
  candles: {},
  isFetching: {},

  fetchStockProfile: async (symbol: string) => {
    const { stocks, isFetching } = get();
    // Cache hit
    if (stocks[symbol]) return stocks[symbol];
    if (isFetching[`profile_${symbol}`]) return null; // Prevent duplicate concurrent requests

    set((state) => ({ isFetching: { ...state.isFetching, [`profile_${symbol}`]: true } }));

    try {
      // 1. Fetch Company Profile (Sector, Market Cap, etc)
      // 2. Fetch Quote (Current Price, High, Low)
      // 3. Fetch Metrics (P/E, Beta, 52W info)
      const [profileData, quoteData, metricData] = await Promise.all([
        fetchFinnhub<any>(`/stock/profile2?symbol=${symbol}`),
        fetchFinnhub<any>(`/quote?symbol=${symbol}`),
        fetchFinnhub<any>(`/stock/metric?symbol=${symbol}&metric=all`)
      ]);

      // If Finnhub doesn't recognize the symbol, it returns empty objects for profile.
      if (!profileData || Object.keys(profileData).length === 0) {
        console.warn(`No profile data for ${symbol}`);
        return null;
      }

      const m = metricData?.metric || {};
      
      const newStock: Stock = {
        symbol: profileData.ticker || symbol,
        name: profileData.name || symbol,
        exchange: profileData.exchange?.includes("NASDAQ") ? "NASDAQ" 
                 : profileData.exchange?.includes("NEW YORK") ? "NYSE" 
                 : "CRYPTO",
        sector: profileData.finnhubIndustry || "Other",
        price: quoteData.c || 0,
        change: quoteData.d || 0,
        changePercent: quoteData.dp || 0,
        volume: 0, // Finnhub basic quote doesn't explicitly guarantee volume, might need 'v' or fallback
        marketCap: profileData.marketCapitalization ? profileData.marketCapitalization * 1000000 : 0, // It gives in millions
        high52w: m["52WeekHigh"] || 0,
        low52w: m["52WeekLow"] || 0,
        dayHigh: quoteData.h || 0,
        dayLow: quoteData.l || 0,
        open: quoteData.o || 0,
        previousClose: quoteData.pc || 0,
        pe: m.peExclExtraTTM || m.peBasicExclExtraTTM || 0,
        pb: m.pbAnnual || 0,
        eps: m.epsExclExtraItemsTTM || 0,
        dividendYield: m.dividendYieldIndicatedAnnual || 0,
        beta: m.beta || 1,
      };

      set((state) => ({ 
        stocks: { ...state.stocks, [symbol]: newStock },
        isFetching: { ...state.isFetching, [`profile_${symbol}`]: false }
      }));

      return newStock;
    } catch (error) {
      console.error("Failed to fetch stock profile:", error);
      set((state) => ({ isFetching: { ...state.isFetching, [`profile_${symbol}`]: false } }));
      return null;
    }
  },

  fetchNews: async (symbol: string) => {
    const { news, isFetching } = get();
    // Cache hit
    if (news[symbol]) return news[symbol];
    if (isFetching[`news_${symbol}`]) return [];

    set((state) => ({ isFetching: { ...state.isFetching, [`news_${symbol}`]: true } }));

    try {
      // Get news from past 7 days
      const to = new Date().toISOString().split("T")[0];
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const newsData = await fetchFinnhub<any[]>(`/company-news?symbol=${symbol}&from=${from}&to=${to}`);
      
      // Map to our NewsArticle type
      const parsedNews: NewsArticle[] = (newsData || []).slice(0, 10).map((n) => ({
        id: n.id?.toString() || Math.random().toString(),
        title: n.headline || "No Headline",
        summary: n.summary || "",
        source: n.source || "Finnhub",
        url: n.url || "#",
        publishedAt: new Date(n.datetime * 1000).toISOString(),
        sentiment: "neutral", // Real sentiment requires premium, fallback to neutral
        relatedSymbols: [n.related || symbol],
        imageUrl: n.image || undefined,
      }));

      set((state) => ({ 
        news: { ...state.news, [symbol]: parsedNews },
        isFetching: { ...state.isFetching, [`news_${symbol}`]: false }
      }));

      return parsedNews;
    } catch (error) {
      console.error("Failed to fetch news:", error);
      set((state) => ({ isFetching: { ...state.isFetching, [`news_${symbol}`]: false } }));
      return [];
    }
  },

  fetchCandles: async (symbol: string, resolution: "D" | "W" | "M", count: number = 60) => {
    // Generate a cache key
    const cacheKey = `${symbol}_${resolution}`;
    const { candles, isFetching } = get();
    if (candles[cacheKey]) return candles[cacheKey];
    if (isFetching[`candles_${cacheKey}`]) return [];

    set((state) => ({ isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: true } }));

    try {
      const toSec = Math.floor(Date.now() / 1000);
      let fromSec = toSec;
      
      // Rough time windows backwards
      if (resolution === "D") fromSec -= count * 24 * 60 * 60;
      if (resolution === "W") fromSec -= count * 7 * 24 * 60 * 60;
      if (resolution === "M") fromSec -= count * 30 * 24 * 60 * 60;

      const candleData = await fetchFinnhub<any>(`/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${fromSec}&to=${toSec}`);

      if (candleData.s === "no_data") {
         set((state) => ({ isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false } }));
         return [];
      }

      const parsed: CandlestickDataPoint[] = [];
      const times = candleData.t || [];
      const closes = candleData.c || [];
      const highs = candleData.h || [];
      const lows = candleData.l || [];
      const opens = candleData.o || [];
      const volumes = candleData.v || [];

      for (let i = 0; i < times.length; i++) {
        parsed.push({
          time: new Date(times[i] * 1000).toISOString(),
          close: closes[i],
          high: highs[i],
          low: lows[i],
          open: opens[i],
          volume: volumes[i],
        });
      }

      set((state) => ({ 
        candles: { ...state.candles, [cacheKey]: parsed },
        isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false }
      }));

      return parsed;

    } catch (error: any) {
      if (error?.message?.includes("403")) {
        console.warn(`Finnhub /stock/candle restricted (Premium Requirement) for ${symbol}. Falling back to simulation array.`);
      } else {
        console.warn(`Failed to fetch candles for ${symbol}:`, error);
      }
      set((state) => ({ 
        candles: { ...state.candles, [cacheKey]: [] }, 
        isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false } 
      }));
      return [];
    }
  }

}));
