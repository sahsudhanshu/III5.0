from __future__ import annotations

from live_portfolio_manager import AILivePortfolioManager


def main() -> int:
    agent = AILivePortfolioManager()

    # Current holdings state (prices + sentiments are fetched live)
    live_cash = 15000.00
    live_quantities = [10, 5, 20, 0, 5, 2, 1, 0, 0, 50]

    print("\n📡 Analyzing Live Market Data (prices + news sentiment)...")
    orders, total_worth, live_prices, live_sentiments = agent.calculate_trades_from_live_data(
        live_cash,
        live_quantities,
        sentiment_source="gnews",
        headlines_per_ticker=5,
    )

    print(f"\n💼 TOTAL PORTFOLIO NET WORTH: ${total_worth:,.2f}")
    print("LIVE PRICES:", live_prices)
    print("LIVE SENTIMENTS:", live_sentiments)
    print("=" * 72)
    print(f"{'TICKER':<8} | {'ACTION':<6} | {'SHARES TO TRADE':<16} | {'NEW TARGET %'}")
    print("-" * 72)
    for ticker, data in orders.items():
        print(
            f"{ticker:<8} | {data['action']:<6} | {data['shares_to_trade']:<16} | {data['target_weight_pct']:.2f}%"
        )
    print("=" * 72)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
