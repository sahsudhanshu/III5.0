#!/usr/bin/env python
"""Test market_data with multiple symbols and periods."""

from src.trading_agent.tools.market_data import get_market_snapshot

print("Testing Market Data Tool - Multiple Symbols & Periods")
print("=" * 60)

# Test different periods
for period in ['1mo', '3mo', '1y']:
    print(f"\n📊 Testing period: {period}")
    data = get_market_snapshot(['AAPL', 'MSFT'], period=period)
    
    for symbol in ['AAPL', 'MSFT']:
        candles = len(data[symbol]['history']['dates'])
        source = data[symbol]['data_source']
        price = data[symbol]['current']['price']
        print(f"  {symbol}: ${price} | {candles} candles | source={source}")

print("\n✓ All tests passed!")
