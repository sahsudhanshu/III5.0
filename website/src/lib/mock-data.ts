// ============================================================
// MOCK DATA — TRADING PLATFORM
// US Stocks, realistic numbers
// ============================================================
import type {
  Stock,
  Holding,
  Portfolio,
  Transaction,
  WatchlistItem,
  NewsArticle,
  PortfolioSnapshot,
  SectorAllocation,
  CandlestickDataPoint,
} from "@/types";

// ---- US Stocks ----
export const MOCK_STOCKS: Stock[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    sector: "Technology",
    price: 185.85,
    change: 2.35,
    changePercent: 1.28,
    volume: 54321560,
    marketCap: 2924500000000,
    high52w: 199.62,
    low52w: 164.08,
    dayHigh: 186.40,
    dayLow: 183.92,
    open: 184.15,
    previousClose: 183.50,
    pe: 28.3,
    pb: 42.1,
    eps: 6.42,
    dividendYield: 0.53,
    beta: 1.28,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    sector: "Technology",
    price: 415.10,
    change: -1.45,
    changePercent: -0.35,
    volume: 22547890,
    marketCap: 3012400000000,
    high52w: 430.82,
    low52w: 311.55,
    dayHigh: 418.90,
    dayLow: 413.00,
    open: 416.55,
    previousClose: 416.55,
    pe: 35.1,
    pb: 12.8,
    eps: 11.54,
    dividendYield: 0.74,
    beta: 0.89,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    sector: "Technology",
    price: 924.30,
    change: 12.10,
    changePercent: 1.33,
    volume: 68234010,
    marketCap: 2204200000000,
    high52w: 974.00,
    low52w: 262.20,
    dayHigh: 935.00,
    dayLow: 911.10,
    open: 915.00,
    previousClose: 912.20,
    pe: 72.4,
    pb: 37.3,
    eps: 11.93,
    dividendYield: 0.02,
    beta: 1.68,
  },
  {
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    exchange: "NYSE",
    sector: "Financials",
    price: 198.80,
    change: -0.90,
    changePercent: -0.45,
    volume: 9124567,
    marketCap: 569300000000,
    high52w: 200.30,
    low52w: 135.55,
    dayHigh: 199.95,
    dayLow: 197.50,
    open: 199.10,
    previousClose: 199.70,
    pe: 11.9,
    pb: 1.8,
    eps: 16.23,
    dividendYield: 2.19,
    beta: 1.11,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    exchange: "NASDAQ",
    sector: "Consumer Cyclical",
    price: 175.45,
    change: 5.30,
    changePercent: 3.12,
    volume: 103456780,
    marketCap: 565400000000,
    high52w: 299.29,
    low52w: 152.37,
    dayHigh: 177.00,
    dayLow: 171.10,
    open: 172.00,
    previousClose: 170.15,
    pe: 42.3,
    pb: 9.1,
    eps: 3.12,
    dividendYield: 0.00,
    beta: 2.22,
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    exchange: "NASDAQ",
    sector: "Consumer Cyclical",
    price: 178.60,
    change: -1.40,
    changePercent: -0.78,
    volume: 45321980,
    marketCap: 1847600000000,
    high52w: 183.00,
    low52w: 98.20,
    dayHigh: 181.70,
    dayLow: 177.30,
    open: 181.00,
    previousClose: 180.00,
    pe: 60.1,
    pb: 8.2,
    eps: 2.90,
    dividendYield: 0.00,
    beta: 1.15,
  },
  {
    symbol: "META",
    name: "Meta Platforms Inc.",
    exchange: "NASDAQ",
    sector: "Technology",
    price: 523.45,
    change: 9.30,
    changePercent: 1.81,
    volume: 19876540,
    marketCap: 1336200000000,
    high52w: 523.57,
    low52w: 207.13,
    dayHigh: 525.00,
    dayLow: 512.50,
    open: 514.80,
    previousClose: 514.15,
    pe: 32.8,
    pb: 8.4,
    eps: 14.87,
    dividendYield: 0.38,
    beta: 1.21,
  },
  {
    symbol: "JNJ",
    name: "Johnson & Johnson",
    exchange: "NYSE",
    sector: "Healthcare",
    price: 154.10,
    change: -1.26,
    changePercent: -0.81,
    volume: 8145678,
    marketCap: 374700000000,
    high52w: 175.97,
    low52w: 143.13,
    dayHigh: 155.80,
    dayLow: 153.40,
    open: 155.75,
    previousClose: 155.36,
    pe: 25.4,
    pb: 5.0,
    eps: 5.75,
    dividendYield: 3.09,
    beta: 0.54,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    sector: "Technology",
    price: 167.35,
    change: 2.70,
    changePercent: 1.64,
    volume: 29765430,
    marketCap: 2062800000000,
    high52w: 170.82,
    low52w: 102.63,
    dayHigh: 168.00,
    dayLow: 164.90,
    open: 166.00,
    previousClose: 164.65,
    pe: 26.2,
    pb: 6.6,
    eps: 5.80,
    dividendYield: 0.00,
    beta: 1.05,
  },
  {
    symbol: "WMT",
    name: "Walmart Inc.",
    exchange: "NYSE",
    sector: "Consumer Defensive",
    price: 61.50,
    change: 0.65,
    changePercent: 1.07,
    volume: 15678901,
    marketCap: 497400000000,
    high52w: 61.65,
    low52w: 48.65,
    dayHigh: 61.60,
    dayLow: 60.50,
    open: 60.70,
    previousClose: 60.85,
    pe: 28.0,
    pb: 5.6,
    eps: 2.12,
    dividendYield: 1.34,
    beta: 0.48,
  },
  {
    symbol: "BTC",
    name: "Bitcoin USD (Binance)",
    exchange: "CRYPTO",
    sector: "Crypto",
    price: 98450.0,
    change: 1250.0,
    changePercent: 1.28,
    volume: 345000,
    marketCap: 150000000,
    high52w: 104000.0,
    low52w: 42000.0,
    dayHigh: 99000.0,
    dayLow: 97000.0,
    open: 97200.0,
    previousClose: 97200.0,
    pe: 0,
    pb: 0,
    eps: 0,
    dividendYield: 0,
    beta: 2.1,
  },
];

