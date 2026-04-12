"use client";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import { X, Sparkles, Send, BotMessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

function MessageContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split("\n");
  return (
    <div className="space-y-1.5 text-xs font-sans">
      {lines.map((line, i) => {
        if (line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 pl-3 mt-1.5 border-l-2 border-primary/40">
              <span className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-foreground mt-2 mb-1" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
        }
        if (line === "") return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      })}
    </div>
  );
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong class='text-foreground font-semibold'>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em class='text-foreground'>$1</em>");
}

const QUICK_PROMPTS = [
  "Analyze AAPL stock today",
  "S&P 500 market outlook",
  "Best tech stocks to buy?",
  "Explain P/E ratio",
];

export function Chatbot() {
  const { isOpen, messages, isTyping, sendMessage, clearMessages, closeChat } = useChatStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const msg = input.trim();
    setInput("");
    await sendMessage(msg);
  };

  return (
    <div className="flex flex-col w-full h-full bg-card overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/50 bg-card/60 backdrop-blur-md relative z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold text-foreground flex items-center gap-2 leading-tight">
              Aria Assistant
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
              </span>
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium">Always here to help</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted" onClick={clearMessages} title="Clear conversation">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted" onClick={closeChat}>
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto bg-background/50 p-6 space-y-6 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-80 mt-10">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center rotate-3">
              <BotMessageSquare className="w-8 h-8 text-primary -rotate-3" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Hi, I&apos;m Aria!</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto">
                Your AI trading assistant. Ask me to analyze stocks, summarize news, or explain market concepts.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={cn("w-full flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "user" ? (
              <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm">
                <p className="text-xs font-medium">{msg.content}</p>
              </div>
            ) : (
              <div className="max-w-[90%] bg-card border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-bold text-foreground">Aria</span>
                </div>
                <MessageContent content={msg.content} />
              </div>
            )}
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-5 pb-2 pt-3 flex flex-wrap gap-1.5 bg-background/80 backdrop-blur-sm z-10">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-[11px] px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all border border-border/50 shadow-sm"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-background/90 backdrop-blur-xl shrink-0 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pt-2">
        <div className="flex items-end gap-2 bg-card border border-border rounded-[20px] p-1.5 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-sm w-full text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[36px] max-h-[120px] py-1.5 pl-3"
            style={{ boxShadow: "none", border: "none", outline: "none" }}
            placeholder="Ask Aria anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={isTyping}
            autoComplete="off"
            spellCheck="false"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={cn(
               "w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 mb-0 mr-0",
              input.trim() && !isTyping
                ? "bg-primary text-primary-foreground shadow-md hover:scale-105"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4 ml-[-2px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
