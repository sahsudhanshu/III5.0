"use client";
import { create } from "zustand";

interface FinnhubMessage {
  data: {
    p: number; // Price
    s: string; // Symbol
    t: number; // Timestamp
    v: number; // Volume
  }[];
  type: string;
}

interface MarketState {
  prices: Record<string, { price: number; timestamp: number }>;
  ws: WebSocket | null;
  isConnected: boolean;
  subscriptions: Set<string>;

  // Actions
  connect: () => void;
  disconnect: () => void;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
}

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_KEY;

export const useMarketStore = create<MarketState>((set, get) => ({
  prices: {},
  ws: null,
  isConnected: false,
  subscriptions: new Set(),

  connect: () => {
    if (get().ws || !FINNHUB_KEY) return;

    console.log("Connecting to Finnhub WebSocket...");
    const socket = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`);
    
    // IMMEDIATELY set it to block concurrent connect() calls in the same tick
    set({ ws: socket });

    socket.onopen = () => {
      console.log("Finnhub WebSocket Connected");
      set({ isConnected: true });
      // Re-subscribe to any existing subscriptions automatically
      get().subscriptions.forEach((symbol) => {
        socket.send(JSON.stringify({ type: "subscribe", symbol }));
      });
    };

    socket.onmessage = (event) => {
      try {
        const message: FinnhubMessage = JSON.parse(event.data);
        if (message.type === "trade") {
          set((state) => {
            const newPrices = { ...state.prices };
            message.data.forEach((trade) => {
              newPrices[trade.s] = { price: trade.p, timestamp: trade.t };
            });
            return { prices: newPrices };
          });
        }
      } catch (error) {
        console.error("Error parsing Finnhub message", error);
      }
    };

    socket.onclose = () => {
      // Guard: only execute reconnect loop if this socket is still the active one
      if (get().ws === socket) {
        set({ ws: null, isConnected: false });
        setTimeout(() => {
          get().connect();
        }, 15000); // 15s backoff minimum to outlast Finnhub bans
      }
    };

    socket.onerror = () => {
      // Silence raw event span to prevent Next.js overlay crashes. 
      // Finnhub throws these continuously if IP is temporarily rate limited.
    };
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.close();
      set({ ws: null, isConnected: false });
    }
  },

  subscribe: (symbol: string) => {
    set((state) => {
      const newSubs = new Set(state.subscriptions);
      if (!newSubs.has(symbol)) {
        newSubs.add(symbol);
        if (state.ws && state.isConnected) {
          state.ws.send(JSON.stringify({ type: "subscribe", symbol }));
        }
      }
      return { subscriptions: newSubs };
    });
  },

  unsubscribe: (symbol: string) => {
    set((state) => {
      const newSubs = new Set(state.subscriptions);
      if (newSubs.has(symbol)) {
        newSubs.delete(symbol);
        if (state.ws && state.isConnected) {
          state.ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
        }
      }
      return { subscriptions: newSubs };
    });
  },
}));