// ---- Portfolio ----
const MOCK_HOLDINGS: Holding[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    quantity: 50,
    avgBuyPrice: 150.0,
    currentPrice: 185.85,
    investedValue: 7500,
    currentValue: 9292.5,
    pnl: 1792.5,
    pnlPercent: 23.90,
    dayChange: 117.5,
    dayChangePercent: 1.28,
    sector: "Technology",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    quantity: 20,
    avgBuyPrice: 350.0,
    currentPrice: 415.10,
    investedValue: 7000,
    currentValue: 8302,
    pnl: 1302,
    pnlPercent: 18.60,
    dayChange: -29,
    dayChangePercent: -0.35,
    sector: "Technology",
  },
  {
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    quantity: 100,
    avgBuyPrice: 180.0,
    currentPrice: 198.80,
    investedValue: 18000,
    currentValue: 19880,
    pnl: 1880,
    pnlPercent: 10.44,
    dayChange: -90,
    dayChangePercent: -0.45,
    sector: "Financials",
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    quantity: 10,
    avgBuyPrice: 200.0,
    currentPrice: 175.45,
    investedValue: 2000,
    currentValue: 1754.5,
    pnl: -245.5,
    pnlPercent: -12.28,
    dayChange: 53,
    dayChangePercent: 3.12,
    sector: "Consumer Cyclical",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    quantity: 15,
    avgBuyPrice: 450.0,
    currentPrice: 924.30,
    investedValue: 6750,
    currentValue: 13864.5,
    pnl: 7114.5,
    pnlPercent: 105.40,
    dayChange: 181.5,
    dayChangePercent: 1.33,
    sector: "Technology",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    quantity: 75,
    avgBuyPrice: 140.0,
    currentPrice: 167.35,
    investedValue: 10500,
    currentValue: 12551.25,
    pnl: 2051.25,
    pnlPercent: 19.54,
    dayChange: 202.5,
    dayChangePercent: 1.64,
    sector: "Technology",
  },
];

export const MOCK_PORTFOLIO: Portfolio = {
  totalValue: MOCK_HOLDINGS.reduce((s, h) => s + h.currentValue, 0),
  totalInvested: MOCK_HOLDINGS.reduce((s, h) => s + h.investedValue, 0),
  totalPnL: MOCK_HOLDINGS.reduce((s, h) => s + h.pnl, 0),
  totalPnLPercent: 26.83,
  dayPnL: MOCK_HOLDINGS.reduce((s, h) => s + h.dayChange, 0),
  dayPnLPercent: 0.67,
  holdings: MOCK_HOLDINGS,
  cash: 12450.00,
};

// ---- Transactions ----
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "txn_001",
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "BUY",
    quantity: 10,
    price: 183.5,
    totalValue: 1835,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    charges: 2.5,
    taxes: 0.14,
  },
  {
    id: "txn_002",
    symbol: "META",
    name: "Meta Platforms Inc.",
    type: "SELL",
    quantity: 5,
    price: 514.2,
    totalValue: 2571,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    charges: 1.8,
    taxes: 0.21,
  },
  {
    id: "txn_003",
    symbol: "TSLA",
    name: "Tesla Inc.",
    type: "BUY",
    quantity: 5,
    price: 172.0,
    totalValue: 860,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    charges: 2.7,
    taxes: 0.0,
  },
  {
    id: "txn_004",
    symbol: "JPM",
    name: "JPMorgan Chase & Co.",
    type: "BUY",
    quantity: 100,
    price: 198.0,
    totalValue: 19800,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    charges: 15.0,
    taxes: 1.8,
  },
  {
    id: "txn_005",
    symbol: "JNJ",
    name: "Johnson & Johnson",
    type: "SELL",
    quantity: 20,
    price: 155.0,
    totalValue: 3100,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    charges: 2.2,
    taxes: 0.8,
  },
  {
    id: "txn_006",
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    type: "BUY",
    quantity: 5,
    price: 915.0,
    totalValue: 4575,
    status: "PENDING",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    charges: 1.8,
    taxes: 0.65,
  },
];

