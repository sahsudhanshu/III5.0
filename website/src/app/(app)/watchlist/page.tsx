"use client";
import { useMemo, useState } from "react";
import { useWatchlistStore } from "@/store/watchlist-store";
import { useRouter } from "next/navigation";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, TrendingUp, TrendingDown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { INITIAL_UNIVERSE, useDataStore } from "@/store/data-store";

export default function WatchlistPage() {
  const { items, removeFromWatchlist, addToWatchlist, isInWatchlist } = useWatchlistStore();
  const { stocks, fetchStockProfile } = useDataStore();
  const router = useRouter();
  const { isAuthenticated, requireAuth } = useRequireAuth();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [symbolInput, setSymbolInput] = useState("");
  const [adding, setAdding] = useState(false);

  const quickPicks = useMemo(
    () => INITIAL_UNIVERSE.filter((s) => !isInWatchlist(s)).slice(0, 8),
    [isInWatchlist]
  );
  
  const handleRemove = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromWatchlist(symbol);
    toast.success(`${symbol} removed from watchlist`);
  };

  const handleAddStock = async (rawSymbol?: string) => {
    const symbol = (rawSymbol ?? symbolInput).trim().toUpperCase();
    if (!symbol) {
      toast.error("Enter a stock symbol");
      return;
    }

    if (isInWatchlist(symbol)) {
      toast.info(`${symbol} is already in your watchlist`);
      return;
    }

    setAdding(true);
    try {
      const stock = stocks[symbol] ?? await fetchStockProfile(symbol);
      if (!stock) {
        toast.error(`Could not find ${symbol}. Try another symbol.`);
        return;
      }

      addToWatchlist({
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        price: stock.price,
        change: stock.change,
        changePercent: stock.changePercent,
        volume: stock.volume,
        addedAt: new Date().toISOString(),
      });

      toast.success(`${stock.symbol} added to watchlist`);
      setSymbolInput("");
    } finally {
      setAdding(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <Star className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Track Your Favorites</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Sign in to create a customized watchlist, monitor price action, and get instant notifications on your favorite assets.
        </p>
        <button
          onClick={() => requireAuth(() => {}, "Sign in to view and manage your watchlist")}
          className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_0_20px_rgba(0,208,156,0.2)] hover:shadow-[0_0_30px_rgba(0,208,156,0.4)] transition-all"
        >
          Sign in & Build Watchlist
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Watchlist</h1>
          <p className="text-muted-foreground text-sm">{items.length} stocks being tracked</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowAddPanel((v) => !v)}>
          <Plus className="w-3.5 h-3.5" />
          Add Stocks
        </Button>
      </div>

      {showAddPanel && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Enter stock symbol (e.g., AAPL)"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddStock();
                }
              }}
              className="h-9 sm:flex-1"
            />
            <Button className="h-9" onClick={() => handleAddStock()} disabled={adding}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </div>

          {quickPicks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickPicks.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleAddStock(symbol)}
                  className="px-2.5 py-1 rounded-full text-xs bg-muted hover:bg-muted/70 text-foreground transition-colors"
                  disabled={adding}
                >
                  + {symbol}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Star className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">No stocks in watchlist</p>
          <p className="text-sm text-muted-foreground mb-6">Use Add Stocks above to start tracking your favorites</p>
          <Button onClick={() => setShowAddPanel(true)}>Add Your First Stock</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Stock", "Price", "Change", "Volume", "Exchange", "Added", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.symbol}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/markets/${item.symbol}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-primary">{item.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{item.symbol}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{item.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm num font-semibold">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3">
                      <div className={cn("flex items-center gap-1", item.change >= 0 ? "text-bull" : "text-bear")}>
                        {item.change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span className="text-sm num font-semibold">{formatPercent(item.changePercent)}</span>
                      </div>
                      <p className={cn("text-[10px] num pl-4", item.change >= 0 ? "text-bull" : "text-bear")}>
                        {item.change >= 0 ? "+" : ""}{formatCurrency(item.change)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs num text-muted-foreground">{(item.volume / 1000000).toFixed(2)}M</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{item.exchange}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(item.addedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => handleRemove(item.symbol, e)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-bear hover:bg-bear-muted transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
