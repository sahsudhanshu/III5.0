"use client";
import { useEffect } from "react";
import { create } from "zustand";
import type { ChatMessage } from "@/types";
import { generateId } from "@/lib/utils";

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isTyping: boolean;
  context: string | null;

  openChat: () => void;
  openChatWithContext: (context: string) => void;
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

export const useChatStore = create<ChatState>()((set, get) => ({
  messages: [GREETING],
  isOpen: false,
  isTyping: false,
  context: null,

  openChat: () => set({ isOpen: true }),
  openChatWithContext: (context) => set({ isOpen: true, context }),
  closeChat: () => set({ isOpen: false, context: null }),
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

    // Connect to actual local FastAPI LangGraph agent
    try {
      const baseUrl = process.env.NEXT_PUBLIC_TRADING_AGENT_BASE_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, context: get().context }),
      });
      
      const data = await response.json();
      const aiResponse = data.response || "No response received.";
      
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
    } catch (e) {
      console.error("Chat API error:", e);
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "⚠️ I'm having trouble connecting to my trading agent brain. Please make sure the Python server is running (`python server.py`).",
        timestamp: new Date().toISOString(),
      };
      set((s) => ({
        messages: [...s.messages, errorMsg],
        isTyping: false,
      }));
    }
  },

  setContext: (context) => set({ context }),

  clearMessages: () => set({ messages: [GREETING] }),
}));

/**
 * useChatContext — call this in any page component to automatically register
 * a context string that Aria will receive alongside every chat message.
 * Context is cleared automatically when the component unmounts (i.e. user navigates away).
 * If context is null/undefined, no context is set.
 */
export function useChatContext(context: string | null | undefined) {
  const setContext = useChatStore((s) => s.setContext);
  useEffect(() => {
    if (context) {
      setContext(context);
    }
    return () => {
      // Only clear if this page "owns" the context (still matches what we set)
      setContext(null);
    };
  }, [context, setContext]);
}
