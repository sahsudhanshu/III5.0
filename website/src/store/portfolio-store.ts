"use client";
import { create } from "zustand";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────

export interface Holding {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  qty: number;
  avgBuyPrice: number;
  // Computed client-side from live prices:
  currentPrice?: number;
  currentValue?: number;
  investedValue?: number;
  pnl?: number;
  pnlPercent?: number;
}

export interface PortfolioTransaction {
  id: string;
  type: "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
  symbol?: string;
  name?: string;
  qty?: number;
  price?: number;
  amount: number;
  fee: number;
  status: "COMPLETED" | "FAILED";
  timestamp: string;
}

export interface PortfolioData {
  cashBalance: number;
  holdings: Holding[];
  transactions: PortfolioTransaction[];
}

export interface PortfolioInsightItem {
  ticker: string;
  action: "BUY" | "SELL" | "HOLD";
  shares_to_trade: number;
  target_weight_pct: number;
  target_quantity: number;
  current_price: number;
  sentiment_score: number;
}

export interface PortfolioInsightData {
  cash_balance: number;
  net_worth: number;
  tracked_tickers: string[];
  ignored_symbols: string[];
  average_market_sentiment: number;
  buy_suggestions: PortfolioInsightItem[];
  sell_suggestions: PortfolioInsightItem[];
  per_ticker_plan: PortfolioInsightItem[];
  ai_insight_text: string;
  ai_insight_source: "gemini" | "template";
}

interface PortfolioState {
  portfolio: PortfolioData | null;
  loading: boolean;
  error: string | null;
  aiInsight: PortfolioInsightData | null;
  aiInsightLoading: boolean;
  aiInsightError: string | null;

  fetchPortfolio: () => Promise<void>;
  fetchAiInsight: () => Promise<void>;
  placeOrder: (params: {
    type: "BUY" | "SELL";
    symbol: string;
    name: string;
    exchange: string;
    sector: string;
    qty: number;
    price: number;
  }) => Promise<boolean>;
  manageFunds: (type: "DEPOSIT" | "WITHDRAW", amount: number) => Promise<boolean>;
  /** Enrich holdings with current live prices from the data store */
  enrichWithPrices: (prices: Record<string, number>) => void;
}

export const usePortfolioStore = create<PortfolioState>()((set, get) => ({
  portfolio: null,
  loading: false,
  error: null,
  aiInsight: null,
  aiInsightLoading: false,
  aiInsightError: null,

  // ── Fetch Portfolio ──────────────────────────────────────────
  fetchPortfolio: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Failed to load portfolio");
      const { portfolio } = await res.json();
      set({ portfolio, loading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      set({ error: msg, loading: false });
    }
  },

  fetchAiInsight: async () => {
    set({ aiInsightLoading: true, aiInsightError: null });
    try {
      const res = await fetch("/api/portfolio?mode=insight");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Failed to load AI insight");
      set({ aiInsight: data as PortfolioInsightData, aiInsightLoading: false });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      set({ aiInsightError: msg, aiInsightLoading: false });
    }
  },

  // ── Place Order ──────────────────────────────────────────────
  placeOrder: async ({ type, symbol, name, exchange, sector, qty, price }) => {
    try {
      const res = await fetch("/api/portfolio/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, symbol, name, exchange, sector, qty, price }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? "Order failed");
        return false;
      }

      // Optimistically update local state
      set((s) => {
        if (!s.portfolio) return s;
        return {
          portfolio: {
            ...s.portfolio,
            cashBalance: data.cashBalance,
            holdings: data.holdings,
          },
        };
      });

      // Full refresh to get updated transactions list too
      await get().fetchPortfolio();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      toast.error(msg);
      return false;
    }
  },

  // ── Manage Funds ─────────────────────────────────────────────
  manageFunds: async (type, amount) => {
    try {
      const res = await fetch("/api/portfolio/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message ?? `${type} failed`);
        return false;
      }

      set((s) => {
        if (!s.portfolio) return s;
        return {
          portfolio: { ...s.portfolio, cashBalance: data.cashBalance },
        };
      });

      // Full refresh to get the new transaction
      await get().fetchPortfolio();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Network error";
      toast.error(msg);
      return false;
    }
  },

  // ── Enrich with Live Prices ──────────────────────────────────
  enrichWithPrices: (prices) => {
    set((s) => {
      if (!s.portfolio) return s;
      const enriched = s.portfolio.holdings.map((h) => {
        const currentPrice = prices[h.symbol] ?? h.avgBuyPrice;
        const currentValue = parseFloat((currentPrice * h.qty).toFixed(2));
        const investedValue = parseFloat((h.avgBuyPrice * h.qty).toFixed(2));
        const pnl = parseFloat((currentValue - investedValue).toFixed(2));
        const pnlPercent = investedValue > 0 ? parseFloat(((pnl / investedValue) * 100).toFixed(2)) : 0;
        return { ...h, currentPrice, currentValue, investedValue, pnl, pnlPercent };
      });
      return { portfolio: { ...s.portfolio, holdings: enriched } };
    });
  },
}));
