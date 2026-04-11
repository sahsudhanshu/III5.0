/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import connectDB from "@/lib/mongoose";
import { randomUUID } from "crypto";
import { getOrCreatePortfolio, normalizeSymbol, toMoney } from "@/lib/portfolio";

const FEE_RATE = 0.001; // 0.1% commission

// ── POST /api/portfolio/order ───────────────────────────────────
// Body: { type: "BUY"|"SELL", symbol, name, exchange, sector, qty, price }
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { type, symbol, name, exchange, sector, qty, price } = await req.json();
  const normalizedType = String(type ?? "").toUpperCase();
  const normalizedSymbol = normalizeSymbol(String(symbol ?? ""));
  const normalizedName = String(name ?? normalizedSymbol).trim();
  const qtyNum = Number(qty);
  const priceNum = Number(price);

  if (!["BUY", "SELL"].includes(normalizedType)) {
    return NextResponse.json({ message: "Invalid order type" }, { status: 400 });
  }

  if (!normalizedSymbol) {
    return NextResponse.json({ message: "Symbol is required" }, { status: 400 });
  }

  if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
    return NextResponse.json({ message: "Quantity must be a positive whole number" }, { status: 400 });
  }

  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return NextResponse.json({ message: "Invalid order parameters" }, { status: 400 });
  }

  await connectDB();

  // Auto-create portfolio if needed
  const portfolio = await getOrCreatePortfolio(session.user.id);

  const totalValue = qtyNum * priceNum;
  const fee = toMoney(totalValue * FEE_RATE);

  if (normalizedType === "BUY") {
    const totalCost = totalValue + fee;
    if (portfolio.cashBalance < totalCost) {
      return NextResponse.json(
        { message: `Insufficient funds. Need $${totalCost.toFixed(2)}, have $${portfolio.cashBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    // Update or create holding
    const existingIdx = portfolio.holdings.findIndex(
      (h: any) => h.symbol === normalizedSymbol
    );

    if (existingIdx >= 0) {
      const h = portfolio.holdings[existingIdx];
      const totalQty = h.qty + qtyNum;
      const newAvg = (h.avgBuyPrice * h.qty + priceNum * qtyNum) / totalQty;
      portfolio.holdings[existingIdx].qty = totalQty;
      portfolio.holdings[existingIdx].avgBuyPrice = parseFloat(newAvg.toFixed(4));
    } else {
      portfolio.holdings.push({
        symbol: normalizedSymbol,
        name: normalizedName,
        exchange: exchange ?? "NASDAQ",
        sector: sector ?? "Unknown",
        qty: qtyNum,
        avgBuyPrice: priceNum,
      });
    }

    portfolio.cashBalance = toMoney(portfolio.cashBalance - totalCost);

    portfolio.transactions.push({
      id: randomUUID(),
      type: "BUY",
      symbol: normalizedSymbol,
      name: normalizedName,
      qty: qtyNum,
      price: priceNum,
      amount: -toMoney(totalValue + fee),
      fee,
      status: "COMPLETED",
      timestamp: new Date(),
    });

  } else if (normalizedType === "SELL") {
    const holdingIdx = portfolio.holdings.findIndex(
      (h: any) => h.symbol === normalizedSymbol
    );

    if (holdingIdx < 0 || portfolio.holdings[holdingIdx].qty < qtyNum) {
      return NextResponse.json(
        { message: `Insufficient shares. You own ${holdingIdx >= 0 ? portfolio.holdings[holdingIdx].qty : 0} shares.` },
        { status: 400 }
      );
    }

    const proceeds = totalValue - fee;

    portfolio.holdings[holdingIdx].qty -= qtyNum;
    if (portfolio.holdings[holdingIdx].qty === 0) {
      portfolio.holdings.splice(holdingIdx, 1);
    }

    portfolio.cashBalance = toMoney(portfolio.cashBalance + proceeds);

    portfolio.transactions.push({
      id: randomUUID(),
      type: "SELL",
      symbol: normalizedSymbol,
      name: normalizedName,
      qty: qtyNum,
      price: priceNum,
      amount: toMoney(proceeds),
      fee,
      status: "COMPLETED",
      timestamp: new Date(),
    });

  } else {
    return NextResponse.json({ message: "Invalid order type" }, { status: 400 });
  }

  portfolio.markModified("holdings");
  portfolio.markModified("transactions");
  await portfolio.save();

  return NextResponse.json({
    message: `${normalizedType} order executed successfully`,
    cashBalance: portfolio.cashBalance,
    holdings: portfolio.holdings,
    transaction: portfolio.transactions[portfolio.transactions.length - 1],
  });
}
