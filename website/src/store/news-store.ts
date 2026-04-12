"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";

const NEWS_API_BASE = process.env.NEXT_PUBLIC_NEWS_API_BASE ?? "/api/news";
const STALE_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export interface NewsArticle {
  title: string;
  source: string;
  summary: string;
  url: string;
  published: string;
  feedType: "live" | "fallback";
  sentiment?: "positive" | "negative" | "neutral";
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

  const articles: NewsArticle[] = [];

  for (const item of input) {
    const source = typeof item === "object" && item !== null ? item as Record<string, unknown> : null;
    if (!source) continue;

    const title = typeof source.title === "string" ? source.title : "";
    const summary = typeof source.summary === "string" ? source.summary : "";
    const sourceName = typeof source.source === "string" ? source.source : "Market Desk";
    const url = typeof source.url === "string" ? source.url : "#";
    const sentiment =
      source.sentiment === "positive" || source.sentiment === "negative" || source.sentiment === "neutral"
        ? source.sentiment
        : undefined;

    const published =
      typeof source.published === "string"
        ? source.published
        : typeof source.publishedAt === "string"
          ? source.publishedAt
          : new Date().toISOString();

    if (!title) continue;
    articles.push({ title, summary, source: sourceName, url, published, feedType: "live", sentiment });
  }

  return articles;
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
      const articles = normalizeApiArticles(data?.articles);

      set((s) => ({
        cache: { ...s.cache, [key]: { articles, fetchedAt: Date.now() } },
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
        cache: { ...s.cache, [key]: { articles: [], fetchedAt: Date.now() } },
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
