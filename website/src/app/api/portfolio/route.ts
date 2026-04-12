import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/mongoose";
import { getOrCreatePortfolio } from "@/lib/portfolio";

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

    const payload = {
      cash_balance: Number(portfolio.cashBalance ?? 0),
      holdings: (portfolio.holdings ?? []).map((h) => ({
        symbol: h.symbol,
        qty: h.qty,
        avg_buy_price: h.avgBuyPrice,
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
          { message: data?.detail ?? `HF insight failed (${res.status})` },
          { status: 502 }
        );
      }
      return NextResponse.json(data);
    } catch (error) {
      return NextResponse.json(
        { message: `HF insight request failed: ${String(error)}` },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ portfolio });
}
