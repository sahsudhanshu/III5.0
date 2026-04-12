"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { useSession, signOut } from "next-auth/react";
import { useMarketStore } from "@/store/market-store";
import { useChatStore } from "@/store/chat-store";
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
import { useDataStore, INITIAL_UNIVERSE } from "@/store/data-store";
import {
  Search, Bell, Sun, Moon, Bot, TrendingUp, TrendingDown,
  ChevronDown, X, Settings, LogOut, Loader2, Sparkles, User as UserIcon
} from "lucide-react";

// ── Primary nav items (Groww style) ──
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explore", label: "Explore" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/transactions", label: "Transactions" },
  { href: "/news", label: "News" },
  { href: "/watchlist", label: "Watchlist" },
];

// ── Company brand ──
function GrowwLogo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
        <span className="text-white font-black text-sm">G</span>
      </div>
      <span className="font-bold text-lg text-foreground hidden sm:block tracking-tight">
        Trade<span className="text-primary">IQ</span>
      </span>
    </Link>
  );
}

// ── Search dropdown ──
function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { stocks } = useDataStore();
  const availableStocks = INITIAL_UNIVERSE.map(s => stocks[s]).filter(Boolean);

  const results = availableStocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 7);

  return (
    <div className="relative w-full max-w-xs lg:max-w-sm xl:max-w-md">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex items-center gap-2 w-full h-9 px-3 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80 transition-colors"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left text-xs">Search stocks, ETFs…</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-background border border-border rounded px-1.5 py-0.5">
          Ctrl K
        </kbd>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search stocks, indices, ETFs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery("")}>
                  <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {results.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No results found</p>
              ) : (
                results.map((s) => (
                  <button
                    key={s.symbol}
                    className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      router.push(`/explore/${s.symbol}`);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary">{s.symbol.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{s.symbol}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{s.name}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold num text-foreground">{formatCurrency(s.price)}</p>
                      <p className={cn("text-[11px] num font-medium", s.changePercent >= 0 ? "text-bull" : "text-bear")}>
                        {s.changePercent >= 0 ? "+" : ""}{formatPercent(s.changePercent)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Market Ticker (compact) ──
function MarketTicker() {
  const { prices, subscribe, unsubscribe } = useMarketStore();

  useEffect(() => {
    // Subscribe to ticker stocks for live updates
    const symbols = INITIAL_UNIVERSE.map(s => s === "BTC" ? "BINANCE:BTCUSDT" : s).slice(0, 5);
    symbols.forEach(s => subscribe(s));

    return () => {
      symbols.forEach(s => unsubscribe(s));
    };
  }, [subscribe, unsubscribe]);

  const { stocks } = useDataStore();

  // Merge static with live prices
  const displayStocks = INITIAL_UNIVERSE.slice(0, 5).map(symbol => {
    const s = stocks[symbol];
    // Fallback to default data if not loaded yet
    if (!s) {
      return {
        symbol,
        name: symbol,
        price: 0,
        changePercent: 0,
        currentPrice: 0,
        isUp: false,
        live: false
      };
    }
    const finnhubSymbol = symbol === "BTC" ? "BINANCE:BTCUSDT" : symbol;
    const live = prices[finnhubSymbol];
    if (live) {
      // Calculate derived change based on our static mock base if needed
      const diff = live.price - s.price;
      const isUp = diff >= 0;
      return { ...s, currentPrice: live.price, isUp, live: true };
    }
    return { ...s, currentPrice: s.price, isUp: s.changePercent >= 0, live: false };
  });

  return (
    <div className="flex items-center gap-4 overflow-hidden w-[32rem] flex-shrink-0">
      <div className="flex items-center gap-4 animate-ticker w-max">
        {[...displayStocks, ...displayStocks].map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-[11px] font-semibold text-muted-foreground">{s.symbol}</span>
            <span className={cn("text-[11px] font-bold num transition-colors duration-300",
              s.live && s.isUp ? "text-bull" : s.live && !s.isUp ? "text-bear" :
                s.changePercent >= 0 ? "text-bull" : "text-bear"
            )}>
              {s.price > 0 ? (s.live ? formatCurrency(s.currentPrice) : (s.changePercent >= 0 ? "+" : "") + formatPercent(s.changePercent)) : "—"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main Navbar with bottom tabs ──
export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const user = session?.user;
  const { toggleChat } = useChatStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 0); }, []);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/auth/login" });
  };

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
        {/* Logo */}
        <GrowwLogo />

        {/* Ticker - increased width */}
        <div className="hidden md:flex ml-6">
          <MarketTicker />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search — right side */}
        <div className="flex items-center px-2">
          <SearchBar />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* AI Assistant */}
          <button
            onClick={toggleChat}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
            title="AI Assistant"
          >
            <Bot className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
          </button>

          {/* Notifications */}
          <button className="relative flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1 right-1 min-w-[14px] h-3.5 rounded-full bg-bear text-white text-[8px] font-bold flex items-center justify-center px-0.5">
              3
            </span>
          </button>

          {/* Theme */}
          {mounted && (
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
            >
              {theme === "dark"
                ? <Sun className="w-4 h-4 text-muted-foreground" />
                : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          )}

          {/* User */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 h-8 px-2 rounded-lg hover:bg-muted transition-colors">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">
                  {user?.name?.split(" ").map((n) => n[0]).join("") ?? "U"}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <p className="font-semibold text-foreground text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">{user?.email}</p>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>Dashboard</DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/portfolio")}>Portfolio</DropdownMenuItem>
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
      </div>

      {/* ── Bottom nav tabs (Groww style) ── */}
      <nav className="flex items-center gap-0 px-4 lg:px-6 overflow-x-auto scrollbar-none">
        {NAV_ITEMS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center h-10 px-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                isActive
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
