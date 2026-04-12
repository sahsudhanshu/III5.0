import { useEffect } from "react";
import { Navbar } from "./navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useMarketStore } from "@/store/market-store";
import { useChatStore } from "@/store/chat-store";
import { Chatbot } from "@/components/layout/chatbot";
import { AuthModal } from "@/components/auth/auth-modal";
import { AnimatePresence, motion } from "framer-motion";

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
      <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
        {/* Fixed top navbar */}
        <div className="shrink-0 z-50">
          <Navbar />
        </div>

        {/* Page content */}
        <main className="flex-1 w-full flex overflow-hidden relative z-0">
          <motion.div layout className="flex-1 min-w-0 overflow-y-auto">
            <div className="animate-fade-in-up min-h-full">
              {children}
            </div>
          </motion.div>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                layout
                initial={{ opacity: 0, x: 300, width: 0 }}
                animate={{ opacity: 1, x: 0, width: 400 }}
                exit={{ opacity: 0, x: 300, width: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="shrink-0 border-l border-border bg-card h-full z-40 overflow-hidden"
              >
                <div className="w-[400px] h-full flex flex-col p-4 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
                  <Chatbot />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      <AuthModal />
    </TooltipProvider>
  );
}