// ---- Watchlist ----
export const MOCK_WATCHLIST: WatchlistItem[] = MOCK_STOCKS.slice(0, 6).map(
  (s) => ({
    symbol: s.symbol,
    name: s.name,
    exchange: s.exchange,
    price: s.price,
    change: s.change,
    changePercent: s.changePercent,
    volume: s.volume,
    addedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
);

// ---- News ----
export const MOCK_NEWS: NewsArticle[] = [
  {
    id: "news_001",
    title: "NVIDIA Q1 profit surges 180% YoY on strong AI demand",
    summary:
      "NVIDIA reported record-breaking revenue for Q1, beating analyst estimates heavily.",
    source: "Bloomberg",
    url: "#",
    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["NVDA"],
    imageUrl: "/images/news1.jpg",
  },
  {
    id: "news_002",
    title: "Apple misses iPhone sales estimates, signals cautious Q2 outlook",
    summary:
      "Apple reported slowing revenue growth in China affecting overall hardware sales.",
    source: "Wall Street Journal",
    url: "#",
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    sentiment: "negative",
    relatedSymbols: ["AAPL"],
    imageUrl: "/images/news2.jpg",
  },
  {
    id: "news_003",
    title: "Fed holds rate steady at 5.5% in FOMC meeting",
    summary:
      "The Federal Reserve kept the interest rates unchanged as inflation remains slightly above the target.",
    source: "CNBC",
    url: "#",
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    sentiment: "neutral",
    relatedSymbols: ["JPM"],
    imageUrl: "/images/news3.jpg",
  },
  {
    id: "news_004",
    title: "Tesla sees record EV deliveries, crossing global targets",
    summary:
      "Tesla reported sales growth of 28% YoY, rebounding from previous factory downtimes.",
    source: "Yahoo Finance",
    url: "#",
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["TSLA"],
    imageUrl: "/images/news4.jpg",
  },
  {
    id: "news_005",
    title: "S&P 500 hits fresh record high; markets rally on AI boom",
    summary:
      "Benchmark indices surged with tech stocks leading the way globally.",
    source: "Reuters",
    url: "#",
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["AAPL", "MSFT", "GOOGL", "NVDA"],
  },
];

// ---- Portfolio History ----
export function generatePortfolioHistory(days = 365): PortfolioSnapshot[] {
  const snapshots: PortfolioSnapshot[] = [];
  let value = 45000;

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const change = value * 0.015 * (Math.random() - 0.46);
    value = Math.max(value + change, 35000);
    snapshots.push({
      date: date.toISOString().split("T")[0],
      value: parseFloat(value.toFixed(2)),
      pnl: parseFloat((value - 45000).toFixed(2)),
    });
  }

  return snapshots;
}

// ---- Sector Allocation ----
export const MOCK_SECTOR_ALLOCATION: SectorAllocation[] = [
  { sector: "Technology", value: 33909.75, percentage: 51.6, color: "#6366f1" },
  { sector: "Financials", value: 19880, percentage: 30.3, color: "#0ea5e9" },
  { sector: "Consumer Cyclical", value: 1754.5, percentage: 2.7, color: "#f97316" },
  { sector: "Other", value: 10100, percentage: 15.4, color: "#64748b" },
];

// ---- Candlestick Data ----
export function generateCandlestickData(
  basePrice: number,
  count: number,
  interval = "1D"
): CandlestickDataPoint[] {
  const data: CandlestickDataPoint[] = [];
  let close = basePrice;

  const now = Date.now();
  const intervalMs =
    interval === "1D"
      ? 5 * 60 * 1000
      : interval === "1W"
        ? 30 * 60 * 1000
        : interval === "1M"
          ? 4 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

  for (let i = count; i >= 0; i--) {
    const time = new Date(now - i * intervalMs).toISOString();
    const change = close * 0.015 * (Math.random() - 0.48);
    const open = close;
    close = Math.max(open + change, 1);
    const high = Math.max(open, close) + Math.abs(change) * Math.random();
    const low = Math.min(open, close) - Math.abs(change) * Math.random();

    data.push({
      time,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(Math.random() * 1000000 + 200000),
    });
  }

  return data;
}

// ---- Ticker symbols for top bar ----
export const TICKER_STOCKS = MOCK_STOCKS.map((s) => ({
  symbol: s.symbol,
  price: s.price,
  change: s.change,
  changePercent: s.changePercent,
}));
