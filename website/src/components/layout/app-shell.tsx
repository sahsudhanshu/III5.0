import { Navbar } from "./navbar";
import { Chatbot } from "./chatbot";
import { TooltipProvider } from "@/components/ui/tooltip";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Sticky top navbar (no sidebar) */}
        <Navbar />

        {/* Page content */}
        <main className="flex-1 w-full">
          <div className="animate-fade-in-up">
            {children}
          </div>
        </main>

        {/* Persistent AI Chatbot */}
        <Chatbot />
      </div>
    </TooltipProvider>
  );
}
