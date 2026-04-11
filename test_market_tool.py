#!/usr/bin/env python
"""Quick test of the enhanced market_data tool."""

from src.trading_agent.tools.market_data import get_market_snapshot

# Test with AAPL using 3 months of data
data = get_market_snapshot(['AAPL'], period='3mo')

print("✓ Market Data Tool Test Results:")
print("=" * 50)

for symbol, snapshot in data.items():
    print(f"\n{symbol}:")
    
    # Current data
    current = snapshot['current']
    print(f"  Current Price: ${current['price']}")
    print(f"  Open: ${current['open']}, High: ${current['high']}, Low: ${current['low']}")
    
    # Historical data
    history = snapshot['history']
    print(f"  Historical: {len(history['dates'])} candles (from {history['dates'][0]} to {history['dates'][-1]})")
    print(f"    Latest Close: ${history['close'][-1]}")
    print(f"    Latest Volume: {history['volume'][-1]:,.0f}")
    
    # Statistics
    stats = snapshot['stats']
    print(f"  Statistics:")
    print(f"    52-Week High: ${stats['52_week_high']}")
    print(f"    52-Week Low: ${stats['52_week_low']}")
    print(f"    Volatility: {stats['volatility']:.2f}%")
    print(f"    Avg Volume: {stats['avg_volume']:,.0f}")
    
    # Data source
    print(f"  Data Source: {snapshot['data_source']}")

print("\n✓ Test Complete - All data structures working properly")
