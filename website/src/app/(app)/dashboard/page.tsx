/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { formatCurrency, formatPercent, cn, timeAgo } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ChevronRight, Clock, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useDataStore, INITIAL_UNIVERSE } from "@/store/data-store";
import { usePortfolioStore } from "@/store/portfolio-store";
import { useNews } from "@/store/news-store";
import { useChatContext } from "@/store/chat-store";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { RestrictedOverlay } from "@/components/auth/restricted-overlay";

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const { isAuthenticated, requireAuth } = useRequireAuth();
  const router = useRouter();
  
  const { stocks, fetchStockProfile } = useDataStore();
  const { portfolio, fetchPortfolio } = usePortfolioStore();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1M");

  // Live news via Zustand store
  const { articles: marketNews, loading: loadingNews, refresh: refreshNews } = useNews("market", 4);


  // (dashboardContext and useChatContext declared after computed values below)


  useEffect(() => {
    if (isAuthenticated) {
      fetchPortfolio();
    }
  }, [fetchPortfolio, isAuthenticated]);

  useEffect(() => {
    async function loadUniverse() {
      setLoading(true);
      for (const symbol of INITIAL_UNIVERSE) {
        await fetchStockProfile(symbol);
        await new Promise(r => setTimeout(r, 100)); // Rate limit safety
      }
      setLoading(false);
    }
    const missing = INITIAL_UNIVERSE.some(sym => !stocks[sym]);
    if (missing) {
      loadUniverse();
    } else {
      setTimeout(() => setLoading(false), 0);
    }
  }, [fetchStockProfile, stocks]);

  const holdings = useMemo(() => {
    const source = portfolio?.holdings ?? [];
    return source.map((h) => {
      const livePrice = stocks[h.symbol]?.price ?? h.avgBuyPrice;
      const prevClose = stocks[h.symbol]?.previousClose ?? livePrice;
      const investedValue = h.avgBuyPrice * h.qty;
      const currentValue = livePrice * h.qty;
      const pnl = currentValue - investedValue;
      const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
      const dayChange = (livePrice - prevClose) * h.qty;
      const dayChangePercent = prevClose > 0 ? ((livePrice - prevClose) / prevClose) * 100 : 0;

      return {
        ...h,
        livePrice,
        investedValue,
        currentValue,
        pnl,
        pnlPercent,
        dayChange,
        dayChangePercent,
      };
    });
  }, [portfolio?.holdings, stocks]);

  const cash = portfolio?.cashBalance ?? 0;
  const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
  const totalCurrent = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalValue = cash + totalCurrent;
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const dayPnL = holdings.reduce((sum, h) => sum + h.dayChange, 0);
  const dayBase = totalCurrent - dayPnL;
  const dayPnLPercent = dayBase > 0 ? (dayPnL / dayBase) * 100 : 0;

  const history = useMemo(() => {
    const baseValue = totalValue > 0 ? totalValue : 10000;
    return Array.from({ length: 90 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (89 - i));
      return { date: d.toISOString(), value: baseValue };
    });
  }, [totalValue]);

  const transactions = useMemo(() => {
    return [...(portfolio?.transactions ?? [])]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [portfolio?.transactions]);

  const recentOrders = transactions
    .filter((t) => t.type === "BUY" || t.type === "SELL")
    .slice(0, 4);

  const sectorAllocation = useMemo(() => {
    const palette = ["#00D09C", "#4F46E5", "#F59E0B", "#EF4444", "#0EA5E9", "#22C55E", "#A855F7"];
    const grouped: Record<string, number> = {};

    for (const h of holdings) {
      const key = h.sector || "Other";
      grouped[key] = (grouped[key] ?? 0) + h.currentValue;
    }

    const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    return Object.entries(grouped)
      .map(([sector, value], idx) => ({
        sector,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: palette[idx % palette.length],
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [holdings]);

  const availableStocks = INITIAL_UNIVERSE.map(s => stocks[s]).filter(Boolean);
  const gainers = availableStocks.filter((s) => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
  const losers  = availableStocks.filter((s) => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);

  // Rich context for Aria — built after all computed values are ready
  const dashboardContext = useMemo(() => {
    const lines: string[] = [];
    lines.push("PAGE: Portfolio Dashboard");
    lines.push(`User: ${user?.name ?? "Investor"}`);
    lines.push(`\nPORTFOLIO SUMMARY:`);
    lines.push(`  Total Value   : $${totalValue.toFixed(2)}`);
    lines.push(`  Cash Balance  : $${cash.toFixed(2)}`);
    lines.push(`  Invested      : $${totalInvested.toFixed(2)}`);
    lines.push(`  Overall P&L   : ${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)} (${totalPnLPercent.toFixed(2)}%)`);
    lines.push(`  Today's P&L   : ${dayPnL >= 0 ? "+" : ""}$${dayPnL.toFixed(2)} (${dayPnLPercent.toFixed(2)}%)`);
    if (holdings.length > 0) {
      lines.push(`\nHOLDINGS (${holdings.length} positions):`);
      holdings.forEach(h => lines.push(`  ${h.symbol}: ${h.qty} shares @ avg $${h.avgBuyPrice.toFixed(2)} | Now $${h.livePrice.toFixed(2)} | P&L ${h.pnl >= 0 ? "+" : ""}$${h.pnl.toFixed(2)} (${h.pnlPercent.toFixed(1)}%)`));
    } else {
      lines.push(`\nHOLDINGS: No positions yet.`);
    }
    if (sectorAllocation.length > 0) {
      lines.push(`\nSECTOR ALLOCATION:`);
      sectorAllocation.forEach(s => lines.push(`  ${s.sector}: ${s.percentage.toFixed(1)}%`));
    }
    if (gainers.length > 0) lines.push(`\nTOP GAINERS: ${gainers.map(s => `${s.symbol} +${s.changePercent.toFixed(2)}%`).join(", ")}`);
    if (losers.length > 0) lines.push(`TOP LOSERS:  ${losers.map(s => `${s.symbol} ${s.changePercent.toFixed(2)}%`).join(", ")}`);
    if (recentOrders.length > 0) {
      lines.push(`\nRECENT TRANSACTIONS:`);
      recentOrders.slice(0, 3).forEach(t => lines.push(`  ${t.type} ${t.qty} ${t.symbol} @ $${t.price?.toFixed(2)} on ${new Date(t.timestamp).toLocaleDateString()}`));
    }
    return lines.join("\n");
  }, [user, totalValue, cash, totalInvested, totalPnL, totalPnLPercent, dayPnL, dayPnLPercent, holdings, sectorAllocation, gainers, losers, recentOrders]);
  useChatContext(dashboardContext);

  const chartData = {
    "1W": history.slice(-7),
    "1M": history.slice(-30),
    "3M": history.slice(-90),
  }[timeRange] ?? history.slice(-30);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "Investor";

  return (
    <div className="max-w-[1700px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">

      {/* ── Welcome ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s your portfolio snapshot</p>
        </div>
        <Button size="sm" className="btn-groww gap-2 hidden sm:flex" onClick={() => router.push("/explore")}>
          <TrendingUp className="w-3.5 h-3.5" /> Explore Stocks
        </Button>
      </div>

      {/* ── Portfolio Hero Card ── */}
      <div className="groww-card p-4 sm:p-5 relative overflow-hidden">
        {!isAuthenticated && (
          <RestrictedOverlay
            title="Portfolio Overview"
            description="Sign in to track your investments and live performance."
            actionLabel="Sign in to view"
            onAuthenticate={() => requireAuth(() => {}, "Sign in to view your portfolio performance")}
          />
        )}
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6", !isAuthenticated && "opacity-20 pointer-events-none select-none blur-sm")}>
          {/* Left: total value */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Portfolio Value</p>
              {loading ? (
                <div className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
              ) : (
                <p className="text-4xl font-black num text-foreground">{formatCurrency(totalValue)}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3 sm:gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Total P&L</p>
                <div className={cn("flex items-center gap-1 font-bold num text-sm", totalPnL >= 0 ? "text-bull" : "text-bear")}>
                  {totalPnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {formatCurrency(totalPnL)} ({formatPercent(totalPnLPercent)})
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Today&apos;s P&L</p>
                <div className={cn("flex items-center gap-1 font-bold num text-sm", dayPnL >= 0 ? "text-bull" : "text-bear")}>
                  {dayPnL >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {formatCurrency(dayPnL)} ({formatPercent(dayPnLPercent)})
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Invested</p>
                <p className="text-sm font-bold num">{formatCurrency(totalInvested)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Cash</p>
                <p className="text-sm font-bold num">{formatCurrency(cash)}</p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn-groww px-4 py-2 text-xs w-full sm:w-auto" onClick={() => router.push("/explore")}>
                Buy Stocks
              </button>
              <button className="px-4 py-2 text-xs rounded-lg border border-border font-semibold hover:bg-muted transition-colors w-full sm:w-auto" onClick={() => router.push("/portfolio")}>
                View Holdings
              </button>
            </div>
          </div>

          {/* Right: chart */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground font-medium">Performance</p>
              <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
                {["1W","1M","3M"].map((t) => (
                  <button key={t} onClick={() => setTimeRange(t)} className={cn("px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all", timeRange === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d09c" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00d09c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}`; }}
                  interval="preserveStartEnd" />
                <YAxis tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip formatter={(v: any) => [formatCurrency(v), "Value"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "11px" }} />
                <Area type="monotone" dataKey="value" stroke="#00d09c" strokeWidth={2} fill="url(#pg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 3 columns: Holdings | Movers | Sector ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Holdings */}
        <div className="groww-card p-4 relative overflow-hidden min-w-0 min-h-[260px]">
          {!isAuthenticated && (
            <RestrictedOverlay
              title="Your Holdings"
              description="Sign in to view holdings, position-level returns, and allocation details."
              actionLabel="Sign in to view"
              onAuthenticate={() => requireAuth(() => {}, "Sign in to view your holdings and P&L")}
            />
          )}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Your Holdings</p>
            <button onClick={() => router.push("/portfolio")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline" disabled={!isAuthenticated}>
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className={cn("space-y-0.5", !isAuthenticated && "opacity-20 blur-[2px]")}>
            {holdings.slice(0, 5).map((h) => (
              <div
                key={h.symbol}
                className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/explore/${h.symbol}`)}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-black text-primary">{h.symbol.slice(0,2)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{h.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{h.qty} shares</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold num">{formatCurrency(h.currentValue)}</p>
                  <p className={cn("text-[10px] font-semibold num", h.pnlPercent >= 0 ? "text-bull" : "text-bear")}>
                    {h.pnlPercent >= 0 ? "+" : ""}{formatPercent(h.pnlPercent)}
                  </p>
                </div>
              </div>
            ))}
            {holdings.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No holdings yet. Start by buying your first stock.</p>
            )}
          </div>
        </div>

        {/* Market Movers */}
        <div className="groww-card p-4 min-w-0 min-h-[260px]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Market Movers</p>
            <button onClick={() => router.push("/explore")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline">
              Explore <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="mb-2">
            <div className="flex items-center gap-1 mb-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-bull" />
              <p className="text-[11px] font-semibold text-bull">Top Gainers</p>
            </div>
            {gainers.slice(0,2).map((s) => (
              <div key={s.symbol} className="flex items-center justify-between py-1.5 px-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/explore/${s.symbol}`)}>
                <span className="text-xs font-semibold">{s.symbol}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs num text-muted-foreground">{formatCurrency(s.price)}</span>
                  <span className="text-xs font-bold text-bull num">+{formatPercent(s.changePercent)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="h-px bg-border my-2" />
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-bear" />
              <p className="text-[11px] font-semibold text-bear">Top Losers</p>
            </div>
            {losers.slice(0,2).map((s) => (
              <div key={s.symbol} className="flex items-center justify-between py-1.5 px-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => router.push(`/explore/${s.symbol}`)}>
                <span className="text-xs font-semibold">{s.symbol}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs num text-muted-foreground">{formatCurrency(s.price)}</span>
                  <span className="text-xs font-bold text-bear num">{formatPercent(s.changePercent)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sector allocation */}
        <div className="groww-card p-4 min-w-0 min-h-[260px]">
          <p className="text-sm font-bold mb-3">Sector Split</p>
          {sectorAllocation.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="mx-auto sm:mx-0">
            <PieChart width={100} height={100}>
              <Pie data={sectorAllocation} cx={47} cy={47} innerRadius={28} outerRadius={48} dataKey="percentage" strokeWidth={1}>
                {sectorAllocation.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            </div>
            <div className="flex-1 space-y-1.5">
              {sectorAllocation.map((s) => (
                <div key={s.sector} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[11px] text-muted-foreground">{s.sector}</span>
                  </div>
                  <span className="text-[11px] font-semibold num">{s.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          ) : (
            <p className="text-xs text-muted-foreground">No sector data yet. Holdings will appear after your first buy order.</p>
          )}
        </div>
      </div>

      {/* ── Recent Transactions + News ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Transactions */}
        <div className="groww-card p-4 relative overflow-hidden min-w-0 min-h-[240px]">
          {!isAuthenticated && (
            <RestrictedOverlay
              title="Recent Orders"
              description="Sign in to view your recent buy/sell activity and transaction timeline."
              actionLabel="Sign in to view"
              onAuthenticate={() => requireAuth(() => {}, "Sign in to view your recent orders")}
            />
          )}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Recent Orders</p>
            <button onClick={() => router.push("/transactions")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline" disabled={!isAuthenticated}>
              All orders <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className={cn("space-y-2", !isAuthenticated && "opacity-20 blur-[2px]")}>
            {recentOrders.map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", t.type === "BUY" ? "bg-bull-muted" : "bg-bear-muted")}>
                  {t.type === "BUY"
                    ? <ArrowDownRight className="w-4 h-4 text-bull" />
                    : <ArrowUpRight className="w-4 h-4 text-bear" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold">{t.symbol ?? "Unknown"}</p>
                    <Badge variant="secondary" className={cn("text-[9px] px-1", t.type === "BUY" ? "bg-bull-muted text-bull" : "bg-bear-muted text-bear")}>{t.type}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.qty ?? 0} × {formatCurrency(t.price ?? 0)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-xs font-bold num", t.type === "BUY" ? "text-bear" : "text-bull")}>
                    {t.amount < 0 ? "-" : "+"}{formatCurrency(Math.abs(t.amount))}
                  </p>
                  <div className="flex items-center gap-0.5 justify-end mt-0.5">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{timeAgo(t.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
            {recentOrders.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">No orders yet. Your latest buy/sell activity will appear here.</p>
            )}
          </div>
        </div>

        {/* News */}
        <div className="groww-card p-4 min-w-0 min-h-[240px]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Market News</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refreshNews()}
                className="text-muted-foreground text-xs font-semibold flex items-center gap-1 hover:text-primary transition-colors"
                disabled={loadingNews}
              >
                <RefreshCw className={cn("w-3 h-3", loadingNews && "animate-spin")} />
                Refresh
              </button>
              <button onClick={() => router.push("/news")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline">
                All news <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {loadingNews ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 w-1/4 bg-muted rounded mb-2"></div>
                    <div className="h-4 w-full bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : marketNews.length > 0 ? (
              marketNews.map((article, idx) => {
                const isPositive = article.title.toLowerCase().includes("beat") || article.title.toLowerCase().includes("jump") || article.title.toLowerCase().includes("rally");
                const isNegative = article.title.toLowerCase().includes("fall") || article.title.toLowerCase().includes("drop") || article.title.toLowerCase().includes("decline");
                const sentiment = isPositive ? "positive" : isNegative ? "negative" : "neutral";
                
                return (
                  <div key={idx} className="pb-3 border-b border-border last:border-0 last:pb-0 cursor-pointer group" onClick={() => article.url ? window.open(article.url, "_blank") : null}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className={cn("text-[9px]", sentiment === "positive" ? "bg-bull-muted text-bull" : sentiment === "negative" ? "bg-bear-muted text-bear" : "bg-muted text-muted-foreground")}>
                        {sentiment}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 uppercase tracking-wide">
                        {article.feedType === "live" ? "Live" : "Fallback"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{article.source}</span>
                      {article.published && <span className="text-[9px] text-muted-foreground/70 ml-auto">{article.published}</span>}
                    </div>
                    <p className="text-xs font-semibold text-foreground leading-relaxed line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground">No recent news found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
