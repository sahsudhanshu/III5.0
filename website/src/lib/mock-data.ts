// ============================================================
// MOCK DATA — TRADING PLATFORM
// Indian NSE stocks, realistic numbers
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

// ---- NSE Stocks ----
export const MOCK_STOCKS: Stock[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    exchange: "NSE",
    sector: "Energy",
    price: 2847.5,
    change: 34.25,
    changePercent: 1.22,
    volume: 8432156,
    marketCap: 1924500,
    high52w: 3217.9,
    low52w: 2180.1,
    dayHigh: 2861.0,
    dayLow: 2803.4,
    open: 2815.0,
    previousClose: 2813.25,
    pe: 24.3,
    pb: 2.1,
    eps: 117.2,
    dividendYield: 0.37,
    beta: 0.94,
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    exchange: "NSE",
    sector: "IT",
    price: 3621.0,
    change: -28.45,
    changePercent: -0.78,
    volume: 3254789,
    marketCap: 1312400,
    high52w: 4218.05,
    low52w: 3311.0,
    dayHigh: 3659.9,
    dayLow: 3603.0,
    open: 3649.55,
    previousClose: 3649.45,
    pe: 29.1,
    pb: 12.8,
    eps: 124.4,
    dividendYield: 1.38,
    beta: 0.72,
  },
  {
    symbol: "INFY",
    name: "Infosys Ltd",
    exchange: "NSE",
    sector: "IT",
    price: 1456.3,
    change: 12.1,
    changePercent: 0.84,
    volume: 6823401,
    marketCap: 604200,
    high52w: 1888.15,
    low52w: 1351.45,
    dayHigh: 1468.0,
    dayLow: 1441.1,
    open: 1445.0,
    previousClose: 1444.2,
    pe: 22.4,
    pb: 7.3,
    eps: 65.01,
    dividendYield: 2.63,
    beta: 0.88,
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    price: 1672.8,
    change: -8.9,
    changePercent: -0.53,
    volume: 9124567,
    marketCap: 1269300,
    high52w: 1880.0,
    low52w: 1363.55,
    dayHigh: 1692.05,
    dayLow: 1663.5,
    open: 1681.0,
    previousClose: 1681.7,
    pe: 18.9,
    pb: 2.8,
    eps: 88.5,
    dividendYield: 1.19,
    beta: 0.83,
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank Ltd",
    exchange: "NSE",
    sector: "Banking",
    price: 1089.45,
    change: 15.3,
    changePercent: 1.42,
    volume: 12345678,
    marketCap: 765400,
    high52w: 1196.0,
    low52w: 878.7,
    dayHigh: 1097.0,
    dayLow: 1072.1,
    open: 1075.0,
    previousClose: 1074.15,
    pe: 17.3,
    pb: 3.1,
    eps: 63.0,
    dividendYield: 0.83,
    beta: 1.02,
  },
  {
    symbol: "WIPRO",
    name: "Wipro Ltd",
    exchange: "NSE",
    sector: "IT",
    price: 478.6,
    change: -3.4,
    changePercent: -0.71,
    volume: 4532198,
    marketCap: 247600,
    high52w: 575.0,
    low52w: 378.2,
    dayHigh: 484.7,
    dayLow: 475.3,
    open: 482.0,
    previousClose: 482.0,
    pe: 20.1,
    pb: 3.2,
    eps: 23.8,
    dividendYield: 0.21,
    beta: 0.79,
  },
  {
    symbol: "BAJFINANCE",
    name: "Bajaj Finance Ltd",
    exchange: "NSE",
    sector: "Finance",
    price: 7234.5,
    change: 89.3,
    changePercent: 1.25,
    volume: 1987654,
    marketCap: 436200,
    high52w: 8192.0,
    low52w: 6187.5,
    dayHigh: 7290.0,
    dayLow: 7145.0,
    open: 7148.0,
    previousClose: 7145.2,
    pe: 35.8,
    pb: 7.4,
    eps: 202.0,
    dividendYield: 0.28,
    beta: 1.18,
  },
  {
    symbol: "HINDUNILVR",
    name: "Hindustan Unilever Ltd",
    exchange: "NSE",
    sector: "FMCG",
    price: 2234.1,
    change: -12.6,
    changePercent: -0.56,
    volume: 2145678,
    marketCap: 524700,
    high52w: 2900.15,
    low52w: 2172.1,
    dayHigh: 2258.0,
    dayLow: 2224.0,
    open: 2246.75,
    previousClose: 2246.7,
    pe: 55.4,
    pb: 12.0,
    eps: 40.3,
    dividendYield: 1.57,
    beta: 0.58,
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd",
    exchange: "NSE",
    sector: "Auto",
    price: 987.35,
    change: 22.7,
    changePercent: 2.35,
    volume: 8976543,
    marketCap: 362800,
    high52w: 1179.0,
    low52w: 793.0,
    dayHigh: 998.0,
    dayLow: 964.9,
    open: 966.0,
    previousClose: 964.65,
    pe: 14.2,
    pb: 3.6,
    eps: 69.5,
    dividendYield: 0.0,
    beta: 1.35,
  },
  {
    symbol: "SBIN",
    name: "State Bank of India",
    exchange: "NSE",
    sector: "Banking",
    price: 782.5,
    change: 5.65,
    changePercent: 0.73,
    volume: 15678901,
    marketCap: 697400,
    high52w: 912.0,
    low52w: 600.65,
    dayHigh: 788.0,
    dayLow: 775.5,
    open: 777.0,
    previousClose: 776.85,
    pe: 11.0,
    pb: 1.6,
    eps: 71.1,
    dividendYield: 1.79,
    beta: 1.1,
  },
];

