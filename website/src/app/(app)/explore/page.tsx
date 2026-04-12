"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { formatCurrency, formatPercent, cn, formatNumber } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, ChevronRight, Flame, Star,
  Newspaper, BarChart2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { generateCandlestickData } from "@/lib/mock-data";
import { useWatchlistStore } from "@/store/watchlist-store";
import { useDataStore, INITIAL_UNIVERSE } from "@/store/data-store";
import { toast } from "sonner";
import type { Stock } from "@/types";
import { useNews } from "@/store/news-store";
import { useChatContext } from "@/store/chat-store";
import { useRequireAuth } from "@/hooks/use-require-auth";

// ── Sparkline ──
// We'll keep dynamic simulated sparklines for dashboards to avoid pulling 5x daily candles APIs 
// on initial mount for 10 stocks (would be 50 API calls across widgets and instantly rate-limit).
function Sparkline({ symbol, positive }: { symbol: string; positive: boolean }) {
  const data = React.useMemo(() => {
    const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    // Seeded generation — symbol is passed as 4th arg so the PRNG is seeded per-stock,
    // giving each stock its own unique but stable sparkline on every reload.
    return generateCandlestickData(100 + (hash % 900), 15, "1W", symbol).map((d) => ({
      v: d.close,
    }));
  }, [symbol]);
  const strokeColor = positive ? "#00d09c" : "#eb5b3c";
  const fillColor = positive ? "#00d09c" : "#eb5b3c";
  const safeSymbolId = symbol.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const gradientId = `sparkline-${safeSymbolId}-${positive ? "up" : "down"}`;

  return (
    <ResponsiveContainer width={72} height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity={0.2} />
            <stop offset="100%" stopColor={fillColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={strokeColor} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Index Card ──
const INDICES = [
  { name: "S&P 500", value: 5280.2, change: 0.62 },
  { name: "NASDAQ", value: 16920.5, change: 0.88 },
  { name: "DOW JONES", value: 39230.1, change: 0.14 },
  { name: "RUSSELL 2k", value: 2050.8, change: -0.42 },
  { name: "VIX", value: 14.6, change: -5.12 },
];

function IndexCard({ name, value, change }: { name: string; value: number; change: number }) {
  const positive = change >= 0;
  return (
    <div className="groww-card p-3.5 flex items-center gap-3 min-w-[164px] hover:shadow-sm transition-shadow cursor-pointer">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground truncate">{name}</p>
        <p className="text-sm font-bold num text-foreground mt-0.5">{value.toLocaleString("en-US")}</p>
        <div className={cn("flex items-center gap-0.5 mt-0.5", positive ? "text-bull" : "text-bear")}>
          {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          <span className="text-[11px] font-semibold num">{formatPercent(change)}</span>
        </div>
      </div>
      <Sparkline symbol={name} positive={positive} />
    </div>
  );
}

// ── Stock Row (Groww style) ──
function StockRow({ stock, rank }: { stock: Stock; rank?: number }) {
  const router = useRouter();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist } = useWatchlistStore();
  const { requireAuth } = useRequireAuth();
  const positive = stock.changePercent >= 0;
  const inWL = isInWatchlist(stock.symbol);

  const toggleWL = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth(() => {
      if (inWL) {
        removeFromWatchlist(stock.symbol);
        toast.success(`${stock.symbol} removed`);
      } else {
        addToWatchlist({ symbol: stock.symbol, name: stock.name, exchange: stock.exchange, price: stock.price, change: stock.change, changePercent: stock.changePercent, volume: stock.volume, addedAt: new Date().toISOString() });
        toast.success(`${stock.symbol} added ⭐`);
      }
    }, "Sign in to update your watchlist");
  };

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => router.push(`/explore/${stock.symbol}`)}
    >
      {rank && (
        <span className="text-xs font-bold text-muted-foreground w-5 text-center flex-shrink-0">{rank}</span>
      )}
      {/* Logo */}
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] font-black text-primary">{stock.symbol.slice(0, 2)}</span>
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{stock.symbol}</p>
        <p className="text-[11px] text-muted-foreground truncate">{stock.name}</p>
      </div>
      {/* Sparkline */}
      <Sparkline symbol={stock.symbol} positive={positive} />
      {/* Price */}
      <div className="text-right flex-shrink-0 min-w-[90px]">
        <p className="text-sm font-bold num text-foreground">{formatCurrency(stock.price)}</p>
        <p className={cn("text-[11px] font-semibold num", positive ? "text-bull" : "text-bear")}>
          {positive ? "+" : ""}{formatPercent(stock.changePercent)}
        </p>
      </div>
      {/* Watchlist star */}
      <button
        onClick={toggleWL}
        className={cn("flex-shrink-0 p-1 rounded transition-colors", inWL ? "text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400")}
      >
        <Star className="w-3.5 h-3.5" fill={inWL ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

// ── Section Header ──
function SectionHeader({ title, icon, onViewAll }: { title: string; icon?: React.ReactNode; onViewAll?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="text-primary text-xs font-semibold flex items-center gap-0.5 hover:underline"
        >
          View all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Sector Mapping ──
const SECTOR_FILTER_MAP: Record<string, string[]> = {
  "All": [],
  "Tech": ["Technology", "Software"],
  "Finance": ["Financials", "Banking"],
  "Energy": ["Energy", "Oil & Gas"],
  "Retail": ["Consumer Cyclical", "Retail"],
  "Healthcare": ["Healthcare", "Pharma", "Biotechnology"],
};

// ── Main Explore Page ──
export default function ExplorePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("All");

  const { stocks, fetchStockProfile } = useDataStore();
  const [loading, setLoading] = useState(true);

  // Live news via Zustand store
  const { articles: marketNews, loading: loadingNews } = useNews("market", 4);

  // Register page context for Aria chatbot
  useChatContext("User is browsing the stock explorer page.");

  // Load the initial universe of stocks
  useEffect(() => {
    async function loadUniverse() {
      setLoading(true);
      for (const symbol of INITIAL_UNIVERSE) {
        await fetchStockProfile(symbol);
        await new Promise(r => setTimeout(r, 50));
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

  const availableStocks = INITIAL_UNIVERSE.map(s => stocks[s]).filter(Boolean);

  // Filter stocks based on selected sector
  const filteredStocks = activeSection === "All"
    ? availableStocks
    : availableStocks.filter(s =>
      SECTOR_FILTER_MAP[activeSection]?.some(sectorKeyword =>
        s.sector.toLowerCase().includes(sectorKeyword.toLowerCase())
      )
    );

  const gainers = [...filteredStocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...filteredStocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
  // Real volume from free Finnhub quote 'v' doesn't exist, we will use mock logic or fall back
  const momentum = [...filteredStocks].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 5);

  const FILTERS = ["All", "Tech", "Finance", "Energy", "Retail", "Healthcare"];

  return (
    <div className="max-w-[1700px] mx-auto px-4 lg:px-6 py-6 space-y-8">

      {/* ── Indices Strip ── */}
      <section>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
          {INDICES.map((idx) => (
            <IndexCard key={idx.name} {...idx} />
          ))}
        </div>
      </section>

      {/* ── Filter Tags ── */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveSection(f)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
              activeSection === f
                ? "bg-primary text-white shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* ── Main grid: 2 left columns + 1 right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: 2 sections */}
        <div className="lg:col-span-2 space-y-6">

          {/* Top Gainers */}
          <div className="groww-card p-4">
            <SectionHeader
              title="Top Gainers"
              icon={<TrendingUp className="w-4 h-4 text-bull" />}
              onViewAll={() => router.push("/markets")}
            />
            {loading && gainers.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-20" />
                      <div className="h-2.5 bg-muted rounded w-32" />
                    </div>
                    <div className="w-16 h-8 bg-muted rounded" />
                    <div className="text-right space-y-1">
                      <div className="h-3 bg-muted rounded w-16" />
                      <div className="h-2.5 bg-muted rounded w-10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {gainers.map((s, i) => <StockRow key={s.symbol} stock={s} rank={i + 1} />)}
              </div>
            )}
          </div>

          {/* Top Losers */}
          <div className="groww-card p-4">
            <SectionHeader
              title="Top Losers"
              icon={<TrendingDown className="w-4 h-4 text-bear" />}
              onViewAll={() => router.push("/markets")}
            />
            <div>
              {losers.map((s, i) => <StockRow key={s.symbol} stock={s} rank={i + 1} />)}
            </div>
          </div>

          {/* Top Movers/Momentum */}
          <div className="groww-card p-4">
            <SectionHeader
              title="Top Movers"
              icon={<Flame className="w-4 h-4 text-chart-5" />}
              onViewAll={() => router.push("/markets")}
            />
            <div>
              {momentum.map((s, i) => <StockRow key={s.symbol} stock={s} rank={i + 1} />)}
            </div>
          </div>
        </div>

        {/* Right: Sectors + News */}
        <div className="space-y-6">
          {/* Sector Performance */}
          <div className="groww-card p-4">
            <SectionHeader title="Sectors" icon={<BarChart2 className="w-4 h-4 text-primary" />} />
            <div className="space-y-2.5">
              {[
                { name: "Banking", change: 0.84, color: "#00d09c" },
                { name: "IT", change: -0.42, color: "#eb5b3c" },
                { name: "Energy", change: 1.22, color: "#00d09c" },
                { name: "FMCG", change: -0.56, color: "#eb5b3c" },
                { name: "Auto", change: 2.35, color: "#00d09c" },
                { name: "Finance", change: 1.25, color: "#00d09c" },
                { name: "Pharma", change: -0.18, color: "#eb5b3c" },
              ].map((sec) => (
                <div key={sec.name} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{sec.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(Math.abs(sec.change) * 25 + 30, 95)}%`,
                        background: sec.color,
                      }}
                    />
                  </div>
                  <span className={cn("text-xs font-semibold num w-12 text-right flex-shrink-0", sec.change >= 0 ? "text-bull" : "text-bear")}>
                    {sec.change >= 0 ? "+" : ""}{formatPercent(sec.change)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Market News */}
          <div className="groww-card p-4">
            <SectionHeader
              title="Market News"
              icon={<Newspaper className="w-4 h-4 text-chart-2" />}
              onViewAll={() => router.push("/news")}
            />
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
                    <div
                      key={idx}
                      className="group cursor-pointer pb-3 border-b border-border last:border-0 last:pb-0"
                      onClick={() => article.url ? window.open(article.url, "_blank") : null}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[9px] px-1.5 py-0.5",
                            sentiment === "positive"
                              ? "bg-bull-muted text-bull"
                              : sentiment === "negative"
                                ? "bg-bear-muted text-bear"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {sentiment}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{article.source}</span>
                        {article.published && <span className="text-[9px] text-muted-foreground/70 ml-auto">{article.published}</span>}
                      </div>
                      <p className="text-xs font-semibold text-foreground leading-relaxed group-hover:text-primary transition-colors line-clamp-2">
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

          {/* 52-Week Highs */}
          <div className="groww-card p-4">
            <SectionHeader title="52-Week Highs" icon={<TrendingUp className="w-4 h-4 text-bull" />} />
            <div className="space-y-2">
              {filteredStocks.filter((s) => s.price / s.high52w > 0.92).slice(0, 4).map((s) => (
                <div
                  key={s.symbol}
                  className="flex items-center justify-between py-1.5 hover:bg-muted/40 rounded-lg px-1.5 cursor-pointer transition-colors"
                  onClick={() => router.push(`/explore/${s.symbol}`)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-bull-muted flex items-center justify-center">
                      <span className="text-[9px] font-black text-bull">{s.symbol.slice(0, 2)}</span>
                    </div>
                    <span className="text-xs font-semibold">{s.symbol}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold num">{formatCurrency(s.price)}</p>
                    <p className="text-[10px] text-bull font-medium">
                      {((s.price / s.low52w - 1) * 100).toFixed(1)}% from low
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Full All Stocks Table ── */}
      <section className="groww-card p-4">
        <SectionHeader
          title={activeSection === "All" ? "All Stocks" : `${activeSection} Stocks`}
          icon={<BarChart2 className="w-4 h-4 text-primary" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Company", "Price", "Change", "52W High", "52W Low", "P/E", "Mkt Cap"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((s) => {
                const pos = s.changePercent >= 0;
                return (
                  <tr
                    key={s.symbol}
                    className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => router.push(`/explore/${s.symbol}`)}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-black text-primary">{s.symbol.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">{s.symbol}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">{s.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold num">{formatCurrency(s.price)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn("text-xs font-semibold num px-2 py-0.5 rounded-full", pos ? "bg-bull-muted text-bull" : "bg-bear-muted text-bear")}>
                        {pos ? "+" : ""}{formatPercent(s.changePercent)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs num text-bull font-medium">{formatCurrency(s.high52w)}</td>
                    <td className="px-3 py-2.5 text-xs num text-bear font-medium">{formatCurrency(s.low52w)}</td>
                    <td className="px-3 py-2.5 text-xs num">{s.pe.toFixed(1)}x</td>
                    <td className="px-3 py-2.5 text-xs num text-muted-foreground">${formatNumber(s.marketCap)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
