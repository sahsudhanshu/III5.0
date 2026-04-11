import { Navbar } from "./navbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useChatStore } from "@/store/chat-store";
import { Chatbot } from "@/components/layout/chatbot";
import { AnimatePresence, motion } from "framer-motion";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isOpen } = useChatStore();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Sticky top navbar (no sidebar) */}
        <Navbar />

        {/* Page content */}
        <main className="flex-1 w-full flex relative">
          <motion.div layout className="flex-1 min-w-0">
            <div className="animate-fade-in-up">
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
                className="shrink-0 border-l border-border bg-card sticky top-[64px] h-[calc(100vh-64px)] z-40 overflow-hidden"
              >
                <div className="w-[400px] h-full flex flex-col p-4 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
                  <Chatbot />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </TooltipProvider>
  );
}
