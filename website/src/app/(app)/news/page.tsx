"use client";
import { useState } from "react";
import { MOCK_NEWS } from "@/lib/mock-data";
import { cn, timeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const SENTIMENTS = ["All", "positive", "negative", "neutral"] as const;

export default function NewsPage() {
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState<(typeof SENTIMENTS)[number]>("All");

  const filtered = MOCK_NEWS.filter((n) => {
    const matchSearch = n.title.toLowerCase().includes(search.toLowerCase()) || n.source.toLowerCase().includes(search.toLowerCase());
    const matchSentiment = sentiment === "All" || n.sentiment === sentiment;
    return matchSearch && matchSentiment;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Market News</h1>
        <p className="text-muted-foreground text-sm">Latest updates from Indian financial markets</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search news..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {SENTIMENTS.map((s) => (
            <Button key={s} variant={sentiment === s ? "default" : "outline"} size="sm" className="h-9 text-xs capitalize" onClick={() => setSentiment(s)}>
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((article) => (
          <div key={article.id} className="group cursor-pointer bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-md transition-all flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Badge className={cn("text-xs", article.sentiment === "positive" ? "bg-bull-muted text-bull" : article.sentiment === "negative" ? "bg-bear-muted text-bear" : "bg-muted text-muted-foreground")} variant="secondary">
                {article.sentiment}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{article.source}</span>
            </div>

            <h3 className="text-sm font-semibold leading-relaxed group-hover:text-primary transition-colors line-clamp-3">
              {article.title}
            </h3>

            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {article.summary}
            </p>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
              <div className="flex flex-wrap gap-1">
                {article.relatedSymbols.slice(0, 3).map((sym) => (
                  <span key={sym} className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{sym}</span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{timeAgo(article.publishedAt)}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No news matching your filters
        </div>
      )}
    </div>
  );
}
