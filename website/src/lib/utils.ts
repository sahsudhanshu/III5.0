import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format currency in USD */
export function formatCurrency(
  value: number,
  options?: { compact?: boolean; showSign?: boolean }
): string {
  const { compact = false, showSign = false } = options ?? {};
  const prefix = showSign && value > 0 ? "+" : "";

  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000_000) {
      return `${prefix}$${(value / 1_000_000_000_000).toFixed(2)}T`;
    } else if (abs >= 1_000_000_000) {
      return `${prefix}$${(value / 1_000_000_000).toFixed(2)}B`;
    } else if (abs >= 1_000_000) {
      return `${prefix}$${(value / 1_000_000).toFixed(2)}M`;
    } else if (abs >= 1_000) {
      return `${prefix}$${(value / 1_000).toFixed(2)}K`;
    }
    return `${prefix}$${value.toFixed(2)}`;
  }

  return (
    prefix +
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  );
}

/** Format large numbers (volume, market cap) */
export function formatNumber(
  value: number,
  options?: { compact?: boolean }
): string {
  const { compact = true } = options ?? {};

  if (!compact) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toString();
}

/** Format percentage */
export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Relative time (e.g., "2 min ago") */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Format date for display */
export function formatDate(
  dateString: string,
  style: "short" | "medium" | "long" = "medium"
): string {
  const date = new Date(dateString);
  const formats: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: "2-digit", month: "short" },
    medium: { day: "2-digit", month: "short", year: "numeric" },
    long: {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  };
  return date.toLocaleDateString("en-US", formats[style]);
}

/** Get color class for a change value */
export function getChangeColor(value: number): string {
  if (value > 0) return "text-bull";
  if (value < 0) return "text-bear";
  return "text-muted-foreground";
}

/** Get background class for a change value */
export function getChangeBg(value: number): string {
  if (value > 0) return "bg-bull-muted text-bull";
  if (value < 0) return "bg-bear-muted text-bear";
  return "bg-muted text-muted-foreground";
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Generate a fake stock price movement */
export function generatePriceMovement(
  basePrice: number,
  count: number,
  volatility = 0.02
): number[] {
  const prices: number[] = [basePrice];
  for (let i = 1; i < count; i++) {
    const change = prices[i - 1] * volatility * (Math.random() - 0.48);
    prices.push(Math.max(prices[i - 1] + change, 1));
  }
  return prices;
}

/** Sleep utility */
export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Debounce */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Truncate string */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/** Generate unique ID */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}
