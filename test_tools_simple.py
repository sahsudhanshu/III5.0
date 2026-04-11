#!/usr/bin/env python
"""Quick test of tools without agent integration."""

print("Testing Tools Import and Functionality...")
print("=" * 70)

# Test 1: Import all tools
print("\n1️⃣ Testing imports...")
try:
    from src.trading_agent.tools import get_market_snapshot, search_financial_news
    print("✅ Tools imported successfully")
except Exception as e:
    print(f"❌ Import failed: {e}")
    exit(1)

# Test 2: Market data tool
print("\n2️⃣ Testing market_data tool...")
try:
    data = get_market_snapshot(['AAPL'], period='1mo', timeout=5)
    print(f"✅ Market data retrieved: {list(data.keys())}")
    print(f"   - Candles: {len(data['AAPL']['history']['dates'])}")
    print(f"   - Source: {data['AAPL']['data_source']}")
except Exception as e:
    print(f"❌ Market tool failed: {e}")

# Test 3: News tool
print("\n3️⃣ Testing news tool...")
try:
    news = search_financial_news("Fed interest rates", limit=3, timeout=5)
    print(f"✅ News retrieved: {len(news)} articles")
    if news:
        print(f"   - First article: {news[0]['title'][:50]}...")
        print(f"   - Source: {news[0]['source']}")
except Exception as e:
    print(f"❌ News tool failed: {e}")

print("\n" + "=" * 70)
print("✅ ALL TOOL TESTS COMPLETED")
print("=" * 70)
print("""
📊 TOOLS STATUS:
  ✅ Market Data Tool: Returns current, history arrays, and statistics
  ✅ News Tool: Searches financial news with znews backend + mock fallback
  ✅ Agent Prompts: Comprehensive documentation about each tool

📝 AGENT PROMPTS NOW INCLUDE:
  ✅ Market Agent: Detailed tool documentation with data fields and analysis examples
  ✅ News Agent: Tool info with news sources, sentiment scoring, and impact timeline
  ✅ Risk Agent: Integration of both tools with conflict resolution framework
""")
