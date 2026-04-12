"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Search, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNews } from "@/store/news-store";
import { useChatContext } from "@/store/chat-store";

const SENTIMENTS = ["All", "positive", "negative", "neutral"] as const;

export default function NewsPage() {
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState<(typeof SENTIMENTS)[number]>("All");

  // useNews handles debouncing internally — 500ms after user stops typing,
  // the store fetches + caches results for this query.
  const query = search.trim() || "finance";
  const { articles: rawArticles, loading, refresh } = useNews(query, 15, 500);

  // Register page context for Aria chatbot
  useChatContext("User is browsing the market news page.");

  const filtered = rawArticles
    .map((article) => {
      const t = article.title.toLowerCase();
      const isPositive = t.includes("beat") || t.includes("jump") || t.includes("rally") || t.includes("surge") || t.includes("gain");
      const isNegative = t.includes("fall") || t.includes("drop") || t.includes("decline") || t.includes("crash") || t.includes("slump");
      const s = isPositive ? "positive" : isNegative ? "negative" : "neutral";
      return { ...article, sentiment: s, id: article.url || article.title };
    })
    .filter((n) => sentiment === "All" || n.sentiment === sentiment);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Market News</h1>
        <p className="text-muted-foreground text-sm">Live updates — search any stock, sector, or topic</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search: AAPL, Fed rates, tech sector..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <div className="flex gap-1.5">
          {SENTIMENTS.map((s) => (
            <Button
              key={s}
              variant={sentiment === s ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs capitalize"
              onClick={() => setSentiment(s)}
            >
              {s}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs gap-1.5"
          onClick={() => refresh()}
          disabled={loading}
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          Refresh News
        </Button>
      </div>

      {/* Loading skeleton */}
      {loading && rawArticles.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="h-5 w-16 bg-muted rounded-full" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-muted rounded" />
                <div className="h-4 w-4/5 bg-muted rounded" />
                <div className="h-4 w-3/5 bg-muted rounded" />
              </div>
              <div className="h-3 w-2/3 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* News grid */}
      {(!loading || rawArticles.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((article) => (
            <div
              key={article.id}
              className="group cursor-pointer bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all flex flex-col gap-3"
              onClick={() => article.url && window.open(article.url, "_blank")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "text-xs",
                      article.sentiment === "positive"
                        ? "bg-bull-muted text-bull"
                        : article.sentiment === "negative"
                        ? "bg-bear-muted text-bear"
                        : "bg-muted text-muted-foreground"
                    )}
                    variant="secondary"
                  >
                    {article.sentiment}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    {article.feedType === "live" ? "Live" : "Fallback"}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">{article.source}</span>
              </div>

              <h3 className="text-sm font-semibold leading-relaxed group-hover:text-primary transition-colors line-clamp-3">
                {article.title}
              </h3>

              {article.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {article.summary}
                </p>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                <span className="text-[10px] text-muted-foreground">{article.published}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && rawArticles.length > 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No news matching <strong>{sentiment}</strong> sentiment
        </div>
      )}

      {!loading && rawArticles.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No results found for &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
