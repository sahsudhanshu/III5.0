/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Stock, NewsArticle, CandlestickDataPoint } from "@/types";
import { toast } from "sonner";
import { generateCandlestickData, MOCK_NEWS } from "@/lib/mock-data";

// Number of daily bars to pre-populate when using mock data
const MOCK_CANDLE_DAYS = 252;

// Predefined set of top stocks so our dashboard doesn't have an empty screen
// We will lazy load their actual data from Finnhub to preserve API rate limits.
export const INITIAL_UNIVERSE = [
  "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "JPM", "WMT", "JNJ"
];

// ── Rate-limit retry constants ───────────────────────────────────────────────
const RATE_LIMIT_RETRY_DELAY_MS = 61_000; // 61 s — just over Finnhub's 1-min window
const MAX_RETRIES = 2;                    // up to 2 automatic retries after the first failure

// Module-level rate-limit tracking (shared across all store calls, survives re-renders)
let globalRateLimitedUntil: number | null = null; // timestamp ms when the ban lifts
let countdownInterval: ReturnType<typeof setInterval> | null = null;

function startCountdown(unlockAt: number, onTick: (secsLeft: number) => void) {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    const left = Math.ceil((unlockAt - Date.now()) / 1000);
    if (left <= 0) {
      clearInterval(countdownInterval!);
      countdownInterval = null;
      onTick(0);
    } else {
      onTick(left);
    }
  }, 1000);
}

interface DataState {
  stocks: Record<string, Stock>;
  news: Record<string, NewsArticle[]>;
  candles: Record<string, CandlestickDataPoint[]>;
  isFetching: Record<string, boolean>;

  // Rate-limit countdown visible to UI components
  candleRetryCountdown: number | null; // seconds remaining, null = not waiting

  // Actions
  fetchStockProfile: (symbol: string) => Promise<Stock | null>;
  fetchNews: (symbol: string) => Promise<NewsArticle[]>;
  fetchCandles: (symbol: string, resolution: "D" | "W" | "M", count?: number) => Promise<CandlestickDataPoint[]>;
}

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

