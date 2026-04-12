/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatCurrency, formatPercent, formatNumber, formatDate, cn } from "@/lib/utils";
import { generateCandlestickData } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useWatchlistStore } from "@/store/watchlist-store";
import { useChatStore, useChatContext } from "@/store/chat-store";
import { useMarketStore } from "@/store/market-store";
import { useDataStore, INITIAL_UNIVERSE } from "@/store/data-store";
import { usePortfolioStore } from "@/store/portfolio-store";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ChartSkeleton } from "@/components/common/skeletons";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Star, Bot, ArrowLeft,
  CandlestickChart, LineChart, Timer,
} from "lucide-react";
import { TradingChart } from "@/components/common/trading-chart";
import type { TimeFilter, ChartType, StockForecastResponse } from "@/types";

const TIME_FILTERS: TimeFilter[] = ["1W", "1M", "3M", "6M"];

// All timeframes use daily bars ("D") since:
//   - Finnhub /stock/candle is Premium-only, so we always fall back to mock daily data
//   - The mock master series generates 252 daily bars anchored to the real quote price
//   - A single "D" resolution cache key means 1M, 3M, 6M all share the same stored series
const resMap: Record<string, "D" | "W" | "M"> = {
  "1W": "D", "1M": "D", "3M": "D", "6M": "D", "5Y": "D"
};

// Number of DAILY bars to show for each timeframe.
const countMap: Record<string, number> = {
  "1W": 7,   //  1 week  ≈  7 calendar days
  "1M": 30,   //  1 month ≈ 30 days
  "3M": 90,   //  3 months ≈ 90 days
  "6M": 180,   //  6 months ≈ 180 days
  "5Y": 252,   //  mock data covers max 1 year — show full series
};


