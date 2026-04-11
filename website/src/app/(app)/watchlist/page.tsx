"use client";
import { useWatchlistStore } from "@/store/watchlist-store";
import { useRouter } from "next/navigation";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function WatchlistPage() {
  const { items, removeFromWatchlist } = useWatchlistStore();
  const router = useRouter();

  const handleRemove = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromWatchlist(symbol);
    toast.success(`${symbol} removed from watchlist`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Watchlist</h1>
          <p className="text-muted-foreground text-sm">{items.length} stocks being tracked</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => router.push("/markets")}>
          <Plus className="w-3.5 h-3.5" />
          Add Stocks
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Star className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold text-muted-foreground">No stocks in watchlist</p>
          <p className="text-sm text-muted-foreground mb-6">Add stocks from the Markets page to track them here</p>
          <Button onClick={() => router.push("/markets")}>Browse Markets</Button>
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
