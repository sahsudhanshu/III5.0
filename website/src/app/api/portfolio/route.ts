import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/mongoose";
import { getOrCreatePortfolio } from "@/lib/portfolio";

// ── GET /api/portfolio ─────────────────────────────────────────
// Returns the authenticated user's portfolio (holdings + cash + transactions)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Return existing portfolio or create one with the default starting balance
  const portfolio = await getOrCreatePortfolio(session.user.id);

  return NextResponse.json({ portfolio });
}
