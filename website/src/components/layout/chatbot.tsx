"use client";
import { useChatStore } from "@/store/chat-store";
import { cn } from "@/lib/utils";
import { X, Activity, Terminal, RefreshCw, Command } from "lucide-react";
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
            <div key={i} className="flex gap-2 pl-3 mt-1 border-l-2 border-primary/30">
              <span className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
            </div>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-foreground mt-3 mb-1" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />;
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
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex flex-col w-full h-full bg-background rounded-l-2xl border-l border-border shadow-2xl overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card relative overflow-hidden">
        {/* Subtle scanline effect in header */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-50 pointer-events-none" />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded shrink-0 bg-primary/10 border border-primary/40 flex items-center justify-center shadow-[0_0_10px_rgba(0,208,156,0.15)]">
            <Terminal className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground flex items-center gap-2 tracking-wide uppercase">
              TradeIQ Data Terminal
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            </p>
            <p className="text-[9px] text-primary/70 font-mono tracking-widest mt-0.5">ESTABLISHED CONNECTION</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={clearMessages} title="Clear terminal">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={closeChat}>
            <X className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto bg-background p-4 space-y-6">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground/60 select-none pb-4 border-b border-border/40">
            [SYS] Initialization complete. Engine active.<br/>
            [SYS] Enter query to execute market analysis module.
          </div>
        )}

        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full flex"
          >
            {msg.role === "user" ? (
              <div className="w-full">
                <div className="flex items-center gap-2 mb-1.5 opacity-60">
                  <span className="text-[10px] font-bold text-foreground">EXECUTE QUERY</span>
                  <div className="h-[1px] flex-1 bg-border" />
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-primary font-bold">{">"}</span>
                  <span className="text-foreground">{msg.content}</span>
                </div>
              </div>
            ) : (
              <div className="w-full bg-card/50 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Analysis Engine Output</span>
                </div>
                <MessageContent content={msg.content} />
              </div>
            )}
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full bg-card/30 border border-border/30 rounded-lg p-3 flex items-center gap-3">
            <Activity className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground animate-pulse">Computing market data...</span>
          </motion.div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Quick actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-3 flex flex-wrap gap-2 bg-background border-t border-border/20 pt-3">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-border"
            >
              / {p.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-card border-t border-border flex-shrink-0 relative z-10">
        <div className="flex items-center gap-3 bg-muted/30 border border-border/50 rounded-lg flex-1 px-3 py-2.5 focus-within:border-border focus-within:bg-muted/50 transition-all">
          <span className="text-primary font-bold text-sm select-none animate-pulse">$&gt;</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent font-mono text-xs w-full text-foreground placeholder:text-muted-foreground/40"
            style={{ boxShadow: "none", border: "none", outline: "none" }}
            placeholder="Execute analytical query..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isTyping}
            autoComplete="off"
            spellCheck="false"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className={cn(
              "w-6 h-6 rounded flex items-center justify-center transition-colors shrink-0",
              input.trim() && !isTyping
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground/50"
            )}
          >
            <Command className="w-3 h-3" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/40 text-center mt-2.5 font-sans select-none tracking-wide">
          TradeIQ Market Analysis Engine • Standard Mode
        </p>
      </div>
    </div>
  );
}