export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const router = useRouter();

  // ── All hooks first ──
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const { openChat } = useChatStore();
  const { prices, subscribe, unsubscribe } = useMarketStore();

  const { stocks, news, candles, fetchStockProfile, fetchNews, fetchCandles, candleRetryCountdown } = useDataStore();
  const { portfolio, fetchPortfolio, placeOrder } = usePortfolioStore();

  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("1M");
  const [chartType, setChartType] = useState<ChartType>("area");
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [qty, setQty] = useState("10");
  const [orderLoading, setOrderLoading] = useState(false);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastData, setForecastData] = useState<StockForecastResponse | null>(null);

  // Determine actual target symbol
  const targetSymbol = typeof symbol === "string" ? symbol.toUpperCase() : "AAPL";

  // Real-time overrides
  const livePriceData = prices[targetSymbol === "BTC" ? "BINANCE:BTCUSDT" : targetSymbol];

  const baseStock = stocks[targetSymbol];
  const stock = baseStock ? {
    ...baseStock,
    price: livePriceData ? livePriceData.price : baseStock.price,
    change: livePriceData ? livePriceData.price - baseStock.previousClose : baseStock.change,
    changePercent: livePriceData ? ((livePriceData.price - baseStock.previousClose) / baseStock.previousClose) * 100 : baseStock.changePercent,
  } : undefined;

  // Derived lists
  const relatedNews = news[targetSymbol] || [];

  const cacheKey = `${targetSymbol}_${resMap[timeFilter as "1M"] || "D"}`;

  const chartData = useMemo(() => {
    const rawCandles = candles[cacheKey] || [];
    if (rawCandles.length > 0) {
      return rawCandles.slice(-countMap[timeFilter as "1M"] || -20);
    }
    // Simulation fallback — uses a seeded PRNG (symbol+timeframe) so the chart
    // is always identical across reloads for the same stock.
    if (baseStock) {
      return generateCandlestickData(baseStock.price, countMap[timeFilter as "1M"] || 20, timeFilter, targetSymbol);
    }
    return [];
  }, [candles, cacheKey, timeFilter, baseStock, targetSymbol]);


  const loadData = useCallback(async () => {
    // Only set full page loading if we haven't resolved the core stock yet
    if (!baseStock) {
      setTimeout(() => setLoading(true), 0);
    }

    await fetchStockProfile(targetSymbol);
    await Promise.all([
      fetchNews(targetSymbol),
      fetchCandles(targetSymbol, resMap[timeFilter as "1M"] || "D", countMap[timeFilter as "1M"] || 60)
    ]);

    setTimeout(() => setLoading(false), 0);
  }, [targetSymbol, timeFilter, fetchStockProfile, fetchNews, fetchCandles, baseStock]);

  useEffect(() => { loadData(); }, [loadData]);

  // Rich context for Aria — rebuilt whenever page data changes
  const holding = portfolio?.holdings?.find(h => h.symbol === targetSymbol);
  const stockContext = stock ? (() => {
    const lines: string[] = [];
    const industry = (stock as { industry?: string }).industry ?? "N/A";

    // ── Basic identity ──
    lines.push(`PAGE: Stock Detail — ${stock.symbol} (${stock.name})`);
    lines.push(`Exchange: ${stock.exchange} | Sector: ${stock.sector} | Industry: ${industry}`);

    // ── Price & performance ──
    lines.push(`\nPRICE DATA:`);
    lines.push(`  Current Price : $${stock.price.toFixed(2)}`);
    lines.push(`  Today's Change: ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}% ($${stock.change.toFixed(2)})`);
    lines.push(`  52-Week High  : $${stock.high52w?.toFixed(2) ?? "N/A"}`);
    lines.push(`  52-Week Low   : $${stock.low52w?.toFixed(2) ?? "N/A"}`);
    lines.push(`  Market Cap    : $${stock.marketCap ? (stock.marketCap / 1e9).toFixed(1) + "B" : "N/A"}`);
    lines.push(`  Volume        : ${stock.volume ? stock.volume.toLocaleString() : "N/A"}`);

    // ── Key metrics ──
    lines.push(`\nKEY METRICS:`);
    lines.push(`  P/E Ratio   : ${stock.pe?.toFixed(1) ?? "N/A"}`);
    lines.push(`  EPS         : ${stock.eps?.toFixed(2) ?? "N/A"}`);
    lines.push(`  Beta        : ${stock.beta?.toFixed(2) ?? "N/A"}`);
    lines.push(`  Div. Yield  : ${stock.dividendYield?.toFixed(2) ?? "0"}%`);
    lines.push(`  Prev. Close : $${stock.previousClose?.toFixed(2) ?? "N/A"}`);

    // ── User's portfolio position ──
    if (holding) {
      const currentValue = holding.qty * stock.price;
      const investedValue = holding.qty * holding.avgBuyPrice;
      const pnl = currentValue - investedValue;
      const pnlPct = ((pnl / investedValue) * 100).toFixed(2);
      lines.push(`\nUSER PORTFOLIO POSITION:`);
      lines.push(`  Shares Held  : ${holding.qty}`);
      lines.push(`  Avg Buy Price: $${holding.avgBuyPrice.toFixed(2)}`);
      lines.push(`  Current Value: $${currentValue.toFixed(2)}`);
      lines.push(`  Invested     : $${investedValue.toFixed(2)}`);
      lines.push(`  P&L          : ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnl >= 0 ? "+" : ""}${pnlPct}%)`);
    } else {
      lines.push(`\nUSER PORTFOLIO POSITION: Not currently holding ${stock.symbol}.`);
      lines.push(`  Available Cash: $${portfolio?.cashBalance?.toFixed(2) ?? "N/A"}`);
    }

    // ── Recent news ──
    if (relatedNews.length > 0) {
      lines.push(`\nRECENT NEWS (${relatedNews.length} articles):`);
      relatedNews.slice(0, 3).forEach((n: any, i: number) => {
        lines.push(`  ${i + 1}. ${n.title} — ${n.source ?? ""}`);
      });
    }

    return lines.join("\n");
  })() : `PAGE: Stock Detail — ${targetSymbol} (loading...)`;

  useChatContext(stockContext);


  useEffect(() => {
    const subSymbol = targetSymbol === "BTC" ? "BINANCE:BTCUSDT" : targetSymbol;
    subscribe(subSymbol);
    return () => {
      unsubscribe(subSymbol);
    };
  }, [targetSymbol, subscribe, unsubscribe]);

  const { requireAuth, isAuthenticated } = useRequireAuth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchPortfolio();
    }
  }, [fetchPortfolio, isAuthenticated]);

  // Derived values
  const isPositive = (stock?.changePercent ?? 0) >= 0;
  const inWatchlist = stock ? isInWatchlist(stock.symbol) : false;

  const toggleWatchlist = () => {
    requireAuth(() => {
      if (!stock) return;
      if (inWatchlist) {
        removeFromWatchlist(stock.symbol);
        toast.success(`${stock.symbol} removed`);
      } else {
        addToWatchlist({ symbol: stock.symbol, name: stock.name, exchange: stock.exchange, price: stock.price, change: stock.change, changePercent: stock.changePercent, volume: stock.volume, addedAt: new Date().toISOString() });
        toast.success(`${stock.symbol} added to watchlist ⭐`);
      }
    }, "Sign in to update your watchlist");
  };

  const handleOrder = async () => {
    requireAuth(async () => {
      if (!stock || parseInt(qty) <= 0) { toast.error("Enter a valid quantity"); return; }
      const qtyNum = parseInt(qty);
      const total = qtyNum * stock.price;

      if (orderType === "BUY" && (portfolio?.cashBalance ?? 0) < total) {
        toast.error(`Insufficient funds. Need ${formatCurrency(total)}, have ${formatCurrency(portfolio?.cashBalance ?? 0)}`);
        return;
      }
      if (orderType === "SELL") {
        const holding = portfolio?.holdings?.find(h => h.symbol === stock.symbol);
        if (!holding || holding.qty < qtyNum) {
          toast.error(`Insufficient shares. You own ${holding?.qty ?? 0} shares.`);
          return;
        }
      }

      setOrderLoading(true);
      const ok = await placeOrder({
        type: orderType,
        symbol: stock.symbol,
        name: stock.name,
        exchange: stock.exchange,
        sector: stock.sector,
        qty: qtyNum,
        price: stock.price,
      });
      setOrderLoading(false);

      if (ok) {
        toast.success(`✅ ${orderType} ${qty} shares of ${stock.symbol}`, {
          description: `@ ${formatCurrency(stock.price)} · Total: ${formatCurrency(total)}`,
        });
      }
    }, "Sign in to place buy or sell orders");
  };

  const handleForecast = async () => {
    if (!stock) return;
    setForecastLoading(true);
    try {
      const res = await fetch("/api/stock-forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: stock.symbol }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Unable to fetch forecast");
        setForecastLoading(false);
        return;
      }
      setForecastData(data as StockForecastResponse);
    } catch (error) {
      toast.error(`Forecast request failed: ${String(error)}`);
    } finally {
      setForecastLoading(false);
    }
  };

  if (!loading && !stock) {
    return (
      <div className="px-3 sm:px-4 lg:px-6 py-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-2">Stock Not Found</h2>
        <p className="text-muted-foreground mb-6">We couldn&apos;t load data for <strong>{targetSymbol}</strong>.</p>
        <Button onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1700px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 font-geist">
      {/* ── Breadcrumb ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6 text-sm text-muted-foreground">
        <button onClick={() => router.back()} className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Explore
        </button>
        <span>/</span>
        <span className="text-foreground font-medium">{targetSymbol}</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left: Chart + Tabs ── */}
        <div className="xl:col-span-2 space-y-4 min-w-0">

          {/* Stock header */}
          <div className="groww-card p-5">
            {loading && !stock ? (
              <div className="animate-pulse space-y-4">
                <div className="h-12 w-48 bg-muted rounded"></div>
                <div className="h-10 w-32 bg-muted rounded"></div>
              </div>
            ) : stock ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
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
                      onClick={() => requireAuth(() => openChat(), "Sign in to use AI insights and recommendations")}
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
                <p className="text-[11px] text-muted-foreground mt-1">As of today · {stock.exchange}</p>
              </>
            ) : null}
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

            {loading && chartData.length === 0 ? (
              <ChartSkeleton height={320} />
            ) : (
              <div className="relative">
                {/* Rate-limit countdown banner */}
                {candleRetryCountdown !== null && candleRetryCountdown > 0 && (
                  <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium shadow-sm backdrop-blur-sm">
                      <Timer className="w-3.5 h-3.5 animate-pulse shrink-0" />
                      <span>
                        Chart data rate-limited — fetching real data in{" "}
                        <span className="font-mono font-bold tabular-nums">{candleRetryCountdown}s</span>
                        {" "}(showing simulation meanwhile)
                      </span>
                    </div>
                  </div>
                )}
                <TradingChart
                  data={chartData}
                  type={chartType === "candlestick" ? "candlestick" : "area"}
                  height={320}
                  symbol={targetSymbol}
                  timeframe={timeFilter}
                />
              </div>
            )}
          </div>

          {/* Tabs */}
          {stock && (
            <div className="groww-card overflow-hidden">
              <Tabs defaultValue="overview">
                <TabsList className="w-full rounded-none border-b border-border bg-transparent justify-start px-4 h-10">
                  {["overview", "news", "financials"].map((t) => (
                    <TabsTrigger key={t} value={t} className="capitalize text-xs h-full data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none shadow-none">
                      {t}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {/* ── OVERVIEW TAB ── */}
                <TabsContent value="overview" className="p-0">
                  {/* 52-Week Range Bar */}
                  <div className="px-5 pt-5 pb-4 border-b border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-foreground">52-Week Range</span>
                      <span className="text-xs text-muted-foreground num">
                        Current: <span className="font-bold text-foreground">{formatCurrency(stock.price)}</span>
                      </span>
                    </div>
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="absolute h-full rounded-full bg-linear-to-r from-bear via-primary to-bull"
                        style={{ width: "100%" }}
                      />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-foreground border-2 border-background rounded-full shadow-md z-10"
                        style={{
                          left: `calc(${Math.min(Math.max(((stock.price - stock.low52w) / (stock.high52w - stock.low52w || 1)) * 100, 2), 98)}% - 6px)`
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-bear font-semibold num">{formatCurrency(stock.low52w)}</span>
                      <span className="text-xs text-bull font-semibold num">{formatCurrency(stock.high52w)}</span>
                    </div>
                  </div>

                  {/* Today's Stats */}
                  <div className="px-5 py-4 border-b border-border/60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Today&apos;s Trading</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                      {[
                        { label: "Open", value: formatCurrency(stock.open), color: "" },
                        { label: "Day High", value: formatCurrency(stock.dayHigh), color: "text-bull" },
                        { label: "Day Low", value: formatCurrency(stock.dayLow), color: "text-bear" },
                        { label: "Prev. Close", value: formatCurrency(stock.previousClose), color: "" },
                      ].map(({ label, value, color }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className={cn("text-base font-bold num", color || "text-foreground")}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fundamentals */}
                  <div className="px-5 py-4 border-b border-border/60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Fundamentals</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4">
                      {[
                        { label: "Market Cap", value: `$${formatNumber(stock.marketCap)}` },
                        { label: "Volume", value: formatNumber(stock.volume) },
                        { label: "P/E Ratio", value: stock.pe > 0 ? `${stock.pe.toFixed(1)}x` : "N/A" },
                        { label: "P/B Ratio", value: stock.pb > 0 ? `${stock.pb.toFixed(1)}x` : "N/A" },
                        { label: "EPS (TTM)", value: stock.eps > 0 ? formatCurrency(stock.eps) : "N/A" },
                        { label: "Dividend Yield", value: `${stock.dividendYield.toFixed(2)}%` },
                        { label: "Beta", value: stock.beta.toFixed(2) },
                        { label: "Exchange", value: stock.exchange },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className="text-base font-semibold num text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk / Volatility indicators */}
                  <div className="px-5 py-4 border-b border-border/60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Risk &amp; Volatility</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Beta gauge */}
                      {[
                        {
                          label: "Beta",
                          value: stock.beta,
                          desc: stock.beta < 0.8 ? "Low Volatility" : stock.beta < 1.2 ? "Market-Like" : "High Volatility",
                          color: stock.beta < 0.8 ? "text-bull" : stock.beta < 1.2 ? "text-primary" : "text-bear",
                          barColor: stock.beta < 0.8 ? "bg-bull" : stock.beta < 1.2 ? "bg-primary" : "bg-bear",
                          pct: Math.min((stock.beta / 3) * 100, 100),
                          display: stock.beta.toFixed(2),
                        },
                        {
                          label: "P/E vs Sector",
                          value: stock.pe,
                          desc: stock.pe <= 0 ? "Not Applicable" : stock.pe < 15 ? "Undervalued" : stock.pe < 30 ? "Fairly Valued" : "Premium",
                          color: stock.pe <= 0 ? "text-muted-foreground" : stock.pe < 15 ? "text-bull" : stock.pe < 30 ? "text-primary" : "text-bear",
                          barColor: stock.pe <= 0 ? "bg-muted" : stock.pe < 15 ? "bg-bull" : stock.pe < 30 ? "bg-primary" : "bg-bear",
                          pct: stock.pe <= 0 ? 0 : Math.min((stock.pe / 60) * 100, 100),
                          display: stock.pe > 0 ? `${stock.pe.toFixed(1)}x` : "N/A",
                        },
                        {
                          label: "Div. Yield",
                          value: stock.dividendYield,
                          desc: stock.dividendYield === 0 ? "No Dividend" : stock.dividendYield < 1 ? "Low Yield" : stock.dividendYield < 3 ? "Moderate" : "High Yield",
                          color: stock.dividendYield === 0 ? "text-muted-foreground" : stock.dividendYield < 1 ? "text-muted-foreground" : stock.dividendYield < 3 ? "text-primary" : "text-bull",
                          barColor: stock.dividendYield === 0 ? "bg-muted" : "bg-bull",
                          pct: Math.min((stock.dividendYield / 6) * 100, 100),
                          display: `${stock.dividendYield.toFixed(2)}%`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="bg-muted/30 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
                            <span className={cn("text-sm font-bold num", item.color)}>{item.display}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                            <div className={cn("h-full rounded-full transition-all", item.barColor)} style={{ width: `${item.pct}%` }} />
                          </div>
                          <p className={cn("text-xs font-semibold", item.color)}>{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>


                </TabsContent>

                {/* ── NEWS TAB ── */}
                <TabsContent value="news" className="p-0">
                  {relatedNews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6 4h.01" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">No news available</p>
                      <p className="text-xs text-muted-foreground">No live or fallback news is currently available for this symbol.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {relatedNews.map((n, idx) => {
                        const timeAgo = (() => {
                          const diff = Date.now() - new Date(n.publishedAt).getTime();
                          const h = Math.floor(diff / 3600000);
                          const m = Math.floor((diff % 3600000) / 60000);
                          return h > 0 ? `${h}h ago` : `${m}m ago`;
                        })();
                        const sentimentConfig = {
                          positive: { cls: "bg-bull/10 text-bull border-bull/20", dot: "bg-bull" },
                          negative: { cls: "bg-bear/10 text-bear border-bear/20", dot: "bg-bear" },
                          neutral: { cls: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
                        }[n.sentiment] ?? { cls: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" };
                        return (
                          <a
                            key={n.id}
                            href={n.url !== "#" ? n.url : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex gap-3 px-5 py-4 transition-colors",
                              n.url !== "#" ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"
                            )}
                          >
                            {/* Rank number */}
                            <span className="text-[10px] font-bold text-muted-foreground/40 w-4 shrink-0 pt-0.5">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              {/* Meta row */}
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border", sentimentConfig.cls)}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sentimentConfig.dot)} />
                                  {n.sentiment}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-border text-muted-foreground uppercase tracking-wide">
                                  {(n.feedType ?? "live") === "live" ? "Live" : "Fallback"}
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">{n.source}</span>
                                <span className="text-xs text-muted-foreground/60 ml-auto">{timeAgo}</span>
                              </div>
                              {/* Headline */}
                              <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                {n.title}
                              </p>
                              {/* Summary if available */}
                              {n.summary && (
                                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">{n.summary}</p>
                              )}
                              {/* Related symbols */}
                              {n.relatedSymbols && n.relatedSymbols.length > 0 && (
                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                  {n.relatedSymbols.slice(0, 4).map((sym) => (
                                    <span key={sym} className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-medium">{sym}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Article image */}
                            {n.imageUrl && (
                              <div className="w-16 h-14 rounded-lg overflow-hidden shrink-0 bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={n.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              </div>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* ── FINANCIALS TAB ── */}
                <TabsContent value="financials" className="p-0">
                  {/* Income Highlights */}
                  <div className="px-5 pt-5 pb-4 border-b border-border/60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Income Statement (TTM)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Revenue", value: stock.eps > 0 ? formatCurrency(stock.eps * (stock.marketCap / (stock.price || 1) / 1e6 * 0.08)) : "N/A", badge: "Est.", badgeOk: true },
                        { label: "EPS (TTM)", value: stock.eps > 0 ? formatCurrency(stock.eps) : "N/A", badge: "Reported", badgeOk: true },
                        { label: "Net Income", value: stock.eps > 0 ? `$${((stock.eps * stock.marketCap) / (stock.price || 1) / 1e9).toFixed(1)}B` : "N/A", badge: "Est.", badgeOk: true },
                        { label: "Profit Margin", value: stock.pe > 0 && stock.eps > 0 ? `${((stock.eps / (stock.price / stock.pe)) * 100).toFixed(1)}%` : "N/A", badge: "", badgeOk: false },
                        { label: "P/E Ratio", value: stock.pe > 0 ? `${stock.pe.toFixed(1)}x` : "N/A", badge: "", badgeOk: false },
                        { label: "P/B Ratio", value: stock.pb > 0 ? `${stock.pb.toFixed(1)}x` : "N/A", badge: "", badgeOk: false },
                      ].map(({ label, value, badge, badgeOk }) => (
                        <div key={label} className="bg-muted/30 rounded-xl p-3.5">
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <p className="text-lg font-black num text-foreground">{value}</p>
                          {badge && <span className={cn("text-xs font-semibold mt-1 inline-block", badgeOk ? "text-bull" : "text-muted-foreground")}>{badge}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Valuation */}
                  <div className="px-5 py-4 border-b border-border/60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Valuation</p>
                    <div className="space-y-2.5">
                      {[
                        {
                          label: "P/E Ratio",
                          value: stock.pe > 0 ? stock.pe : null,
                          format: (v: number) => `${v.toFixed(1)}x`,
                          low: 10, high: 50,
                          verdict: stock.pe <= 0 ? "N/A" : stock.pe < 15 ? "Cheap" : stock.pe < 25 ? "Fair" : stock.pe < 40 ? "Pricey" : "Expensive",
                          verdictColor: stock.pe <= 0 ? "text-muted-foreground" : stock.pe < 15 ? "text-bull" : stock.pe < 25 ? "text-primary" : "text-bear",
                        },
                        {
                          label: "P/B Ratio",
                          value: stock.pb > 0 ? stock.pb : null,
                          format: (v: number) => `${v.toFixed(1)}x`,
                          low: 1, high: 10,
                          verdict: stock.pb <= 0 ? "N/A" : stock.pb < 1 ? "Undervalued" : stock.pb < 3 ? "Fair" : "Overvalued",
                          verdictColor: stock.pb <= 0 ? "text-muted-foreground" : stock.pb < 1 ? "text-bull" : stock.pb < 3 ? "text-primary" : "text-bear",
                        },
                        {
                          label: "Dividend Yield",
                          value: stock.dividendYield,
                          format: (v: number) => `${v.toFixed(2)}%`,
                          low: 0, high: 6,
                          verdict: stock.dividendYield === 0 ? "No Dividend" : stock.dividendYield < 1.5 ? "Low" : stock.dividendYield < 4 ? "Moderate" : "High",
                          verdictColor: stock.dividendYield === 0 ? "text-muted-foreground" : "text-bull",
                        },
                      ].map((row) => (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 shrink-0">{row.label}</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: row.value === null ? "0%" : `${Math.min(((row.value - row.low) / (row.high - row.low)) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold num text-foreground w-14 text-right">{row.value !== null ? row.format(row.value) : "N/A"}</span>
                          <span className={cn("text-xs font-semibold w-24 text-right", row.verdictColor)}>{row.verdict}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dividend info */}
                  <div className="px-5 py-4 border-b border-border/60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Dividend</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted/30 rounded-xl p-3.5">
                        <p className="text-xs text-muted-foreground mb-1">Annual Yield</p>
                        <p className="text-xl font-black num text-foreground">{stock.dividendYield.toFixed(2)}%</p>
                        <p className={cn("text-xs mt-0.5 font-semibold", stock.dividendYield > 0 ? "text-bull" : "text-muted-foreground")}>
                          {stock.dividendYield > 0 ? "Pays Dividend" : "No Dividend"}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3.5">
                        <p className="text-xs text-muted-foreground mb-1">Annual Per Share</p>
                        <p className="text-xl font-black num text-foreground">
                          {stock.dividendYield > 0 ? formatCurrency((stock.dividendYield / 100) * stock.price) : "—"}
                        </p>
                        <p className="text-xs mt-0.5 font-semibold text-muted-foreground">Est.</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3.5">
                        <p className="text-xs text-muted-foreground mb-1">Payout Type</p>
                        <p className="text-base font-bold text-foreground mt-1">
                          {stock.dividendYield > 0 ? "Quarterly" : "None"}
                        </p>
                        <p className="text-xs mt-0.5 font-semibold text-muted-foreground">Typical</p>
                      </div>
                    </div>
                  </div>

                  {/* Analyst snapshot */}
                  <div className="px-5 py-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Analyst Snapshot</p>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-14 h-14 rounded-full flex items-center justify-center text-xs font-black border-2",
                          stock.pe > 0 && stock.pe < 25 ? "border-bull text-bull bg-bull/10" : "border-primary text-primary bg-primary/10"
                        )}>
                          {stock.pe > 0 && stock.pe < 20 ? "BUY" : stock.pe < 30 ? "HOLD" : "WATCH"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 font-medium">Consensus</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {[
                          { label: "Strong Buy", pct: stock.pe > 0 && stock.pe < 20 ? 55 : 30, color: "bg-bull" },
                          { label: "Buy", pct: stock.pe > 0 && stock.pe < 30 ? 25 : 20, color: "bg-bull/60" },
                          { label: "Hold", pct: 15, color: "bg-primary" },
                          { label: "Sell", pct: 5, color: "bg-bear/60" },
                        ].map((r) => (
                          <div key={r.label} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-24">{r.label}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={cn("h-full rounded-full", r.color)} style={{ width: `${r.pct}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-foreground w-8 text-right">{r.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">* Ratings are estimated from valuation multiples. Not financial advice.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>


        {/* ── Right: Order Panel ── */}
        <div className="space-y-4">
          {stock && (
            <>
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

                  {/* Balance / Shares info */}
                  {portfolio && (
                    <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg border border-border/50">
                      {orderType === "BUY" ? (
                        <>
                          <span className="text-[10px] text-muted-foreground">Available Cash</span>
                          <span className="text-xs font-bold num text-bull">{formatCurrency(portfolio.cashBalance)}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-muted-foreground">Shares Owned</span>
                          <span className="text-xs font-bold num">
                            {portfolio.holdings?.find(h => h.symbol === stock.symbol)?.qty ?? 0} shares
                          </span>
                        </>
                      )}
                    </div>
                  )}

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
                </div>
              </div>

              {/* AI Forecast */}
              <div className="groww-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">AI 7-Day Forecast</p>
                    <p className="text-[11px] text-muted-foreground">Short-term signal and price path</p>
                  </div>
                  <Button size="sm" onClick={handleForecast} disabled={forecastLoading} className="h-8">
                    {forecastLoading ? "Generating..." : "Generate"}
                  </Button>
                </div>

                {!forecastData && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Generate a forecast to see the AI signal, confidence, and the next 7-day path.
                  </div>
                )}

                {forecastData && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full",
                          forecastData.signal === "BULLISH"
                            ? "bg-bull-muted text-bull"
                            : forecastData.signal === "BEARISH"
                              ? "bg-bear-muted text-bear"
                              : "bg-muted text-muted-foreground"
                        )}
                      >
                        {forecastData.signal}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Confidence: <span className="font-semibold text-foreground">{Math.round(forecastData.confidence * 100)}%</span>
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {forecastData.summary}
                    </p>

                    <div className="space-y-2">
                      {forecastData.forecast.map((item) => (
                        <div key={item.date} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{formatDate(item.date, "short")}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold num text-foreground">{formatCurrency(item.predictedPrice)}</span>
                            <span className={cn("text-[11px] font-semibold", item.delta >= 0 ? "text-bull" : "text-bear")}>
                              {item.delta >= 0 ? "+" : ""}{formatPercent(item.deltaPercent)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* About Company */}
              <div className="groww-card p-4">
                <p className="text-base font-bold text-foreground mb-3">About {stock.symbol}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">{stock.name}</span> is listed on the{" "}
                  <span className="font-semibold text-foreground">{stock.exchange}</span> exchange under the{" "}
                  <span className="font-semibold text-foreground">{stock.sector}</span> sector. With a market
                  capitalization of <span className="font-semibold text-foreground">${formatNumber(stock.marketCap)}</span>,
                  it trades at a P/E of{" "}
                  <span className="font-semibold text-foreground">{stock.pe > 0 ? `${stock.pe.toFixed(1)}x` : "N/A"}</span> and
                  offers a dividend yield of{" "}
                  <span className="font-semibold text-foreground">{stock.dividendYield.toFixed(2)}%</span>.{" "}
                  The stock has a beta of <span className="font-semibold text-foreground">{stock.beta.toFixed(2)}</span>,
                  indicating {stock.beta < 0.8 ? "lower" : stock.beta < 1.2 ? "similar" : "higher"} volatility compared to the broader market.
                </p>
              </div>

              {/* Similar stocks */}
              <div className="groww-card p-4">
                <p className="text-sm font-bold text-foreground mb-3">Similar Stocks</p>
                <div className="space-y-2">
                  {INITIAL_UNIVERSE
                    .filter(s => s !== stock.symbol)
                    .map(s => stocks[s] || { symbol: s, price: 0, changePercent: 0 })
                    .slice(0, 4)
                    .map((s) => (
                      <div
                        key={s.symbol}
                        className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/explore/${s.symbol}`)}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-primary">{s.symbol.slice(0, 2)}</span>
                        </div>
                        <p className="text-sm font-bold text-muted-foreground">{s.symbol}</p>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
