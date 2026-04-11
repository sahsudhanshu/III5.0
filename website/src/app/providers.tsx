"use client";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="trading-theme"
    >
      {children}
      <Toaster
        position="bottom-left"
        toastOptions={{
          duration: 4000,
          classNames: {
            toast: "!bg-card !border-border !text-foreground",
            description: "!text-muted-foreground",
            actionButton: "!bg-primary !text-primary-foreground",
          },
        }}
      />
    </ThemeProvider>
  );
}
