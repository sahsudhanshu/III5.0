// ============================================================
// TRADING PLATFORM — CORE TYPE DEFINITIONS
// ============================================================

// ---- Auth ----
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: "free" | "pro" | "enterprise";
  createdAt: string;
}

// ---- Market Data ----
export interface Stock {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52w: number;
  low52w: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  pe: number;
  pb: number;
  eps: number;
  dividendYield: number;
  beta: number;
}

export interface CandlestickDataPoint {
  time: string; // ISO or unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LineDataPoint {
  time: string;
  value: number;
}

export type TimeFilter = "1D" | "1W" | "1M" | "3M" | "6M" | "5Y";
export type ChartType = "candlestick" | "line" | "area";

// ---- Portfolio ----
export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  sector: string;
}

export interface Portfolio {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayPnL: number;
  dayPnLPercent: number;
  holdings: Holding[];
  cash: number;
}

// ---- Transactions ----
export type TransactionType = "BUY" | "SELL" | "DEPOSIT" | "WITHDRAW";
export type TransactionStatus = "COMPLETED" | "PENDING" | "CANCELLED" | "FAILED";

export interface Transaction {
  id: string;
  symbol?: string;
  name?: string;
  type: TransactionType;
  quantity?: number;
  price?: number;
  totalValue?: number;
  status: TransactionStatus;
  timestamp: string;
  charges?: number;
  taxes?: number;
}

// ---- Order ----
export type OrderType = "MARKET" | "LIMIT" | "SL" | "SL-M";
export type OrderValidity = "DAY" | "IOC" | "GTT";

export interface Order {
  symbol: string;
  name: string;
  type: TransactionType;
  orderType: OrderType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
  validity: OrderValidity;
}

// ---- Watchlist ----
export interface WatchlistItem {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  addedAt: string;
}

// ---- News ----
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  feedType?: "live" | "fallback";
  sentiment: "positive" | "negative" | "neutral";
  relatedSymbols: string[];
  imageUrl?: string;
}

// ---- AI Chat ----
export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  isLoading?: boolean;
}

// ---- UI State ----
export interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
  read: boolean;
}

// ---- Analytics ----
export interface PortfolioSnapshot {
  date: string;
  value: number;
  pnl: number;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
  color: string;
}
