import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/mongoose";
import { getOrCreatePortfolio } from "@/lib/portfolio";

const MAIN_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "BRK-B", "V", "WMT"] as const;

// Approximate real market prices (used when the live RL engine is offline)
const MOCK_PRICES: Record<string, number> = {
  AAPL: 260.48, MSFT: 370.87, GOOGL: 161.25, AMZN: 238.38,
  TSLA: 348.95, META: 629.86, NVDA: 188.63, "BRK-B": 538.72,
  V: 342.15, WMT: 126.77,
};

function buildFallbackInsight(cashBalance: number, reason: string, ignoredSymbols: string[], holdingsMap?: Map<string, number>) {
  // Seeded but slightly varied sentiment per ticker
  const sentiments: Record<string, number> = {
    AAPL: 0.1842, MSFT: 0.2105, GOOGL: -0.0523, AMZN: 0.1477,
    TSLA: -0.1290, META: 0.0834, NVDA: 0.3201, "BRK-B": 0.0612,
    V: 0.1150, WMT: 0.0478,
  };

  // Calculate portfolio value from holdings
  let portfolioValue = 0;
  for (const t of MAIN_TICKERS) {
    const qty = holdingsMap?.get(t) ?? 0;
    portfolioValue += qty * (MOCK_PRICES[t] ?? 0);
  }
  const netWorth = cashBalance + portfolioValue;

  // Build per-ticker plan with mock weights and actions
  const targetWeights: Record<string, number> = {
    AAPL: 12.5, MSFT: 14.0, GOOGL: 9.8, AMZN: 11.2,
    TSLA: 8.5,  META: 10.3, NVDA: 15.2, "BRK-B": 7.0,
    V: 6.5,     WMT: 5.0,
  };

  const perTickerPlan = MAIN_TICKERS.map((ticker) => {
    const qty = holdingsMap?.get(ticker) ?? 0;
    const price = MOCK_PRICES[ticker] ?? 100;
    const targetValue = (targetWeights[ticker] / 100) * netWorth;
    const targetQty = targetValue / price;
    const sharesToTrade = Number((targetQty - qty).toFixed(4));
    let action: "BUY" | "SELL" | "HOLD" = "HOLD";
    if (sharesToTrade > 0.5) action = "BUY";
    else if (sharesToTrade < -0.5) action = "SELL";

    return {
      ticker,
      action,
      shares_to_trade: Number(sharesToTrade.toFixed(4)),
      target_weight_pct: targetWeights[ticker],
      target_quantity: Number(targetQty.toFixed(4)),
      current_price: price,
      sentiment_score: sentiments[ticker] ?? 0,
    };
  });

  const buySuggestions = perTickerPlan
    .filter((t) => t.action === "BUY")
    .sort((a, b) => b.shares_to_trade - a.shares_to_trade);
  const sellSuggestions = perTickerPlan
    .filter((t) => t.action === "SELL")
    .sort((a, b) => Math.abs(b.shares_to_trade) - Math.abs(a.shares_to_trade));

  const avgSentiment = Number(
    (Object.values(sentiments).reduce((a, b) => a + b, 0) / MAIN_TICKERS.length).toFixed(4)
  );

  return {
    cash_balance: Number(cashBalance.toFixed(2)),
    net_worth: Number(netWorth.toFixed(2)),
    tracked_tickers: [...MAIN_TICKERS],
    ignored_symbols: ignoredSymbols,
    average_market_sentiment: avgSentiment,
    buy_suggestions: buySuggestions,
    sell_suggestions: sellSuggestions,
    per_ticker_plan: perTickerPlan,
    ai_insight_text:
      `Portfolio net worth is approximately $${netWorth.toFixed(2)} with $${cashBalance.toFixed(2)} in cash reserves. ` +
      `Market sentiment is mildly constructive (avg score ${avgSentiment.toFixed(3)}), led by strong momentum in NVDA (+0.32) and MSFT (+0.21). ` +
      `The RL model suggests overweighting high-conviction tech names while trimming exposure to underperformers. ` +
      `Consider adding to NVDA and MSFT on pullbacks, maintaining core AAPL and AMZN positions, and reducing TSLA until volatility stabilizes. ` +
      `Defensive allocation in BRK-B and WMT provides downside protection. Keep 5–8% cash buffer for opportunistic entries.`,
    ai_insight_source: "template" as const,
    is_fallback: true,
    fallback_reason: reason,
  };
}

// ── GET /api/portfolio ─────────────────────────────────────────
// Returns the authenticated user's portfolio (holdings + cash + transactions)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Return existing portfolio or create one with the default starting balance
  const portfolio = await getOrCreatePortfolio(session.user.id);

  const mode = (req.nextUrl.searchParams.get("mode") ?? "").trim().toLowerCase();
  if (mode === "insight") {
    const hfBase =
      process.env.HF_BACKEND_BASE_URL ??
      process.env.NEXT_PUBLIC_HF_BACKEND_BASE_URL ??
      "https://SaqlainSQX-iii5-backend.hf.space";

    const quantities = new Map<string, number>(MAIN_TICKERS.map((t) => [t, 0]));
    const ignoredSymbols: string[] = [];
    for (const h of portfolio.holdings ?? []) {
      const symbol = String(h.symbol ?? "").trim().toUpperCase();
      if (!symbol) continue;
      if (quantities.has(symbol)) {
        const prev = quantities.get(symbol) ?? 0;
        quantities.set(symbol, prev + Number(h.qty ?? 0));
      } else {
        ignoredSymbols.push(symbol);
      }
    }

    const payload = {
      cash_balance: Number(portfolio.cashBalance ?? 0),
      holdings: MAIN_TICKERS.map((symbol) => ({
        symbol,
        qty: Number((quantities.get(symbol) ?? 0).toFixed(6)),
        avg_buy_price: 0,
      })),
      sentiment_source: "gnews",
      headlines_per_ticker: 5,
      use_gemini: true,
    };

    try {
      const res = await fetch(`${hfBase}/portfolio-ai-insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          buildFallbackInsight(
            Number(portfolio.cashBalance ?? 0),
            data?.detail ?? `HF insight failed (${res.status})`,
            ignoredSymbols,
            quantities
          )
        );
      }
      return NextResponse.json({ ...data, ignored_symbols: [...new Set([...(data.ignored_symbols ?? []), ...ignoredSymbols])] });
    } catch (error) {
      return NextResponse.json(
        buildFallbackInsight(
          Number(portfolio.cashBalance ?? 0),
          `HF insight request failed: ${String(error)}`,
          ignoredSymbols,
          quantities
        )
      );
    }
  }

  return NextResponse.json({ portfolio });
}
