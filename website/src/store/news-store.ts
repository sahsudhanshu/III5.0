"use client";
import { useEffect, useState } from "react";
import { create } from "zustand";

const NEWS_API_BASE = "http://127.0.0.1:8000/api/news";
const STALE_MS = 5 * 60 * 1000; // 5 minutes cache TTL

export interface NewsArticle {
  title: string;
  source: string;
  summary: string;
  url: string;
  published: string;
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
  fetchNews: (query?: string, limit?: number) => Promise<void>;
}

export function cacheKey(query: string, limit: number) {
  return `${query.toLowerCase().trim()}:${limit}`;
}

export const useNewsStore = create<NewsState>()((set, get) => ({
  cache: {},
  loading: {},
  errors: {},

  fetchNews: async (query = "market", limit = 5) => {
    const key = cacheKey(query, limit);
    const existing = get().cache[key];

    // Skip if already loading
    if (get().loading[key]) return;

    // Skip if fresh cache exists
    if (existing && Date.now() - existing.fetchedAt < STALE_MS) return;

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
      const articles: NewsArticle[] = data.articles ?? [];

      set((s) => ({
        cache: { ...s.cache, [key]: { articles, fetchedAt: Date.now() } },
        loading: { ...s.loading, [key]: false },
      }));
    } catch (err) {
      set((s) => ({
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

  // Debounce the query for search inputs
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  useEffect(() => {
    if (debounceMs <= 0) {
      setDebouncedQuery(query);
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  // Trigger fetch whenever debounced query changes
  useEffect(() => {
    fetchNews(debouncedQuery, limit);
  }, [debouncedQuery, limit, fetchNews]);

  // Reactive selectors — these re-subscribe on each render and cause
  // the component to re-render when the cache or loading map updates.
  const key = cacheKey(debouncedQuery, limit);
  const articles = useNewsStore((s) => s.cache[key]?.articles ?? EMPTY_ARTICLES);
  const loading = useNewsStore((s) => s.loading[key] ?? false);

  return { articles, loading, activeQuery: debouncedQuery };
}
