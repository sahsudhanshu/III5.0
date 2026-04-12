from __future__ import annotations

from live_portfolio_manager import AILivePortfolioManager


def main() -> int:
    agent = AILivePortfolioManager()

    # Mock live data
    live_cash = 15000.00
    live_prices = [170.5, 410.2, 140.0, 180.5, 175.0, 500.0, 880.0, 400.0, 275.0, 60.0]
    live_quantities = [10, 5, 20, 0, 5, 2, 1, 0, 0, 50]
    live_sentiments = [0.1, 0.2, 0.0, 0.5, -0.9, 0.1, 0.85, 0.0, 0.1, -0.2]

    print("\n📡 Analyzing Live Market Data...")
    orders, total_worth = agent.calculate_trades(
        live_cash,
        live_prices,
        live_quantities,
        live_sentiments,
    )

    print(f"\n💼 TOTAL PORTFOLIO NET WORTH: ${total_worth:,.2f}")
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
