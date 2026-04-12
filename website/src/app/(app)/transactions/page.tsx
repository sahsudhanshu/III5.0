"use client";
import { useEffect, useState } from "react";
import { usePortfolioStore } from "@/store/portfolio-store";
import { formatCurrency, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight, ArrowDownRight, Search,
  PlusCircle, MinusCircle, Activity,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-bull-muted text-bull",
  FAILED: "bg-bear-muted text-bear",
};

const TYPE_COLORS: Record<string, string> = {
  BUY:      "bg-bear-muted",
  SELL:     "bg-bull-muted",
  DEPOSIT:  "bg-primary/10",
  WITHDRAW: "bg-chart-5/10",
};

function TypeIcon({ type }: { type: string }) {
  if (type === "BUY")      return <ArrowDownRight className="w-4 h-4 text-bear" />;
  if (type === "SELL")     return <ArrowUpRight className="w-4 h-4 text-bull" />;
  if (type === "DEPOSIT")  return <PlusCircle className="w-4 h-4 text-primary" />;
  if (type === "WITHDRAW") return <MinusCircle className="w-4 h-4 text-chart-5" />;
  return <Activity className="w-4 h-4 text-muted-foreground" />;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function TransactionsPage() {
  const { portfolio, fetchPortfolio, loading } = usePortfolioStore();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW">("ALL");

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  const transactions = [...(portfolio?.transactions ?? [])]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filtered = transactions.filter((t) => {
    const matchSearch =
      (t.symbol ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (t.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      t.type.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalBought  = transactions.filter(t => t.type === "BUY"  && t.status === "COMPLETED").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalSold    = transactions.filter(t => t.type === "SELL" && t.status === "COMPLETED").reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalFees    = transactions.reduce((s, t) => s + (t.fee ?? 0), 0);

  if (loading && !portfolio) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm">Your complete order & fund history</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Transactions", value: transactions.length, isMoney: false },
          { label: "Total Bought",       value: totalBought,         isMoney: true,  color: "text-bear" },
          { label: "Total Sold",         value: totalSold,           isMoney: true,  color: "text-bull" },
          { label: "Fees Paid",          value: totalFees,           isMoney: true,  color: "text-muted-foreground" },
        ].map(({ label, value, isMoney, color }) => (
          <div key={label} className="groww-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={cn("text-xl font-bold num", color)}>
              {isMoney ? formatCurrency(value as number) : value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(["ALL", "BUY", "SELL", "DEPOSIT", "WITHDRAW"] as const).map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="groww-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              {transactions.length === 0
                ? "Place your first order on the Explore page"
                : "No transactions match your filters"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Type", "Details", "Qty", "Price", "Total", "Fee", "Status", "When"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    {/* Type icon */}
                    <td className="px-4 py-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", TYPE_COLORS[t.type] ?? "bg-muted")}>
                        <TypeIcon type={t.type} />
                      </div>
                    </td>
                    {/* Details */}
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{t.symbol ?? t.type}</p>
                      <p className="text-[10px] text-muted-foreground">{t.name ?? (t.type === "DEPOSIT" ? "Funds added" : t.type === "WITHDRAW" ? "Funds withdrawn" : "")}</p>
                    </td>
                    {/* Qty */}
                    <td className="px-4 py-3 text-sm num text-muted-foreground">
                      {t.qty != null ? t.qty : "—"}
                    </td>
                    {/* Price */}
                    <td className="px-4 py-3 text-sm num">
                      {t.price != null ? formatCurrency(t.price) : "—"}
                    </td>
                    {/* Total */}
                    <td className="px-4 py-3">
                      <p className={cn(
                        "text-sm num font-semibold",
                        t.amount >= 0 ? "text-bull" : "text-bear"
                      )}>
                        {t.amount >= 0 ? "+" : ""}{formatCurrency(Math.abs(t.amount))}
                      </p>
                    </td>
                    {/* Fee */}
                    <td className="px-4 py-3 text-xs num text-muted-foreground">
                      {t.fee > 0 ? formatCurrency(t.fee) : "—"}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[t.status] ?? "bg-muted text-muted-foreground")}>
                        {t.status}
                      </span>
                    </td>
                    {/* Time */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(t.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
