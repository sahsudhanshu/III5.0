#!/usr/bin/env python3
"""
Quick test of the 3-node simplified pipeline.
Tests: market data API, news search, and risk assessment.
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from src.trading_agent.graph import build_graph
from src.trading_agent.tools.market_data import get_market_snapshot
from src.trading_agent.tools.web_search import search_financial_news

print("\n" + "="*70)
print("🧪 TESTING SIMPLIFIED 3-NODE PIPELINE")
print("="*70)

# Test 1: Market Data
print("\n1️⃣  TEST MARKET DATA")
print("-" * 70)
try:
    market = get_market_snapshot(["AAPL", "MSFT", "GOOGL"])
    print(f"✓ Got data for {len(market)} symbols")
    for sym, data in list(market.items())[:2]:
        print(f"   {sym}: ${data['price']:.2f} (change: {data['change_pct']:+.2f}%)")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 2: News Search
print("\n2️⃣  TEST NEWS SEARCH")
print("-" * 70)
try:
    news = search_financial_news("tech stocks", limit=3)
    print(f"✓ Got {len(news)} news articles")
    for article in news[:2]:
        print(f"   • {article['title'][:50]}... ({article['source']})")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 3: Build Graph
print("\n3️⃣  TEST GRAPH COMPILATION")
print("-" * 70)
try:
    app = build_graph()
    print("✓ Graph compiled successfully")
    print("   Nodes: fetch_data → market + news → risk → END")
except Exception as e:
    print(f"✗ Error: {e}")

# Test 4: Run a query
print("\n4️⃣  TEST FULL PIPELINE")
print("-" * 70)
try:
    initial_state = {
        "query": "Should I invest in tech stocks?",
        "symbols": ["AAPL", "MSFT"],
        "market_context": {},
        "news_context": [],
        "agent_outputs": {},
        "debate_log": [],
        "votes": {},
        "final_decision": {},
        "short_term_memory": [],
        "long_term_memory": [],
        "long_term_refs": [],
    }
    
    print("Running query: 'Should I invest in tech stocks?'")
    print("Symbols: AAPL, MSFT")
    print("⏳ Processing...")
    
    result = app.invoke(initial_state)
    
    print(f"✓ Pipeline executed successfully")
    print(f"   Agents: {list(result['agent_outputs'].keys())}")
    
    if "risk" in result["agent_outputs"]:
        risk = result["agent_outputs"]["risk"]
        print(f"   Risk Level: {risk.get('risk_level', 'N/A')}")
        print(f"   Recommendation: {risk.get('recommendation', 'N/A')}")
        print(f"   Confidence: {risk.get('confidence', 'N/A')}")
        
except Exception as e:
    print(f"✗ Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*70)
print("✅ SIMPLIFIED PIPELINE TEST COMPLETE")
print("="*70)
print("\n📝 Node Architecture:")
print("""
    START
      ↓
  fetch_data (Market APIs + Web Search)
    ↙       ↘
  market   news
    ↖       ↗
     risk (final decision)
      ↓
    END
""")
print("✨ Ready to run: python main.py\n")
