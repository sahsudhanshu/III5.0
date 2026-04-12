"use client";
import { useEffect } from "react";
import { Navbar } from "./navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMarketStore } from "@/store/market-store";
import { useChatStore } from "@/store/chat-store";
import { Chatbot } from "@/components/layout/chatbot";
import { AuthModal } from "@/components/auth/auth-modal";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { connect, disconnect } = useMarketStore();

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const { isOpen } = useChatStore();

  return (
    <TooltipProvider delay={300}>
      <div className="min-h-screen w-full bg-background flex flex-col">
        {/* Fixed top navbar */}
        <Navbar />

        {/* Spacer to push content below the fixed navbar */}
        {/* Mobile: h-14 (top bar only), Desktop: h-14 + h-11 (top bar + tab nav) = h-[6.25rem] */}
        <div className="h-14 md:h-[6.25rem] shrink-0" />

        {/* Page content */}
        <main className="flex-1 w-full relative z-0">
          <div
            className={cn(
              "animate-fade-in-up min-h-full transition-[padding] duration-300 pb-16 md:pb-0",
              isOpen ? "px-3 sm:px-4 lg:px-6 lg:pr-[416px]" : "px-3 sm:px-4 lg:px-8"
            )}
          >
            {children}
          </div>
        </main>

        {/* Fixed chatbot panel — starts below the fixed navbar */}
        {/* Mobile: top-[calc(3.5rem+1px)] (57px), Desktop: top-[calc(6.25rem+1px)] (101px) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
              className="fixed top-[calc(3.5rem+1px)] md:top-[calc(6.25rem+1px)] right-0 bottom-0 w-full sm:w-[420px] z-40 border-l border-border bg-card overflow-hidden shadow-[-8px_0_32px_rgba(0,0,0,0.08)]"
            >
              <Chatbot />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AuthModal />
    </TooltipProvider>
  );
}
