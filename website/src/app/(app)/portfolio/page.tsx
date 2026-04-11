"use client";
import { useEffect, useState } from "react";
import { MOCK_PORTFOLIO, MOCK_SECTOR_ALLOCATION, generatePortfolioHistory } from "@/lib/mock-data";
import { formatCurrency, formatPercent, getChangeBg, cn } from "@/lib/utils";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { TrendingUp, Wallet, BarChart2, PieChart } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell
} from "recharts";

const HISTORY_1Y = generatePortfolioHistory(365);

export default function PortfolioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("3M");
  const p = MOCK_PORTFOLIO;

  useEffect(() => {
    setTimeout(() => setLoading(false), 900);
  }, []);

  const chartData = {
    "1W": HISTORY_1Y.slice(-7),
    "1M": HISTORY_1Y.slice(-30),
    "3M": HISTORY_1Y.slice(-90),
    "1Y": HISTORY_1Y,
  }[timeRange] ?? HISTORY_1Y.slice(-90);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portfolio</h1>
        <p className="text-muted-foreground text-sm">Your investment holdings and performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Value" value={p.totalValue + p.cash} isCurrency change={p.totalPnL} changePercent={p.totalPnLPercent} icon={<Wallet className="w-5 h-5 text-primary" />} />
        <StatCard label="Invested" value={p.totalInvested} isCurrency icon={<BarChart2 className="w-5 h-5 text-chart-2" />} />
        <StatCard label="Total P&L" value={p.totalPnL} isCurrency change={p.totalPnL} changePercent={p.totalPnLPercent} icon={<TrendingUp className="w-5 h-5 text-bull" />} />
        <StatCard label="Today's P&L" value={p.dayPnL} isCurrency change={p.dayPnL} changePercent={p.dayPnLPercent} icon={<TrendingUp className="w-5 h-5 text-chart-5" />} />
      </div>

      {/* Chart + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Value Over Time</h2>
            <div className="flex gap-1">
              {["1W", "1M", "3M", "1Y"].map((t) => (
                <button key={t} onClick={() => setTimeRange(t)} className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors", timeRange === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.18 151)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="oklch(0.65 0.18 151)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}`; }} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => `₹${(v/100000).toFixed(0)}L`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), "Value"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="value" stroke="oklch(0.65 0.18 151)" strokeWidth={2} fill="url(#grad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Sector Breakdown</h2>
          <div className="flex justify-center mb-4">
            <RechartsPieChart width={140} height={140}>
              <Pie data={MOCK_SECTOR_ALLOCATION} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="percentage" strokeWidth={1}>
                {MOCK_SECTOR_ALLOCATION.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
            </RechartsPieChart>
          </div>
          <div className="space-y-2">
            {MOCK_SECTOR_ALLOCATION.map((s) => (
              <div key={s.sector} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs text-muted-foreground">{s.sector}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs num">{formatCurrency(s.value, { compact: true })}</span>
                  <span className="text-xs text-muted-foreground">{s.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Stock", "Qty", "Avg Price", "LTP", "Invested", "Current", "P&L", "Day P&L"].map((h) => (
                  <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.holdings.map((h) => (
                <tr key={h.symbol} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => router.push(`/markets/${h.symbol}`)}>
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
                  <td className="px-4 py-3 text-sm num">{h.quantity}</td>
                  <td className="px-4 py-3 text-sm num">{formatCurrency(h.avgBuyPrice)}</td>
                  <td className="px-4 py-3 text-sm num font-semibold">{formatCurrency(h.currentPrice)}</td>
                  <td className="px-4 py-3 text-sm num">{formatCurrency(h.investedValue)}</td>
                  <td className="px-4 py-3 text-sm num font-semibold">{formatCurrency(h.currentValue)}</td>
                  <td className="px-4 py-3">
                    <p className={cn("text-sm num font-semibold", h.pnl >= 0 ? "text-bull" : "text-bear")}>
                      {h.pnl >= 0 ? "+" : ""}{formatCurrency(h.pnl)}
                    </p>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full num", getChangeBg(h.pnlPercent))}>
                      {h.pnlPercent >= 0 ? "+" : ""}{formatPercent(h.pnlPercent)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className={cn("text-sm num font-semibold", h.dayChange >= 0 ? "text-bull" : "text-bear")}>
                      {h.dayChange >= 0 ? "+" : ""}{formatCurrency(h.dayChange)}
                    </p>
                    <span className={cn("text-[10px] num", h.dayChangePercent >= 0 ? "text-bull" : "text-bear")}>
                      ({formatPercent(h.dayChangePercent)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
