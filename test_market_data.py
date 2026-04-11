#!/usr/bin/env python
"""Test market data tool."""

import os
os.environ['NVIDIA_API_KEY'] = 'test'
os.environ['TAVILY_API_KEY'] = 'test'

from src.trading_agent.tools import get_market_snapshot

print("Testing get_market_snapshot tool...\n")

# Test with AAPL and 1 year period
result = get_market_snapshot.invoke({
    'symbols': ['AAPL'],
    'period': '1y'
})

# Print first 1500 characters
lines = result.split('\n')
print('\n'.join(lines[:30]))
print("\n... (output truncated)")
print(f"\nTotal output length: {len(result)} characters")
print("✓ Tool executed successfully!")
