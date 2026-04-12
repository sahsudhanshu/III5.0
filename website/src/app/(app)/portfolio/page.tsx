/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { usePortfolioStore } from "@/store/portfolio-store";
import { useMarketStore } from "@/store/market-store";
import { useDataStore } from "@/store/data-store";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown, Wallet, BarChart2, PlusCircle, MinusCircle, X } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

function buildFlatPortfolioHistory(currentValue: number, days = 365) {
  const today = new Date();
  const normalized = Number.isFinite(currentValue) ? Math.max(0, currentValue) : 0;

  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - i));
    return {
      date: date.toISOString().split("T")[0],
      value: parseFloat(normalized.toFixed(2)),
    };
  });
}

// ── Funds Modal ─────────────────────────────────────────────────
function FundsModal({
  type,
  onClose,
  onConfirm,
}: {
  type: "DEPOSIT" | "WITHDRAW";
  onClose: () => void;
  onConfirm: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  const isDeposit = type === "DEPOSIT";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {isDeposit ? "Add Funds" : "Withdraw Funds"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {isDeposit
            ? "Add paper money to your trading account."
            : "Withdraw cash from your trading account."}
        </p>
        <input
          type="number"
          placeholder="Enter amount (USD)"
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm mb-4 outline-none focus:border-primary transition-colors"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={1}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const a = parseFloat(amount);
              if (!a || a <= 0) { toast.error("Enter a valid amount"); return; }
              onConfirm(a);
            }}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors",
              isDeposit ? "bg-bull hover:bg-bull/90" : "bg-bear hover:bg-bear/90"
            )}
          >
            Confirm {type}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Portfolio Page ─────────────────────────────────────────
