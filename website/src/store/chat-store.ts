"use client";
import { create } from "zustand";
import type { ChatMessage } from "@/types";
import { generateId } from "@/lib/utils";

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isTyping: boolean;
  context: string | null;

  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  setContext: (context: string | null) => void;
  clearMessages: () => void;
}

const GREETING: ChatMessage = {
  id: "msg_init",
  role: "assistant",
  content:
    "👋 Hi! I'm **Aria**, your AI trading assistant. I can help you with:\n\n• 📊 Stock analysis & insights\n• 📰 Market news summaries\n• 💡 Portfolio recommendations\n• 📈 Technical indicator explanations\n\nWhat would you like to know today?",
  timestamp: new Date().toISOString(),
};

// Simulated AI responses based on keywords
const getAIResponse = (message: string, context: string | null): string => {
  const lowerMsg = message.toLowerCase();

  if (lowerMsg.includes("apple") || lowerMsg.includes("aapl")) {
    return "**Apple Inc. (AAPL)** is currently trading at $185.85 (+1.28%). \n\n📊 Key metrics:\n• P/E: 28.3x\n• Market Cap: $2.92T\n• 52W High: $199.62\n\n🏭 Services segment is driving growth. Analyst consensus: **BUY** with a target of $210.";
  }

  if (lowerMsg.includes("recommend") || lowerMsg.includes("buy")) {
    return "Based on your current portfolio, you might want to consider **MSFT** (Cloud growth momentum) or **TSLA** (If you have a high risk appetite, currently down 12% from recent highs).\n\n*Note: This is AI-generated advice and not financial counsel.*";
  }

  if (lowerMsg.includes("market") || lowerMsg.includes("update")) {
    return "📊 **Market Update:**\n• S&P 500: 5,280 (+0.62%)\n• Nasdaq: 16,920 (+0.88%)\n\n🟢 **Sectors advancing:** Tech, Consumer Cyclical\n🔴 **Sectors declining:** Healthcare, Utilities\n\nGlobal cues are positive. Expect range-bound trading into the close.";
  }

  if (context && lowerMsg.includes("this")) {
    return `Looking at **${context}**, the stock has shown strong momentum recently. Would you like me to pull up the technical indicators or recent news?`;
  }

  if (lowerMsg.includes("hi") || lowerMsg.includes("hello")) {
    return "Hello! I'm Aria, your AI trading assistant. I can analyze stocks, summarize news, or review your portfolio. What can I help you with today?";
  }

  const responses = [
    "Great question! Based on current market data, let me analyze this for you... The NSE markets are showing mixed signals today with global cues being cautiously positive.",
    "I'm analyzing the latest data for you. The SEBI regulations introduced in Q4 2024 have significantly impacted F&O traders. Are you looking at derivatives or equity markets?",
    "📊 Market breadth is positive today — 1,420 stocks advancing vs 890 declining on NSE. Midcap and Smallcap indices are outperforming the benchmark.",
    "Based on your watchlist, you're tracking some great stocks! Would you like me to run a technical or fundamental screener on any specific ticker?",
  ];

  return responses[Math.floor(Math.random() * responses.length)];
};

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [GREETING],
  isOpen: false,
  isTyping: false,
  context: null,

  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((s) => ({ isOpen: !s.isOpen })),

  sendMessage: async (content) => {
    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      isTyping: true,
    }));

    // Simulate AI processing delay
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));

    const aiResponse = getAIResponse(content, get().context);
    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: "assistant",
      content: aiResponse,
      timestamp: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, assistantMsg],
      isTyping: false,
    }));
  },

  setContext: (context) => set({ context }),

  clearMessages: () => set({ messages: [GREETING] }),
}));
