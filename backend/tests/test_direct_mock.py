#!/usr/bin/env python3
"""Direct test of data_fetch mock fallback."""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT / "stock_network"))

# Test direct import
if 'data_fetch' in sys.modules:
    del sys.modules['data_fetch']

import data_fetch

print("\n" + "=" * 60)
print("DIRECT MOCK DATA TEST")
print("=" * 60)

# Test 1: Mock data function
print("\n1. Testing _get_mock_data()...")
df = data_fetch._get_mock_data('AAPL', '1mo')
print(f"   ✓ Generated {len(df)} rows")

# Test 2: Full fetch with mocks
print("\n2. Testing fetch_stock_data()...")
try:
    data = data_fetch.fetch_stock_data(['AAPL', 'MSFT'], period='1mo')
    for ticker in data:
        print(f"   ✓ {ticker}: {len(data[ticker])} rows")
except Exception as e:
    print(f"   ✗ Error: {e}")

print("\n" + "=" * 60)
