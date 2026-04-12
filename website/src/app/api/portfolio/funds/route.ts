import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/mongoose";
import { randomUUID } from "crypto";
import { getOrCreatePortfolio, toMoney } from "@/lib/portfolio";

const MAX_DEPOSIT = 1_000_000;
const MIN_AMOUNT   = 1;

// ── POST /api/portfolio/funds ───────────────────────────────────
// Body: { type: "DEPOSIT"|"WITHDRAW", amount: number }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { type, amount } = await req.json();
  const normalizedTypeRaw = String(type ?? "").toUpperCase();
  const amountNum = Number(amount);

  if (!["DEPOSIT", "WITHDRAW"].includes(normalizedTypeRaw)) {
    return NextResponse.json({ message: "Invalid type. Must be DEPOSIT or WITHDRAW." }, { status: 400 });
  }
  const normalizedType = normalizedTypeRaw as "DEPOSIT" | "WITHDRAW";
  if (!Number.isFinite(amountNum) || amountNum < MIN_AMOUNT) {
    return NextResponse.json({ message: `Minimum amount is $${MIN_AMOUNT}` }, { status: 400 });
  }
  if (normalizedType === "DEPOSIT" && amountNum > MAX_DEPOSIT) {
    return NextResponse.json({ message: `Maximum single deposit is $${MAX_DEPOSIT.toLocaleString()}` }, { status: 400 });
  }

  await connectDB();

  const portfolio = await getOrCreatePortfolio(session.user.id);

  if (normalizedType === "WITHDRAW" && portfolio.cashBalance < amountNum) {
    return NextResponse.json(
      { message: `Insufficient balance. Available: $${portfolio.cashBalance.toFixed(2)}` },
      { status: 400 }
    );
  }

  const roundedAmount = toMoney(amountNum);
  const delta = normalizedType === "DEPOSIT" ? roundedAmount : -roundedAmount;
  portfolio.cashBalance = toMoney(portfolio.cashBalance + delta);

  portfolio.transactions.push({
    id: randomUUID(),
    type: normalizedType,
    amount: delta,
    fee: 0,
    status: "COMPLETED",
    timestamp: new Date(),
  });

  portfolio.markModified("transactions");
  await portfolio.save();

  return NextResponse.json({
    message: `${normalizedType} of $${roundedAmount.toFixed(2)} successful`,
    cashBalance: portfolio.cashBalance,
    transaction: portfolio.transactions[portfolio.transactions.length - 1],
  });
}
