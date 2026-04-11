#!/usr/bin/env python3
"""Test stock_network data_fetch with fixed yfinance timeout."""

import importlib
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT / "stock_network"))

# Force reload
if 'data_fetch' in sys.modules:
    del sys.modules['data_fetch']

import time
from data_fetch import fetch_stock_data

print("=" * 60)
print("STOCK NETWORK DATA FETCH TEST")
print("=" * 60)

tickers = ['AAPL', 'MSFT', 'GOOGL']
print(f"\nFetching {len(tickers)} stocks (3 months data)...")

start = time.time()
try:
    data = fetch_stock_data(tickers, period='3mo')
    elapsed = time.time() - start
    
    print(f"\n✓ Completed in {elapsed:.1f}s")
    print(f"\nData Retrieved:")
    for ticker in tickers:
        if ticker in data:
            days = len(data[ticker])
            print(f"  {ticker}: {days} trading days")
        else:
            print(f"  {ticker}: ❌ No data")
            
except Exception as e:
    elapsed = time.time() - start
    print(f"\n✗ Failed after {elapsed:.1f}s")
    print(f"Error: {e}")

print("\n" + "=" * 60)
