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
  const msg = message.toLowerCase();

  if (msg.includes("reliance") || msg.includes("ril")) {
    return "**Reliance Industries (RELIANCE)** is currently trading at ₹2,847.5 (+1.22%). \n\n📊 Key metrics:\n• P/E: 24.3x\n• Market Cap: ₹19.2L Cr\n• 52W High: ₹3,217.9\n\n🏭 Jio and retail segments are driving growth. Analyst consensus: **BUY** with a target of ₹3,150.";
  }

  if (msg.includes("portfolio") || msg.includes("my holdings")) {
    return "📈 Your portfolio is up **+11.28%** overall!\n\n**Top performers:**\n• RELIANCE: +18.15%\n• TATAMOTORS: +13.49%\n• ICICIBANK: +11.17%\n\n**Laggard:**\n• INFY: -4.19%\n\nYour portfolio is well-diversified across 5 sectors. Consider rebalancing IT exposure as the sector faces near-term headwinds.";
  }

  if (msg.includes("nifty") || msg.includes("market")) {
    return "📊 **Market Update:**\n• Nifty 50: 25,780 (+0.62%)\n• Sensex: 84,920 (+0.58%)\n• FII: ₹+4,200 Cr (Buyers)\n• DII: ₹-1,800 Cr (Sellers)\n\n🟢 **Sectors advancing:** Auto, Banking, FMCG\n🔴 **Sectors declining:** IT, Pharma\n\nGlobal cues are positive — Nasdaq futures up 0.4%. Expect range-bound trading between 25,500–26,000.";
  }

  if (msg.includes("buy") || msg.includes("invest")) {
    return "💡 **Top Picks for Today:**\n\n1. **ICICIBANK** — Strong Q3 results, NIM expansion expected. Target: ₹1,200\n2. **TATAMOTORS** — JLR delivery momentum. Target: ₹1,100\n3. **BAJFINANCE** — AUM growth story intact. Target: ₹8,000\n\n⚠️ *This is not financial advice. Always do your own research.*";
  }

  if (msg.includes("it") || msg.includes("tech") || msg.includes("tcs") || msg.includes("infosys")) {
    return "💻 **IT Sector Outlook:**\n\nThe Indian IT sector faces near-term pressure from:\n• Discretionary spending cuts in US/Europe\n• Macro uncertainty impacting deal closures\n• INR appreciation headwinds\n\n**TCS** (-0.78%) and **INFY** (+0.84%) have diverged. TCS missed Q3 estimates while Infosys is seeing a recovery in BFSI vertical.\n\nMedium-term outlook remains positive on AI/GenAI tailwinds.";
  }

  if (context) {
    return `📌 Regarding **${context}**:\n\nBased on current market conditions, this stock shows moderate momentum. Key levels to watch:\n• Support: ₹${(Math.random() * 100 + 900).toFixed(2)}\n• Resistance: ₹${(Math.random() * 100 + 1100).toFixed(2)}\n\nVolume is above the 20-day average, suggesting institutional interest. Would you like a deeper technical analysis?`;
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
