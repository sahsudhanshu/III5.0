import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/mongoose";
import { getOrCreatePortfolio } from "@/lib/portfolio";

const MAIN_TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "BRK-B", "V", "WMT"] as const;

function buildFallbackInsight(cashBalance: number, reason: string, ignoredSymbols: string[]) {
  return {
    cash_balance: Number(cashBalance.toFixed(2)),
    net_worth: Number(cashBalance.toFixed(2)),
    tracked_tickers: [...MAIN_TICKERS],
    ignored_symbols: ignoredSymbols,
    average_market_sentiment: 0,
    buy_suggestions: [],
    sell_suggestions: [],
    per_ticker_plan: MAIN_TICKERS.map((ticker) => ({
      ticker,
      action: "HOLD" as const,
      shares_to_trade: 0,
      target_weight_pct: 0,
      target_quantity: 0,
      current_price: 0,
      sentiment_score: 0,
    })),
    ai_insight_text:
      "AI model is temporarily unavailable. Fallback guidance: hold current positions, avoid aggressive rebalancing, and retry insight generation shortly.",
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
            ignoredSymbols
          )
        );
      }
      return NextResponse.json({ ...data, ignored_symbols: [...new Set([...(data.ignored_symbols ?? []), ...ignoredSymbols])] });
    } catch (error) {
      return NextResponse.json(
        buildFallbackInsight(
          Number(portfolio.cashBalance ?? 0),
          `HF insight request failed: ${String(error)}`,
          ignoredSymbols
        )
      );
    }
  }

  return NextResponse.json({ portfolio });
}
