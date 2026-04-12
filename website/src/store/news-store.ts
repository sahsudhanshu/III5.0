"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { MOCK_NEWS } from "@/lib/mock-data";

const NEWS_API_BASE = process.env.NEXT_PUBLIC_NEWS_API_BASE ?? "/api/news";
const STALE_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export interface NewsArticle {
  title: string;
  source: string;
  summary: string;
  url: string;
  published: string;
  feedType: "live" | "fallback";
}

const EMPTY_ARTICLES: NewsArticle[] = [];

interface NewsCacheEntry {
  articles: NewsArticle[];
  fetchedAt: number;
}

interface NewsState {
  cache: Record<string, NewsCacheEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  fetchNews: (query?: string, limit?: number, force?: boolean) => Promise<void>;
}

function normalizeApiArticles(input: unknown): NewsArticle[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item) => {
      const source = typeof item === "object" && item !== null ? item as Record<string, unknown> : null;
      if (!source) return null;

      const title = typeof source.title === "string" ? source.title : "";
      const summary = typeof source.summary === "string" ? source.summary : "";
      const sourceName = typeof source.source === "string" ? source.source : "Market Desk";
      const url = typeof source.url === "string" ? source.url : "#";

      const published =
        typeof source.published === "string"
          ? source.published
          : typeof source.publishedAt === "string"
            ? source.publishedAt
            : new Date().toISOString();

      if (!title) return null;
      return { title, summary, source: sourceName, url, published, feedType: "live" } satisfies NewsArticle;
    })
    .filter((a): a is NewsArticle => Boolean(a));
}

function fallbackNews(query: string, limit: number): NewsArticle[] {
  const q = query.trim().toLowerCase();

  const mapped: NewsArticle[] = MOCK_NEWS.map((n) => ({
    title: n.title,
    source: n.source,
    summary: n.summary,
    url: n.url,
    published: n.publishedAt,
    feedType: "fallback",
  }));

  if (!q || q === "market" || q === "finance") {
    return mapped.slice(0, limit);
  }

  const filtered = mapped.filter((n) => {
    const text = `${n.title} ${n.summary} ${n.source}`.toLowerCase();
    return text.includes(q);
  });

  return (filtered.length ? filtered : mapped).slice(0, limit);
}

export function cacheKey(query: string, limit: number) {
  return `${query.toLowerCase().trim()}:${limit}`;
}

export const useNewsStore = create<NewsState>()((set, get) => ({
  cache: {},
  loading: {},
  errors: {},

  fetchNews: async (query = "market", limit = 5, force = false) => {
    const key = cacheKey(query, limit);
    const existing = get().cache[key];

    // Skip if already loading
    if (get().loading[key]) return;

    // Skip if fresh cache exists
    if (!force && existing && Date.now() - existing.fetchedAt < STALE_MS) return;

    set((s) => ({
      loading: { ...s.loading, [key]: true },
      errors: { ...s.errors, [key]: null },
    }));

    try {
      const res = await fetch(
        `${NEWS_API_BASE}?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      let articles = normalizeApiArticles(data?.articles);

      // Keep UX useful even when upstream returns empty payloads.
      if (articles.length === 0) {
        articles = fallbackNews(query, limit);
      }

      set((s) => ({
        cache: { ...s.cache, [key]: { articles, fetchedAt: Date.now() } },
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      const articles = fallbackNews(query, limit);
      set((s) => ({
        cache: { ...s.cache, [key]: { articles, fetchedAt: Date.now() } },
        loading: { ...s.loading, [key]: false },
        errors: { ...s.errors, [key]: String(err) },
      }));
    }
  },
}));

/**
 * Reactive hook — components using this will re-render automatically when
 * articles arrive for the given query. Also handles triggering the fetch.
 * Pass `debounceMs` (default 0) for search-input use cases.
 */
export function useNews(query = "market", limit = 5, debounceMs = 0) {
  const fetchNews = useNewsStore((s) => s.fetchNews);
  const normalizedQuery = query.trim() || "market";

  // Debounce the query for search inputs
  const [debouncedQuery, setDebouncedQuery] = useState(normalizedQuery);

  useEffect(() => {
    if (debounceMs <= 0) return;
    const t = setTimeout(() => setDebouncedQuery(normalizedQuery), debounceMs);
    return () => clearTimeout(t);
  }, [normalizedQuery, debounceMs]);

  const activeQuery = debounceMs > 0 ? debouncedQuery : normalizedQuery;

  // Trigger fetch whenever debounced query changes
  useEffect(() => {
    fetchNews(activeQuery, limit);
  }, [activeQuery, limit, fetchNews]);

  // Reactive selectors — these re-subscribe on each render and cause
  // the component to re-render when the cache or loading map updates.
  const key = cacheKey(activeQuery, limit);
  const articles = useNewsStore((s) => s.cache[key]?.articles ?? EMPTY_ARTICLES);
  const loading = useNewsStore((s) => s.loading[key] ?? false);

  const refresh = async () => {
    await fetchNews(activeQuery, limit, true);
  };

  return { articles, loading, activeQuery, refresh };
}
