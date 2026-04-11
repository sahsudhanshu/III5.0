"use client";
import { useState } from "react";
import { MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { formatCurrency, formatDate, cn, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, ArrowDownRight, Search, Filter } from "lucide-react";
import type { TransactionType, TransactionStatus } from "@/types";

const STATUS_COLORS: Record<TransactionStatus, string> = {
  COMPLETED: "bg-bull-muted text-bull",
  PENDING: "bg-chart-5/20 text-chart-5",
  CANCELLED: "bg-muted text-muted-foreground",
  FAILED: "bg-bear-muted text-bear",
};

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | TransactionType>("ALL");

  const filtered = MOCK_TRANSACTIONS.filter((t) => {
    const matchSearch = t.symbol.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "ALL" || t.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalBuy = MOCK_TRANSACTIONS.filter((t) => t.type === "BUY" && t.status === "COMPLETED").reduce((s, t) => s + t.totalValue, 0);
  const totalSell = MOCK_TRANSACTIONS.filter((t) => t.type === "SELL" && t.status === "COMPLETED").reduce((s, t) => s + t.totalValue, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm">Your complete order history</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Transactions</p>
          <p className="text-2xl font-bold num">{MOCK_TRANSACTIONS.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Bought</p>
          <p className="text-2xl font-bold num text-bear">-{formatCurrency(totalBuy, { compact: true })}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Sold</p>
          <p className="text-2xl font-bold num text-bull">+{formatCurrency(totalSell, { compact: true })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {(["ALL", "BUY", "SELL"] as const).map((t) => (
            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm" className="h-9 text-xs" onClick={() => setTypeFilter(t)}>
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Type", "Stock", "Qty", "Price", "Total", "Charges", "Status", "Time"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", t.type === "BUY" ? "bg-bull-muted" : "bg-bear-muted")}>
                      {t.type === "BUY" ? <ArrowDownRight className="w-4 h-4 text-bull" /> : <ArrowUpRight className="w-4 h-4 text-bear" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{t.symbol}</p>
                    <p className="text-[10px] text-muted-foreground">{t.name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm num">{t.quantity}</td>
                  <td className="px-4 py-3 text-sm num">{formatCurrency(t.price)}</td>
                  <td className="px-4 py-3">
                    <p className={cn("text-sm num font-semibold", t.type === "BUY" ? "text-bear" : "text-bull")}>
                      {t.type === "BUY" ? "-" : "+"}{formatCurrency(t.totalValue)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs num text-muted-foreground">{formatCurrency(t.charges + t.taxes)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[t.status])}>{t.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(t.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
