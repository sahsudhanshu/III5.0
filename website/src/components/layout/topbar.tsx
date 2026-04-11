"use client";
import { Bell, Search, Sun, Moon, Bot, TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useChatStore } from "@/store/chat-store";
import { useAuthStore } from "@/store/auth-store";
import { TICKER_STOCKS } from "@/lib/mock-data";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { toggleChat } = useChatStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const filteredStocks = TICKER_STOCKS.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center gap-4 px-4 sticky top-0 z-20">
      {/* Market Ticker */}
      <div className="flex-1 overflow-hidden hidden md:block">
        <div className="flex items-center gap-6 animate-ticker w-max">
          {[...TICKER_STOCKS, ...TICKER_STOCKS].map((s, i) => (
            <button
              key={`${s.symbol}-${i}`}
              onClick={() => router.push(`/markets/${s.symbol}`)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              <span className="text-xs font-semibold text-foreground">{s.symbol}</span>
              <span className="text-xs num text-foreground">{formatCurrency(s.price)}</span>
              <span className={cn("text-xs num flex items-center gap-0.5", s.change >= 0 ? "text-bull" : "text-bear")}>
                {s.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatPercent(s.changePercent)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative hidden sm:block">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 cursor-pointer w-48 lg:w-64" onClick={() => setSearchOpen(true)}>
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Search stocks...</span>
          <kbd className="ml-auto text-[10px] bg-background border border-border rounded px-1 py-0.5 text-muted-foreground">⌘K</kbd>
        </div>

        {searchOpen && (
          <div className="absolute top-full right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-xl z-50">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Search stocks, indices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredStocks.slice(0, 6).map((s) => (
                <button
                  key={s.symbol}
                  className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-accent transition-colors"
                  onClick={() => {
                    router.push(`/markets/${s.symbol}`);
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-primary">{s.symbol.slice(0, 2)}</span>
                    </div>
                    <span className="text-sm font-semibold">{s.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm num">{formatCurrency(s.price)}</p>
                    <p className={cn("text-xs num", s.change >= 0 ? "text-bull" : "text-bear")}>
                      {formatPercent(s.changePercent)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {searchOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* AI Chat */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleChat}
          className="relative h-8 w-8"
          title="AI Assistant"
        >
          <Bot className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="w-4 h-4" />
          <Badge className="absolute -top-0.5 -right-0.5 w-4 h-4 p-0 text-[9px] flex items-center justify-center bg-primary">
            3
          </Badge>
        </Button>

        {/* Theme toggle */}
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        )}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex items-center gap-2 h-8 px-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">
                {user?.name?.split(" ").map((n) => n[0]).join("") ?? "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium hidden sm:block">{user?.name?.split(" ")[0] ?? "User"}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="font-semibold text-foreground">{user?.name}</p>
                <p className="text-xs text-muted-foreground font-normal">{user?.email}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>Dashboard</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                Log out
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