// ---- Portfolio ----
const MOCK_HOLDINGS: Holding[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    quantity: 50,
    avgBuyPrice: 2410.0,
    currentPrice: 2847.5,
    investedValue: 120500,
    currentValue: 142375,
    pnl: 21875,
    pnlPercent: 18.15,
    dayChange: 1712.5,
    dayChangePercent: 1.22,
    sector: "Energy",
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    quantity: 20,
    avgBuyPrice: 3450.0,
    currentPrice: 3621.0,
    investedValue: 69000,
    currentValue: 72420,
    pnl: 3420,
    pnlPercent: 4.96,
    dayChange: -569,
    dayChangePercent: -0.78,
    sector: "IT",
  },
  {
    symbol: "ICICIBANK",
    name: "ICICI Bank Ltd",
    quantity: 100,
    avgBuyPrice: 980.0,
    currentPrice: 1089.45,
    investedValue: 98000,
    currentValue: 108945,
    pnl: 10945,
    pnlPercent: 11.17,
    dayChange: 1530,
    dayChangePercent: 1.42,
    sector: "Banking",
  },
  {
    symbol: "BAJFINANCE",
    name: "Bajaj Finance Ltd",
    quantity: 10,
    avgBuyPrice: 6800.0,
    currentPrice: 7234.5,
    investedValue: 68000,
    currentValue: 72345,
    pnl: 4345,
    pnlPercent: 6.39,
    dayChange: 893,
    dayChangePercent: 1.25,
    sector: "Finance",
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd",
    quantity: 150,
    avgBuyPrice: 870.0,
    currentPrice: 987.35,
    investedValue: 130500,
    currentValue: 148102.5,
    pnl: 17602.5,
    pnlPercent: 13.49,
    dayChange: 3405,
    dayChangePercent: 2.35,
    sector: "Auto",
  },
  {
    symbol: "INFY",
    name: "Infosys Ltd",
    quantity: 75,
    avgBuyPrice: 1520.0,
    currentPrice: 1456.3,
    investedValue: 114000,
    currentValue: 109222.5,
    pnl: -4777.5,
    pnlPercent: -4.19,
    dayChange: 907.5,
    dayChangePercent: 0.84,
    sector: "IT",
  },
];

export const MOCK_PORTFOLIO: Portfolio = {
  totalValue: MOCK_HOLDINGS.reduce((s, h) => s + h.currentValue, 0),
  totalInvested: MOCK_HOLDINGS.reduce((s, h) => s + h.investedValue, 0),
  totalPnL: MOCK_HOLDINGS.reduce((s, h) => s + h.pnl, 0),
  totalPnLPercent: 11.28,
  dayPnL: MOCK_HOLDINGS.reduce((s, h) => s + h.dayChange, 0),
  dayPnLPercent: 0.98,
  holdings: MOCK_HOLDINGS,
  cash: 124500,
};

