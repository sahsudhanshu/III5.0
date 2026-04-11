"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  MOCK_PORTFOLIO, MOCK_STOCKS, MOCK_NEWS, MOCK_TRANSACTIONS,
  generatePortfolioHistory, MOCK_SECTOR_ALLOCATION,
} from "@/lib/mock-data";
import { formatCurrency, formatPercent, cn, timeAgo } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  ChevronRight, Wallet, BarChart2, Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const HISTORY = generatePortfolioHistory(90);

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1M");

  useEffect(() => { setTimeout(() => setLoading(false), 900); }, []);

  const p = MOCK_PORTFOLIO;
  const gainers = MOCK_STOCKS.filter((s) => s.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
  const losers  = MOCK_STOCKS.filter((s) => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);

  const chartData = {
    "1W": HISTORY.slice(-7),
    "1M": HISTORY.slice(-30),
    "3M": HISTORY.slice(-90),
  }[timeRange] ?? HISTORY.slice(-30);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "Investor";

  return (
    <div className="max-w-[1700px] mx-auto px-4 lg:px-6 py-6 space-y-6">

      {/* ── Welcome ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{greeting}, {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here&apos;s your portfolio snapshot</p>
        </div>
        <Button size="sm" className="btn-groww gap-2 hidden sm:flex" onClick={() => router.push("/explore")}>
          <TrendingUp className="w-3.5 h-3.5" /> Explore Stocks
        </Button>
      </div>

      {/* ── Portfolio Hero Card ── */}
      <div className="groww-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: total value */}
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground font-medium mb-1">Total Portfolio Value</p>
              {loading ? (
                <div className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
              ) : (
                <p className="text-4xl font-black num text-foreground">{formatCurrency(p.totalValue + p.cash)}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Total P&L</p>
                <div className={cn("flex items-center gap-1 font-bold num text-sm", p.totalPnL >= 0 ? "text-bull" : "text-bear")}>
                  {p.totalPnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {formatCurrency(p.totalPnL)} ({formatPercent(p.totalPnLPercent)})
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Today&apos;s P&L</p>
                <div className={cn("flex items-center gap-1 font-bold num text-sm", p.dayPnL >= 0 ? "text-bull" : "text-bear")}>
                  {p.dayPnL >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {formatCurrency(p.dayPnL)} ({formatPercent(p.dayPnLPercent)})
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Invested</p>
                <p className="text-sm font-bold num">{formatCurrency(p.totalInvested)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Cash</p>
                <p className="text-sm font-bold num">{formatCurrency(p.cash)}</p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
              <button className="btn-groww px-4 py-2 text-xs" onClick={() => router.push("/explore")}>
                Buy Stocks
              </button>
              <button className="px-4 py-2 text-xs rounded-lg border border-border font-semibold hover:bg-muted transition-colors" onClick={() => router.push("/portfolio")}>
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
                <YAxis tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Value"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "11px" }} />
                <Area type="monotone" dataKey="value" stroke="#00d09c" strokeWidth={2} fill="url(#pg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── 3 columns: Holdings | Movers | Sector ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Holdings */}
        <div className="groww-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Your Holdings</p>
            <button onClick={() => router.push("/portfolio")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-0.5">
            {p.holdings.slice(0, 5).map((h) => (
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
                  <p className="text-[10px] text-muted-foreground">{h.quantity} shares</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold num">{formatCurrency(h.currentValue)}</p>
                  <p className={cn("text-[10px] font-semibold num", h.pnlPercent >= 0 ? "text-bull" : "text-bear")}>
                    {h.pnlPercent >= 0 ? "+" : ""}{formatPercent(h.pnlPercent)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Movers */}
        <div className="groww-card p-4">
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
        <div className="groww-card p-4">
          <p className="text-sm font-bold mb-3">Sector Split</p>
          <div className="flex items-center gap-4">
            <PieChart width={100} height={100}>
              <Pie data={MOCK_SECTOR_ALLOCATION} cx={47} cy={47} innerRadius={28} outerRadius={48} dataKey="percentage" strokeWidth={1}>
                {MOCK_SECTOR_ALLOCATION.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </PieChart>
            <div className="flex-1 space-y-1.5">
              {MOCK_SECTOR_ALLOCATION.map((s) => (
                <div key={s.sector} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-[11px] text-muted-foreground">{s.sector}</span>
                  </div>
                  <span className="text-[11px] font-semibold num">{s.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Transactions + News ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Transactions */}
        <div className="groww-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Recent Orders</p>
            <button onClick={() => router.push("/transactions")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline">
              All orders <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2">
            {MOCK_TRANSACTIONS.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0", t.type === "BUY" ? "bg-bull-muted" : "bg-bear-muted")}>
                  {t.type === "BUY"
                    ? <ArrowDownRight className="w-4 h-4 text-bull" />
                    : <ArrowUpRight className="w-4 h-4 text-bear" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold">{t.symbol}</p>
                    <Badge variant="secondary" className={cn("text-[9px] px-1", t.type === "BUY" ? "bg-bull-muted text-bull" : "bg-bear-muted text-bear")}>{t.type}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{t.quantity} × {formatCurrency(t.price)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-xs font-bold num", t.type === "BUY" ? "text-bear" : "text-bull")}>
                    {t.type === "BUY" ? "-" : "+"}{formatCurrency(t.totalValue)}
                  </p>
                  <div className="flex items-center gap-0.5 justify-end mt-0.5">
                    <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{timeAgo(t.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* News */}
        <div className="groww-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">Market News</p>
            <button onClick={() => router.push("/news")} className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline">
              All news <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {MOCK_NEWS.slice(0, 4).map((article) => (
              <div key={article.id} className="pb-3 border-b border-border last:border-0 last:pb-0 cursor-pointer group">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className={cn("text-[9px]", article.sentiment === "positive" ? "bg-bull-muted text-bull" : article.sentiment === "negative" ? "bg-bear-muted text-bear" : "bg-muted text-muted-foreground")}>
                    {article.sentiment}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{article.source}</span>
                </div>
                <p className="text-xs font-semibold text-foreground leading-relaxed line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
