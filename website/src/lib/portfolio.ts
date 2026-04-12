import Portfolio from "@/lib/models/portfolio";

export const DEFAULT_STARTING_CASH = 10000;

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
  }
  return portfolio;
}