export default function PortfolioPage() {
  const router = useRouter();
  const {
    portfolio,
    loading,
    fetchPortfolio,
    fetchAiInsight,
    aiInsight,
    aiInsightLoading,
    aiInsightError,
    manageFunds,
    enrichWithPrices,
  } = usePortfolioStore();
  const { prices } = useMarketStore();
  const [timeRange, setTimeRange] = useState("3M");
  const [fundsModal, setFundsModal] = useState<"DEPOSIT" | "WITHDRAW" | null>(null);
  const [fundsLoading, setFundsLoading] = useState(false);
  const { isAuthenticated, requireAuth } = useRequireAuth();
  const { stocks, fetchStockProfile } = useDataStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchPortfolio();
      fetchAiInsight();
    }
  }, [fetchPortfolio, fetchAiInsight, isAuthenticated]);

  const holdings = portfolio?.holdings ?? [];

  // Fetch true prices via data store 
  useEffect(() => {
    let mounted = true;
    async function loadPrices() {
      const symbols = holdings.map((h) => h.symbol);
      for (const sym of symbols) {
        if (!mounted) return;
        await fetchStockProfile(sym);
        await new Promise(r => setTimeout(r, 100)); // safety sleep
      }
    }
    if (holdings.length) {
      loadPrices();
    }
    return () => { mounted = false; };
  }, [holdings, fetchStockProfile]);

  // Enrich holdings with live Finnhub prices whenever prices tick
  const priceMap = useCallback(() => {
    const map: Record<string, number> = {};
    
    // Base static prices
    Object.entries(stocks).forEach(([sym, data]) => {
      map[sym] = data.price;
    });

    // Overwrite with live ticks
    Object.entries(prices).forEach(([sym, data]) => {
      map[sym] = data.price;
    });
    
    return map;
  }, [prices, stocks]);

  useEffect(() => {
    if (portfolio?.holdings?.length) {
      enrichWithPrices(priceMap());
    }
  }, [prices, portfolio?.holdings?.length, enrichWithPrices, priceMap]);

  // ── Computed Stats ───────────────────────────────────────────
  const cashBalance = portfolio?.cashBalance ?? 0;
  const totalInvested = portfolio?.holdings?.reduce((s, h) => s + (h.investedValue ?? h.avgBuyPrice * h.qty), 0) ?? 0;
  const totalCurrentValue = portfolio?.holdings?.reduce((s, h) => s + (h.currentValue ?? h.avgBuyPrice * h.qty), 0) ?? 0;
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const totalPortfolioValue = cashBalance + totalCurrentValue;
  const hasPortfolioActivity =
    (portfolio?.holdings?.length ?? 0) > 0 ||
    (portfolio?.transactions?.length ?? 0) > 0;

  const activityStartDate = useMemo(() => {
    const timestamps = (portfolio?.transactions ?? [])
      .map((t) => new Date(t.timestamp).getTime())
      .filter((n) => Number.isFinite(n));

    if (timestamps.length > 0) {
      const first = new Date(Math.min(...timestamps));
      first.setHours(0, 0, 0, 0);
      return first;
    }

    if ((portfolio?.holdings?.length ?? 0) > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

    return null;
  }, [portfolio?.transactions, portfolio?.holdings?.length]);

  const history1Y = useMemo(() => {
    if (!hasPortfolioActivity || !activityStartDate) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.floor((today.getTime() - activityStartDate.getTime()) / 86400000) + 1);
    return buildFlatPortfolioHistory(totalPortfolioValue, days);
  }, [hasPortfolioActivity, activityStartDate, totalPortfolioValue]);

  const chartData = hasPortfolioActivity ? ({
    "1W": history1Y.slice(-7),
    "1M": history1Y.slice(-30),
    "3M": history1Y.slice(-90),
    "6M": history1Y.slice(-180),
  }[timeRange] ?? history1Y.slice(-90)) : [];
  const xTickInterval = useMemo(() => {
    switch (timeRange) {
      case "1W":
        return 0;
      case "1M":
        return 4;
      case "3M":
        return 10;
      case "6M":
        return 20;
      default:
        return Math.max(1, Math.floor(chartData.length / 8));
    }
  }, [timeRange, chartData.length]);

  const formatTimelineTick = useCallback((value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    if (timeRange === "1W") {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }

    if (timeRange === "6M") {
      return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
    }

    return date.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  }, [timeRange]);

  const formatTooltipDate = useCallback((value: any) => {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }, []);

  const handleFundsConfirm = async (amount: number) => {
    if (!fundsModal) return;
    setFundsLoading(true);
    const ok = await manageFunds(fundsModal, amount);
    if (ok) toast.success(`${fundsModal === "DEPOSIT" ? "Added" : "Withdrawn"} ${formatCurrency(amount)} successfully`);
    setFundsLoading(false);
    setFundsModal(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="px-3 sm:px-4 lg:px-6 py-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <Wallet className="w-10 h-10 text-muted-foreground/50" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Access Your Portfolio</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Sign in to view your personalized portfolio, track live P&L, manage holdings, and deposit funds to your paper trading account.
        </p>
        <button
          onClick={() => requireAuth(() => {}, "Sign in to view and manage your portfolio")}
          className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl shadow-[0_0_20px_rgba(0,208,156,0.2)] hover:shadow-[0_0_30px_rgba(0,208,156,0.4)] transition-all"
        >
          Sign in to view
        </button>
      </div>
    );
  }

  if (loading && !portfolio) {
    return (
      <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 animate-pulse max-w-[1700px] mx-auto">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
        </div>
        <div className="h-64 bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-6 max-w-[1700px] mx-auto">
      {fundsModal && (
        <FundsModal
          type={fundsModal}
          onClose={() => setFundsModal(null)}
          onConfirm={handleFundsConfirm}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground text-sm">Your holdings, balance & performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFundsModal("DEPOSIT")}
            disabled={fundsLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-bull/10 text-bull border border-bull/30 rounded-xl text-xs font-semibold hover:bg-bull/20 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Add Funds
          </button>
          <button
            onClick={() => setFundsModal("WITHDRAW")}
            disabled={fundsLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-bear/10 text-bear border border-bear/30 rounded-xl text-xs font-semibold hover:bg-bear/20 transition-colors"
          >
            <MinusCircle className="w-3.5 h-3.5" /> Withdraw
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Value", value: totalPortfolioValue, icon: <Wallet className="w-4 h-4 text-primary" />, sub: `Cash: ${formatCurrency(cashBalance)}` },
          { label: "Invested", value: totalInvested, icon: <BarChart2 className="w-4 h-4 text-chart-2" />, sub: `${portfolio?.holdings?.length ?? 0} positions` },
          { label: "Total P&L", value: totalPnL, icon: <TrendingUp className="w-4 h-4 text-bull" />, isChange: true, pct: totalPnLPct },
          { label: "Available Cash", value: cashBalance, icon: <Wallet className="w-4 h-4 text-chart-5" />, sub: "Ready to invest" },
        ].map(({ label, value, icon, sub, isChange, pct }) => (
          <div key={label} className="groww-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
              {icon}
            </div>
            <p className={cn("text-xl font-black num", isChange && (value >= 0 ? "text-bull" : "text-bear"))}>
              {isChange && value >= 0 ? "+" : ""}{formatCurrency(value)}
            </p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            {isChange && pct !== undefined && (
              <div className={cn("inline-flex items-center gap-0.5 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full", value >= 0 ? "bg-bull-muted text-bull" : "bg-bear-muted text-bear")}>
                {value >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(pct).toFixed(2)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="groww-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Value Over Time</h2>
          <div className="flex gap-1">
            {["1W", "1M", "3M", "6M"].map((t) => (
              <button key={t} onClick={() => setTimeRange(t)} className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors", timeRange === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {!hasPortfolioActivity && (
          <p className="text-xs text-muted-foreground mb-3">
            No portfolio activity yet. The chart will update after you add funds or place your first trade.
          </p>
        )}
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="oklch(0.65 0.18 151)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="oklch(0.65 0.18 151)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatTimelineTick}
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={xTickInterval}
              minTickGap={20}
            />
            <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              labelFormatter={formatTooltipDate}
              formatter={(v: any) => [formatCurrency(v), "Value"]}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
            />
            <Area type="monotone" dataKey="value" stroke="oklch(0.65 0.18 151)" strokeWidth={2} fill="url(#grad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* AI Insight */}
      <div className="groww-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">AI Insight</h2>
            <p className="text-xs text-muted-foreground">RL rebalancing + market sentiment guidance</p>
          </div>
          <button
            onClick={() => fetchAiInsight()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors"
          >
            Refresh Insight
          </button>
        </div>

        {aiInsightLoading && (
          <p className="text-sm text-muted-foreground">Generating AI insight...</p>
        )}

        {!aiInsightLoading && aiInsightError && (
          <p className="text-sm text-bear">{aiInsightError}</p>
        )}

        {!aiInsightLoading && aiInsight && (
          <>
            {aiInsight.is_fallback && (
              <p className="text-xs text-amber-500">
                Using fallback insight: {aiInsight.fallback_reason ?? "AI model unavailable"}
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Net Worth</p>
                <p className="text-lg font-bold num">{formatCurrency(aiInsight.net_worth)}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Buy Ideas</p>
                <p className="text-lg font-bold num text-bull">{aiInsight.buy_suggestions.length}</p>
              </div>
              <div className="rounded-xl border border-border p-3">
                <p className="text-[11px] text-muted-foreground">Sell Ideas</p>
                <p className="text-lg font-bold num text-bear">{aiInsight.sell_suggestions.length}</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground/90">{aiInsight.ai_insight_text}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-bull mb-2">Top Buys</p>
                {aiInsight.buy_suggestions.slice(0, 3).map((s) => (
                  <p key={`buy-${s.ticker}`} className="text-xs text-muted-foreground">
                    {s.ticker}: Buy {Math.abs(s.shares_to_trade).toFixed(2)} shares (target {s.target_weight_pct}%)
                  </p>
                ))}
                {aiInsight.buy_suggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No buy action suggested now.</p>
                )}
              </div>

              <div className="rounded-xl border border-border p-3">
                <p className="text-xs font-semibold text-bear mb-2">Top Sells</p>
                {aiInsight.sell_suggestions.slice(0, 3).map((s) => (
                  <p key={`sell-${s.ticker}`} className="text-xs text-muted-foreground">
                    {s.ticker}: Sell {Math.abs(s.shares_to_trade).toFixed(2)} shares (target {s.target_weight_pct}%)
                  </p>
                ))}
                {aiInsight.sell_suggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No sell action suggested now.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Holdings Table */}
      <div className="groww-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Holdings</h2>
          <span className="text-xs text-muted-foreground">{portfolio?.holdings?.length ?? 0} positions</span>
        </div>

        {!portfolio?.holdings?.length ? (
          <div className="p-12 text-center">
            <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No holdings yet</p>
            <p className="text-xs text-muted-foreground mt-1">Browse stocks and place your first order</p>
            <button onClick={() => router.push("/explore")} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-semibold">
              Explore Stocks
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Stock", "Qty", "Avg Price", "LTP", "Invested", "Current", "P&L", "P&L %"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.map((h) => {
                  const pnl = h.pnl ?? 0;
                  const pnlPct = h.pnlPercent ?? 0;
                  const pos = pnl >= 0;
                  return (
                    <tr key={h.symbol} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => router.push(`/explore/${h.symbol}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-[9px] font-bold text-primary">{h.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{h.symbol}</p>
                            <p className="text-[10px] text-muted-foreground">{h.sector}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm num">{h.qty}</td>
                      <td className="px-4 py-3 text-sm num">{formatCurrency(h.avgBuyPrice)}</td>
                      <td className="px-4 py-3 text-sm num font-semibold">{formatCurrency(h.currentPrice ?? h.avgBuyPrice)}</td>
                      <td className="px-4 py-3 text-sm num">{formatCurrency(h.investedValue ?? h.avgBuyPrice * h.qty)}</td>
                      <td className="px-4 py-3 text-sm num font-semibold">{formatCurrency(h.currentValue ?? h.avgBuyPrice * h.qty)}</td>
                      <td className="px-4 py-3">
                        <p className={cn("text-sm num font-semibold", pos ? "text-bull" : "text-bear")}>
                          {pos ? "+" : ""}{formatCurrency(pnl)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full num", pos ? "bg-bull-muted text-bull" : "bg-bear-muted text-bear")}>
                          {pos ? "+" : ""}{formatPercent(pnlPct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