// ---- Transactions ----
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "txn_001",
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    type: "BUY",
    quantity: 10,
    price: 2813.5,
    totalValue: 28135,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    charges: 20.5,
    taxes: 28.14,
  },
  {
    id: "txn_002",
    symbol: "WIPRO",
    name: "Wipro Ltd",
    type: "SELL",
    quantity: 50,
    price: 484.2,
    totalValue: 24210,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    charges: 18.0,
    taxes: 24.21,
  },
  {
    id: "txn_003",
    symbol: "BAJFINANCE",
    name: "Bajaj Finance Ltd",
    type: "BUY",
    quantity: 5,
    price: 7200.0,
    totalValue: 36000,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    charges: 27.0,
    taxes: 36.0,
  },
  {
    id: "txn_004",
    symbol: "SBIN",
    name: "State Bank of India",
    type: "BUY",
    quantity: 100,
    price: 778.0,
    totalValue: 77800,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    charges: 15.0,
    taxes: 77.8,
  },
  {
    id: "txn_005",
    symbol: "HINDUNILVR",
    name: "Hindustan Unilever Ltd",
    type: "SELL",
    quantity: 20,
    price: 2290.0,
    totalValue: 45800,
    status: "COMPLETED",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    charges: 22.0,
    taxes: 45.8,
  },
  {
    id: "txn_006",
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    type: "BUY",
    quantity: 30,
    price: 1655.0,
    totalValue: 49650,
    status: "PENDING",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    charges: 18.0,
    taxes: 49.65,
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
    title: "Reliance Industries Q3 profit surges 18% YoY on strong retail and Jio performance",
    summary:
      "Reliance Industries reported a net profit of ₹21,930 crore for Q3 FY25, beating analyst estimates of ₹20,800 crore.",
    source: "Economic Times",
    url: "#",
    publishedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["RELIANCE"],
    imageUrl: "/images/news1.jpg",
  },
  {
    id: "news_002",
    title: "TCS misses revenue estimates, management signals cautious Q4 outlook",
    summary:
      "TCS reported Q3 revenue grew 4.5% YoY in USD terms, missing the street estimate of 5.1% growth.",
    source: "Mint",
    url: "#",
    publishedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    sentiment: "negative",
    relatedSymbols: ["TCS", "INFY", "WIPRO"],
    imageUrl: "/images/news2.jpg",
  },
  {
    id: "news_003",
    title: "RBI holds repo rate steady at 6.5% in February MPC meeting",
    summary:
      "The Reserve Bank of India kept the repo rate unchanged as inflation remains above the 4% target.",
    source: "Business Standard",
    url: "#",
    publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    sentiment: "neutral",
    relatedSymbols: ["HDFCBANK", "ICICIBANK", "SBIN"],
    imageUrl: "/images/news3.jpg",
  },
  {
    id: "news_004",
    title: "Bajaj Finance sees record NFO collections, AUM crosses ₹4 lakh crore mark",
    summary:
      "Bajaj Finance reported AUM growth of 28% YoY, driven by new customer acquisitions in tier-2 and tier-3 cities.",
    source: "CNBC TV18",
    url: "#",
    publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["BAJFINANCE"],
    imageUrl: "/images/news4.jpg",
  },
  {
    id: "news_005",
    title: "Tata Motors' JLR deliveries hit all-time high in Q3, EV transition on track",
    summary:
      "Jaguar Land Rover delivered 108,000+ vehicles in Q3 FY25, a 15% YoY increase driven by Range Rover demand.",
    source: "Auto Car Pro",
    url: "#",
    publishedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["TATAMOTORS"],
    imageUrl: "/images/news5.jpg",
  },
  {
    id: "news_006",
    title: "Nifty 50 hits fresh record high; markets rally on FII buying spree",
    summary:
      "Benchmark indices surged with Nifty 50 touching 25,780, led by banking and IT stocks. FIIs bought ₹4,200 crore worth of equities.",
    source: "Moneycontrol",
    url: "#",
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    sentiment: "positive",
    relatedSymbols: ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK"],
  },
];

// ---- Portfolio History ----
export function generatePortfolioHistory(days = 365): PortfolioSnapshot[] {
  const snapshots: PortfolioSnapshot[] = [];
  let value = 500000;

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const change = value * 0.015 * (Math.random() - 0.46);
    value = Math.max(value + change, 400000);
    snapshots.push({
      date: date.toISOString().split("T")[0],
      value: parseFloat(value.toFixed(2)),
      pnl: parseFloat((value - 500000).toFixed(2)),
    });
  }

  return snapshots;
}

// ---- Sector Allocation ----
export const MOCK_SECTOR_ALLOCATION: SectorAllocation[] = [
  { sector: "Energy", value: 142375, percentage: 21.2, color: "#f97316" },
  { sector: "IT", value: 181642.5, percentage: 27.1, color: "#6366f1" },
  { sector: "Banking", value: 108945, percentage: 16.2, color: "#0ea5e9" },
  { sector: "Finance", value: 72345, percentage: 10.8, color: "#8b5cf6" },
  { sector: "Auto", value: 148102.5, percentage: 22.1, color: "#10b981" },
  { sector: "Other", value: 17000, percentage: 2.6, color: "#64748b" },
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
