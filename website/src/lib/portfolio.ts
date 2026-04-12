import Portfolio from "@/lib/models/portfolio";

export const DEFAULT_STARTING_CASH = 0;

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function toMoney(value: number): number {
  return parseFloat(value.toFixed(2));
}

export async function getOrCreatePortfolio(userId: string) {
  let portfolio = await Portfolio.findOne({ userId });
  if (!portfolio) {
    portfolio = await Portfolio.create({
      userId,
      cashBalance: DEFAULT_STARTING_CASH,
      holdings: [],
      transactions: [],
    });
  } else {
    // Backward-compat cleanup: older builds seeded cash without any user activity.
    if ((portfolio.holdings?.length ?? 0) === 0 && (portfolio.transactions?.length ?? 0) === 0) {
      portfolio.cashBalance = DEFAULT_STARTING_CASH;
      await portfolio.save();
    }
  }
  return portfolio;
}