// Helper for generic fetch — throws with status code embedded in message
async function fetchFinnhub<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}&token=${FINNHUB_KEY}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Finnhub error: ${res.status}`);
  }
  return res.json();
}

/** Sleep helper */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function getFallbackSymbolNews(symbol: string): NewsArticle[] {
  const sym = symbol.toUpperCase();
  const now = Date.now();

  const symbolMatched = MOCK_NEWS.filter((n) =>
    (n.relatedSymbols || []).some((s) => s.toUpperCase() === sym)
  );

  const source = symbolMatched.length > 0 ? symbolMatched : MOCK_NEWS;

  return source.slice(0, 10).map((n, idx) => ({
    ...n,
    id: `${n.id}_fallback_${sym}_${idx}`,
    publishedAt: n.publishedAt || new Date(now - idx * 3600000).toISOString(),
    feedType: "fallback",
  }));
}

export const useDataStore = create<DataState>((set, get) => ({
  stocks: {},
  news: {},
  candles: {},
  isFetching: {},
  candleRetryCountdown: null,

  fetchStockProfile: async (symbol: string) => {
    const { stocks, isFetching } = get();
    if (stocks[symbol]) return stocks[symbol];
    if (isFetching[`profile_${symbol}`]) return null;

    set((state) => ({ isFetching: { ...state.isFetching, [`profile_${symbol}`]: true } }));

    try {
      const [profileData, quoteData, metricData] = await Promise.all([
        fetchFinnhub<any>(`/stock/profile2?symbol=${symbol}`),
        fetchFinnhub<any>(`/quote?symbol=${symbol}`),
        fetchFinnhub<any>(`/stock/metric?symbol=${symbol}&metric=all`),
      ]);

      if (!profileData || Object.keys(profileData).length === 0) {
        console.warn(`No profile data for ${symbol}`);
        set((state) => ({ isFetching: { ...state.isFetching, [`profile_${symbol}`]: false } }));
        return null;
      }

      const m = metricData?.metric || {};

      const newStock: Stock = {
        symbol: profileData.ticker || symbol,
        name: profileData.name || symbol,
        exchange: profileData.exchange?.includes("NASDAQ")
          ? "NASDAQ"
          : profileData.exchange?.includes("NEW YORK")
            ? "NYSE"
            : "CRYPTO",
        sector: profileData.finnhubIndustry || "Other",
        price: quoteData.c || 0,
        change: quoteData.d || 0,
        changePercent: quoteData.dp || 0,
        volume: 0,
        marketCap: profileData.marketCapitalization
          ? profileData.marketCapitalization * 1_000_000
          : 0,
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
        isFetching: { ...state.isFetching, [`profile_${symbol}`]: false },
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
    if (news[symbol]) return news[symbol];
    if (isFetching[`news_${symbol}`]) return [];

    set((state) => ({ isFetching: { ...state.isFetching, [`news_${symbol}`]: true } }));

    try {
      const to = new Date().toISOString().split("T")[0];
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const newsData = await fetchFinnhub<any[]>(
        `/company-news?symbol=${symbol}&from=${from}&to=${to}`
      );

      const parsedNews: NewsArticle[] = (newsData || []).slice(0, 10).map((n) => ({
        id: n.id?.toString() || Math.random().toString(),
        title: n.headline || "No Headline",
        summary: n.summary || "",
        source: n.source || "Finnhub",
        url: n.url || "#",
        publishedAt: new Date(n.datetime * 1000).toISOString(),
        feedType: "live",
        sentiment: "neutral" as const,
        relatedSymbols: [n.related || symbol],
        imageUrl: n.image || undefined,
      }));

      const finalNews = parsedNews.length > 0 ? parsedNews : getFallbackSymbolNews(symbol);

      set((state) => ({
        news: { ...state.news, [symbol]: finalNews },
        isFetching: { ...state.isFetching, [`news_${symbol}`]: false },
      }));

      return finalNews;
    } catch (error) {
      console.error("Failed to fetch news:", error);
      const fallbackNews = getFallbackSymbolNews(symbol);
      set((state) => ({
        news: { ...state.news, [symbol]: fallbackNews },
        isFetching: { ...state.isFetching, [`news_${symbol}`]: false },
      }));
      return fallbackNews;
    }
  },

  fetchCandles: async (symbol: string, resolution: "D" | "W" | "M", count: number = 60) => {
    const cacheKey = `${symbol}_${resolution}`;
    const { candles, isFetching } = get();

    // Return cached real data if available
    if (candles[cacheKey] && candles[cacheKey].length > 0) return candles[cacheKey];
    if (isFetching[`candles_${cacheKey}`]) return [];

    set((state) => ({ isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: true } }));

    const toSec = Math.floor(Date.now() / 1000);
    let fromSec = toSec;
    if (resolution === "D") fromSec -= count * 24 * 60 * 60;
    if (resolution === "W") fromSec -= count * 7 * 24 * 60 * 60;
    if (resolution === "M") fromSec -= count * 30 * 24 * 60 * 60;

    const endpoint = `/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${fromSec}&to=${toSec}`;

    // ── Retry loop with countdown ────────────────────────────────────────────
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // If a global rate-limit is active, wait out the remainder first
      if (globalRateLimitedUntil && Date.now() < globalRateLimitedUntil) {
        const waitMs = globalRateLimitedUntil - Date.now();
        const secsLeft = Math.ceil(waitMs / 1000);
        console.info(`[Candles] Rate-limited. Retry ${attempt + 1}/${MAX_RETRIES + 1} in ${secsLeft}s for ${symbol} (${resolution})`);

        // Show countdown in the UI
        set({ candleRetryCountdown: secsLeft });
        startCountdown(globalRateLimitedUntil, (s) =>
          set({ candleRetryCountdown: s === 0 ? null : s })
        );

        toast.info(`⏳ Chart data rate-limited. Auto-retrying in ~${secsLeft}s…`, {
          id: "candle-rate-limit",
          duration: waitMs + 2000,
        });

        await sleep(waitMs + 500); // wait out the full window + small buffer
        globalRateLimitedUntil = null;
        set({ candleRetryCountdown: null });
      }

      try {
        const candleData = await fetchFinnhub<any>(endpoint);

        if (candleData.s === "no_data") {
          console.warn(`Finnhub: no candle data for ${symbol} (${resolution})`);
          set((state) => ({
            isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false },
          }));
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
          isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false },
          candleRetryCountdown: null,
        }));

        if (attempt > 0) {
          toast.success(`✅ Real chart data loaded for ${symbol}!`, { id: "candle-rate-limit" });
        }
        return parsed;

      } catch (error: any) {
        const status = parseInt(error?.message?.match(/\d{3}/)?.[0] ?? "0", 10);
        const isRateLimited = status === 429;
        const isPremiumRestricted = status === 403;

        if (isPremiumRestricted) {
          // 403 = /stock/candle is a Premium endpoint.
          // Use the real current price (from the free /quote, already in stocks store)
          // to generate a seeded mock series anchored to the actual market price.
          const realPrice = get().stocks[symbol]?.price;
          console.info(
            `Finnhub /stock/candle is Premium-only for ${symbol}. ` +
            `Generating seeded mock data anchored to real price $${realPrice ?? "unknown"}.`
          );
          const mock = realPrice
            ? generateCandlestickData(realPrice, MOCK_CANDLE_DAYS, "D", symbol)
            : [];
          set((state) => ({
            candles: { ...state.candles, [cacheKey]: mock },
            isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false },
          }));
          return mock;
        }

        if (isRateLimited && attempt < MAX_RETRIES) {
          // Set the global rate-limit window
          globalRateLimitedUntil = Date.now() + RATE_LIMIT_RETRY_DELAY_MS;
          console.warn(
            `[Candles] 429 rate limit hit for ${symbol}. Will retry in ${RATE_LIMIT_RETRY_DELAY_MS / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`
          );
          // Loop will wait at the top of the next iteration
          continue;
        }

        // Final failure — exhausted retries or unknown error.
        // Still provide mock data anchored to real price instead of empty []
        if (isRateLimited) {
          toast.error(`Rate limit exhausted for ${symbol}. Showing simulated chart.`, {
            id: "candle-rate-limit",
          });
        } else {
          console.warn(`Failed to fetch candles for ${symbol}:`, error);
        }

        const fallbackPrice = get().stocks[symbol]?.price;
        const fallback = fallbackPrice
          ? generateCandlestickData(fallbackPrice, MOCK_CANDLE_DAYS, "D", symbol)
          : [];
        set((state) => ({
          candles: { ...state.candles, [cacheKey]: fallback },
          isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false },
          candleRetryCountdown: null,
        }));
        return fallback;
      }
    }

    // Should never reach here, but satisfy TS
    set((state) => ({
      isFetching: { ...state.isFetching, [`candles_${cacheKey}`]: false },
      candleRetryCountdown: null,
    }));
    return [];
  },

}));
