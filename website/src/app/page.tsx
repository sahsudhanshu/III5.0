"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { INITIAL_UNIVERSE, useDataStore } from "@/store/data-store";
import { useNews } from "@/store/news-store";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import { ArrowRight, TrendingDown, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import { LandingHeroScene } from "@/components/common/landing-hero-scene";

export default function RootPage() {
  const { stocks, fetchStockProfile } = useDataStore();
  const { articles, refresh, loading } = useNews("market", 6);
  const [activeInsight, setActiveInsight] = useState(0);
  const [marketTime, setMarketTime] = useState<Date | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const initTimer = setTimeout(() => setMarketTime(new Date()), 0);
    const timer = setInterval(() => setActiveInsight((v) => (v + 1) % 3), 3500);
    const clock = setInterval(() => setMarketTime(new Date()), 1000);
    return () => {
      clearTimeout(initTimer);
      clearInterval(timer);
      clearInterval(clock);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      for (const symbol of INITIAL_UNIVERSE.slice(0, 8)) {
        if (!mounted) return;
        await fetchStockProfile(symbol);
        await new Promise((r) => setTimeout(r, 90));
      }
      if (mounted) {
        setIsInitialLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [fetchStockProfile]);



  const liveStocks = useMemo(
    () => INITIAL_UNIVERSE.map((s) => stocks[s]).filter(Boolean).slice(0, 8),
    [stocks]
  );

  const movers = useMemo(() => {
    const source = [...liveStocks];
    const gainers = source.filter((s) => s.changePercent >= 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    const losers = source.filter((s) => s.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);
    return { gainers, losers };
  }, [liveStocks]);

  const insights = useMemo(
    () => [
      "Smart watchlists + live market pulse in one place.",
      "AI-powered ideas across sentiment, trend, and risk.",
      "Portfolio analytics designed for fast decisions.",
    ],
    []
  );

  const headline = articles[activeInsight % Math.max(articles.length, 1)]?.title;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Full-screen Loading Overlay */}
      {isInitialLoading && (
        <div className="fixed inset-0 z-100 bg-background flex flex-col items-center justify-center animate-out fade-out duration-500 fill-mode-forwards" style={{ animationDelay: isInitialLoading ? "0s" : "0.5s" }}>
          <Image
            src="/logo.png"
            alt="TradeIQ Logo"
            width={80}
            height={80}
            className="object-contain animate-pulse mb-6"
            priority
          />
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground animate-pulse">Initializing Data Terminal...</p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/85 border-b border-border">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="TradeIQ Logo"
              width={32}
              height={32}
              className="object-contain"
              priority
            />
            <span className="text-2xl font-extrabold tracking-tight">TradeIQ</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-muted-foreground">
            <Link href="/explore" className="hover:text-foreground transition-colors">Stocks</Link>
            <Link href="/news" className="hover:text-foreground transition-colors">News</Link>
            <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-muted transition-colors">
              Sign in
            </Link>
            <Link href="/dashboard" className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
              Open App
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8 lg:py-12 space-y-8">
        <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Market Clock: <span className="font-semibold text-foreground">{marketTime ? marketTime.toLocaleTimeString("en-US") : "--:--:--"}</span>
            </div>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="text-muted-foreground font-semibold hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh Feed
            </button>
          </div>
          <div className="mt-4 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-3 min-w-max">
              {liveStocks.map((s) => (
                <Link
                  key={s.symbol}
                  href={`/explore/${s.symbol}`}
                  className="px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted/60 transition-colors"
                >
                  <p className="text-[11px] font-bold text-muted-foreground">{s.symbol}</p>
                  <p className="text-sm num font-bold">{formatCurrency(s.price)}</p>
                  <p className={cn("text-[11px] num font-semibold", s.changePercent >= 0 ? "text-bull" : "text-bear")}>{formatPercent(s.changePercent)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">Smart Investing Platform</p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight">
              Build wealth with
              <span className="gradient-text"> clarity</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl">
              A modern way to explore markets, track portfolios, and act on real-time intelligence.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
                Get started <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/explore" className="px-6 py-3 rounded-xl border border-border font-semibold hover:bg-muted transition-colors">
                Explore markets
              </Link>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-4 min-h-[76px] flex items-center">
              <p className="text-sm font-semibold text-foreground animate-fade-in-up">{insights[activeInsight]}</p>
            </div>
          </div>

          <div className="relative rounded-3xl border border-border bg-card p-6 min-h-[420px] overflow-hidden">
            <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/15 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-16 w-64 h-64 bg-chart-2/10 rounded-full blur-3xl" />

            <div className="relative grid grid-cols-2 gap-4">
              <div className="col-span-2 rounded-xl border border-border bg-background/80 overflow-hidden">
                <LandingHeroScene className="h-[210px] w-full" />
              </div>
              <div className="col-span-2 rounded-xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground font-semibold">Live Insight</p>
                <p className="text-sm font-bold mt-1 line-clamp-2">{headline ?? "Live headlines will appear here as market feed updates."}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-2">Top Gainers</p>
                {movers.gainers.map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between text-sm py-1">
                    <span className="font-semibold">{s.symbol}</span>
                    <span className="text-bull font-bold inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" />{formatPercent(s.changePercent)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground font-semibold mb-2">Top Losers</p>
                {movers.losers.map((s) => (
                  <div key={s.symbol} className="flex items-center justify-between text-sm py-1">
                    <span className="font-semibold">{s.symbol}</span>
                    <span className="text-bear font-bold inline-flex items-center gap-1"><TrendingDown className="w-3 h-3" />{formatPercent(s.changePercent)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { k: "Assets tracked", v: "10K+" },
            { k: "Active users", v: "240K" },
            { k: "Orders/day", v: "1.8M" },
            { k: "Uptime", v: "99.95%" },
          ].map((item) => (
            <div key={item.k} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground font-semibold">{item.k}</p>
              <p className="text-2xl font-black mt-1">{item.v}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
