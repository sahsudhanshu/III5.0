#!/usr/bin/env python3
"""Test yfinance with timeout and fallback."""

import sys
sys.path.insert(0, 'src')

import time
from trading_agent.tools.market_data import get_market_snapshot
from trading_agent.config import get_proxy_dict

print("=" * 60)
print("YFINANCE TEST WITH PROXY & TIMEOUT")
print("=" * 60)

# Check proxy status
proxy = get_proxy_dict()
if proxy:
    print(f"\n✓ Proxy ENABLED: {proxy['http']}")
else:
    print(f"\n✓ Proxy DISABLED")

# Test market data fetch
print("\nFetching market data...")
start = time.time()
data = get_market_snapshot(['AAPL', 'MSFT', 'GOOGL'], timeout=3)
elapsed = time.time() - start

print(f"\n✓ Completed in {elapsed:.1f}s with {len(data)} symbols")
print(f"\nMarket Data:")
for symbol in ['AAPL', 'MSFT', 'GOOGL']:
    price = data[symbol]['price']
    volume = data[symbol]['volume']
    print(f"  {symbol}: ${price} | Volume: {volume:,.0f}")

print("\n" + "=" * 60)
print("✓ TEST COMPLETE")
print("=" * 60)
