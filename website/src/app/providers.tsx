"use client";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { SessionProvider } from "next-auth/react";
import { useAppTheme } from "@/hooks/use-app-theme";

export function Providers({ children }: { children: React.ReactNode }) {
  const { initialize } = useAppTheme();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <SessionProvider>
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
    </SessionProvider>
  );
}
