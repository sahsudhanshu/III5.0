"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { MOCK_STOCKS, generateCandlestickData, MOCK_NEWS } from "@/lib/mock-data";
import { formatCurrency, formatPercent, formatNumber, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useWatchlistStore } from "@/store/watchlist-store";
import { useChatStore } from "@/store/chat-store";
import { ChartSkeleton } from "@/components/common/skeletons";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Star, Bot, ArrowLeft,
  CandlestickChart, LineChart, Info,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ComposedChart, Line,
} from "recharts";
import type { TimeFilter, ChartType, CandlestickDataPoint } from "@/types";

const TIME_FILTERS: TimeFilter[] = ["1D", "1W", "1M", "3M", "1Y"];
const COUNT_MAP: Record<TimeFilter, number> = {
  "1D": 78, "1W": 84, "1M": 120, "3M": 150, "1Y": 260, "5Y": 300,
};

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();

  // ── All hooks first — no early returns before this ──
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const { setContext, openChat } = useChatStore();

  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<CandlestickDataPoint[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("1M");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("10");
  const [orderLoading, setOrderLoading] = useState(false);

  const stock = MOCK_STOCKS.find((s) => s.symbol === symbol);

  const loadChart = useCallback(() => {
    if (!stock) return;
    setLoading(true);
    setTimeout(() => {
      setChartData(generateCandlestickData(stock.price, COUNT_MAP[timeFilter], timeFilter));
      setLoading(false);
    }, 400);
  }, [stock, timeFilter]);

  useEffect(() => { loadChart(); }, [loadChart]);
  useEffect(() => {
    if (stock) setContext(stock.symbol);
    return () => setContext(null);
  }, [stock, setContext]);

  // Derived values
  const isPositive = (stock?.changePercent ?? 0) >= 0;
  const inWatchlist = stock ? isInWatchlist(stock.symbol) : false;
  const relatedNews = stock ? MOCK_NEWS.filter((n) => n.relatedSymbols.includes(stock.symbol)) : [];
  const lineData = chartData.map((d) => ({ time: d.time, value: d.close, volume: d.volume }));
  const strokeColor = isPositive ? "#00d09c" : "#eb5b3c";

  const toggleWatchlist = () => {
    if (!stock) return;
    if (inWatchlist) {
      removeFromWatchlist(stock.symbol);
      toast.success(`${stock.symbol} removed from watchlist`);
    } else {
      addToWatchlist({ symbol: stock.symbol, name: stock.name, exchange: stock.exchange, price: stock.price, change: stock.change, changePercent: stock.changePercent, volume: stock.volume, addedAt: new Date().toISOString() });
      toast.success(`${stock.symbol} added to watchlist ⭐`);
    }
  };

  const handleOrder = async () => {
    if (!stock || parseInt(qty) <= 0) { toast.error("Enter a valid quantity"); return; }
    setOrderLoading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setOrderLoading(false);
    toast.success(`✅ ${orderType} ${qty} shares of ${stock.symbol}`, {
      description: `@ ${formatCurrency(stock.price)} · Total: ${formatCurrency(parseInt(qty) * stock.price)}`,
    });
  };

  // Guard after all hooks
  if (!stock) {
    return (
      <div className="p-6 max-w-screen-xl mx-auto">
        <Button variant="ghost" className="gap-2 mb-4" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <p className="text-muted-foreground">Stock <strong>{symbol}</strong> not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 lg:px-6 py-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
        <button onClick={() => router.back()} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Explore
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{stock.symbol}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Chart + Tabs ── */}
        <div className="xl:col-span-2 space-y-4">

          {/* Stock header */}
          <div className="groww-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-primary">{stock.symbol.slice(0, 2)}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-foreground">{stock.symbol}</h1>
                    <Badge variant="outline" className="text-[10px]">{stock.exchange}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{stock.sector}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{stock.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleWatchlist}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
                    inWatchlist
                      ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-500"
                      : "border-border text-muted-foreground hover:border-yellow-400/50 hover:text-yellow-500"
                  )}
                >
                  <Star className="w-3.5 h-3.5" fill={inWatchlist ? "currentColor" : "none"} />
                  {inWatchlist ? "Watching" : "Add to watchlist"}
                </button>
                <button
                  onClick={() => openChat()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
                >
                  <Bot className="w-3.5 h-3.5" /> Ask AI
                </button>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-end gap-3 mt-4">
              <span className="text-4xl font-black num text-foreground">{formatCurrency(stock.price)}</span>
              <div className={cn("flex items-center gap-1.5 mb-1.5 px-2.5 py-1 rounded-lg", isPositive ? "bg-bull-muted" : "bg-bear-muted")}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5 text-bull" /> : <TrendingDown className="w-3.5 h-3.5 text-bear" />}
                <span className={cn("text-sm font-semibold num", isPositive ? "text-bull" : "text-bear")}>
                  {isPositive ? "+" : ""}{formatCurrency(stock.change)} ({formatPercent(stock.changePercent)})
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">As of today · NSE</p>
          </div>

          {/* Chart */}
          <div className="groww-card p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              {/* Time filter */}
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {TIME_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setTimeFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                      timeFilter === f
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {/* Chart type */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setChartType("area")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", chartType === "area" ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground")}
                >
                  <LineChart className="w-3 h-3" /> Line
                </button>
                <button
                  onClick={() => setChartType("candlestick")}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all", chartType === "candlestick" ? "border-primary text-primary bg-primary/5" : "border-border text-muted-foreground")}
                >
                  <CandlestickChart className="w-3 h-3" /> Candle
                </button>
              </div>
            </div>

            {loading ? <ChartSkeleton height={260} /> : (
              chartType === "area" ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={lineData}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={strokeColor} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => { const d = new Date(v); return timeFilter === "1D" ? `${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}` : `${d.getDate()}/${d.getMonth()+1}`; }}
                      interval="preserveStartEnd" />
                    <YAxis domain={["auto","auto"]} tickFormatter={(v) => `₹${v.toFixed(0)}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v), "Price"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px" }} />
                    <Area type="monotone" dataKey="value" stroke={strokeColor} strokeWidth={2} fill="url(#sg)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={chartData.slice(-60)}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-10" vertical={false} />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth()+1}`; }} interval="preserveStartEnd" />
                    <YAxis domain={["auto","auto"]} tickFormatter={(v) => `₹${v.toFixed(0)}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: number, n: string) => [formatCurrency(v), n]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "11px" }} />
                    <Bar dataKey="low" fill="transparent" />
                    <Bar dataKey="high" fill={`${strokeColor}55`} stackId="c" />
                    <Line type="linear" dataKey="close" stroke={strokeColor} strokeWidth={1.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )
            )}

            {/* Volume bar */}
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-[10px] text-muted-foreground mb-1.5">Volume</p>
              <ResponsiveContainer width="100%" height={40}>
                <BarChart data={lineData.slice(-50)}>
                  <Bar dataKey="volume" fill={`${strokeColor}50`} radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabs */}
          <div className="groww-card overflow-hidden">
            <Tabs defaultValue="overview">
              <TabsList className="w-full rounded-none border-b border-border bg-transparent justify-start px-4 h-10">
                {["overview", "news", "financials"].map((t) => (
                  <TabsTrigger key={t} value={t} className="capitalize text-xs h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                  {[
                    ["Open",          formatCurrency(stock.open)],
                    ["Day High",      formatCurrency(stock.dayHigh)],
                    ["Day Low",       formatCurrency(stock.dayLow)],
                    ["Prev. Close",   formatCurrency(stock.previousClose)],
                    ["Volume",        formatNumber(stock.volume)],
                    ["Mkt Cap",       `₹${formatNumber(stock.marketCap)}Cr`],
                    ["P/E Ratio",     `${stock.pe.toFixed(1)}x`],
                    ["P/B Ratio",     `${stock.pb.toFixed(1)}x`],
                    ["EPS",           formatCurrency(stock.eps)],
                    ["Dividend Yield",`${stock.dividendYield.toFixed(2)}%`],
                    ["Beta",          stock.beta.toFixed(2)],
                    ["52W High",      formatCurrency(stock.high52w)],
                    ["52W Low",       formatCurrency(stock.low52w)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-sm font-semibold num text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="news" className="p-5 space-y-3">
                {relatedNews.length === 0
                  ? <p className="text-sm text-muted-foreground">No recent news for {stock.symbol}</p>
                  : relatedNews.map((n) => (
                    <div key={n.id} className="pb-3 border-b border-border last:border-0 last:pb-0">
                      <div className="flex gap-2 mb-1.5">
                        <Badge variant="secondary" className={cn("text-[9px]", n.sentiment === "positive" ? "bg-bull-muted text-bull" : n.sentiment === "negative" ? "bg-bear-muted text-bear" : "bg-muted text-muted-foreground")}>{n.sentiment}</Badge>
                        <span className="text-[10px] text-muted-foreground">{n.source}</span>
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-relaxed">{n.title}</p>
                    </div>
                  ))
                }
              </TabsContent>

              <TabsContent value="financials" className="p-5">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Revenue (Q3 FY25)", value: "₹2.41L Cr", sub: "+8.3% YoY", ok: true },
                    { label: "Net Profit",        value: "₹21,930 Cr", sub: "+18.1% YoY", ok: true },
                    { label: "EBITDA Margin",     value: "17.4%",      sub: "vs 16.8% last Q", ok: true },
                    { label: "Debt/Equity",       value: "0.48x",      sub: "Conservative", ok: true },
                  ].map(({ label, value, sub, ok }) => (
                    <div key={label} className="bg-muted/40 rounded-xl p-4">
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <p className="text-base font-bold num text-foreground">{value}</p>
                      <p className={cn("text-xs mt-0.5", ok ? "text-bull" : "text-muted-foreground")}>{sub}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* ── Right: Order Panel ── */}
        <div className="space-y-4">
          {/* Order widget */}
          <div className="groww-card p-4 space-y-4">
            {/* BUY / SELL tabs */}
            <div className="flex rounded-xl overflow-hidden border border-border">
              <button
                onClick={() => setOrderType("BUY")}
                className={cn("flex-1 py-2.5 text-sm font-bold transition-all", orderType === "BUY" ? "bg-bull text-white" : "bg-transparent text-muted-foreground hover:text-foreground")}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderType("SELL")}
                className={cn("flex-1 py-2.5 text-sm font-bold transition-all border-l border-border", orderType === "SELL" ? "bg-bear text-white" : "bg-transparent text-muted-foreground hover:text-foreground")}
              >
                SELL
              </button>
            </div>

            {/* Form */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium">Market Price</label>
                <div className="mt-1.5 h-10 px-3 rounded-lg bg-muted flex items-center">
                  <span className="text-sm font-bold num">{formatCurrency(stock.price)}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-medium">Quantity</label>
                <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1.5 h-10" />
              </div>

              <div className="flex items-center justify-between py-2.5 px-3 bg-muted/50 rounded-lg">
                <span className="text-xs text-muted-foreground">Order Value</span>
                <span className="text-sm font-bold num">{formatCurrency(parseInt(qty || "0") * stock.price)}</span>
              </div>

              <button
                onClick={handleOrder}
                disabled={orderLoading}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-70",
                  orderType === "BUY" ? "btn-groww" : "btn-sell"
                )}
              >
                {orderLoading
                  ? <span className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Placing…</span>
                  : `${orderType} ${stock.symbol}`
                }
              </button>
              <p className="text-[10px] text-muted-foreground text-center">Simulated — no real money involved</p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="groww-card p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">Key Metrics</p>
            {[
              { label: "52-Week High",  value: formatCurrency(stock.high52w),           color: "text-bull" },
              { label: "52-Week Low",   value: formatCurrency(stock.low52w),            color: "text-bear" },
              { label: "Beta",          value: stock.beta.toFixed(2),                   color: "" },
              { label: "Div. Yield",    value: `${stock.dividendYield.toFixed(2)}%`,    color: "" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className={cn("text-xs font-semibold num", color)}>{value}</span>
              </div>
            ))}
          </div>

          {/* Similar stocks */}
          <div className="groww-card p-4">
            <p className="text-sm font-bold text-foreground mb-3">Similar Stocks</p>
            <div className="space-y-2">
              {MOCK_STOCKS.filter((s) => s.sector === stock.sector && s.symbol !== stock.symbol).slice(0, 4).map((s) => (
                <div
                  key={s.symbol}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/explore/${s.symbol}`)}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-black text-primary">{s.symbol.slice(0,2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{s.symbol}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold num">{formatCurrency(s.price)}</p>
                    <p className={cn("text-[10px] font-medium num", s.changePercent >= 0 ? "text-bull" : "text-bear")}>
                      {s.changePercent >= 0 ? "+" : ""}{formatPercent(s.changePercent)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
