"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WatchlistItem } from "@/types";
import { MOCK_WATCHLIST } from "@/lib/mock-data";

interface WatchlistState {
  items: WatchlistItem[];
  addToWatchlist: (item: WatchlistItem) => void;
  removeFromWatchlist: (symbol: string) => void;
  isInWatchlist: (symbol: string) => boolean;
  updatePrices: (updates: Record<string, { price: number; change: number; changePercent: number }>) => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: MOCK_WATCHLIST,

      addToWatchlist: (item) => {
        if (get().isInWatchlist(item.symbol)) return;
        set((s) => ({ items: [...s.items, item] }));
      },

      removeFromWatchlist: (symbol) => {
        set((s) => ({ items: s.items.filter((i) => i.symbol !== symbol) }));
      },

      isInWatchlist: (symbol) => {
        return get().items.some((i) => i.symbol === symbol);
      },

      updatePrices: (updates) => {
        set((s) => ({
          items: s.items.map((item) => {
            const update = updates[item.symbol];
            return update ? { ...item, ...update } : item;
          }),
        }));
      },
    }),
    { name: "trading-watchlist" }
  )
);
