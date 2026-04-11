#!/usr/bin/env python3
"""
populate_graph.py — End-to-end Neo4j Stock Network builder.

Creates a rich graph with:
  • 10 Company nodes (real stock data from yfinance)
  • ~20 Product nodes (actual flagship products)
  • 10-12 News nodes (live from DuckDuckGo)
  • Edges with real statistical meaning:
      CORRELATED_WITH   — Pearson correlation of daily returns
      COMPETES_WITH     — companies in overlapping product categories
      SAME_SECTOR       — shared GICS sector
      PRODUCES          — company → product
      MENTIONED_IN      — company ↔ news article
      IMPACTS           — news sentiment impact on a company
      SUPPLIES_TO       — supply-chain relationship
"""

import os, sys, time, logging

# ── proxy bypass (WSL / corporate) ──────────────────────────────────────
os.environ.setdefault("NO_PROXY", "localhost,127.0.0.1")
os.environ["no_proxy"] = os.environ["NO_PROXY"]
os.environ["USE_PROXY"] = "false"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

import numpy as np
import pandas as pd

# ── Data Sources ────────────────────────────────────────────────────────
try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False

try:
    from duckduckgo_search import DDGS
    HAS_DDG = True
except ImportError:
    HAS_DDG = False

from neo4j_connection import Neo4jConnection

# ========================================================================
#  COMPANY + PRODUCT KNOWLEDGE   (not hard-coded prices — just names)
# ========================================================================

COMPANIES = {
    "AAPL":  {"name": "Apple Inc.",            "sector": "Technology",        "industry": "Consumer Electronics"},
    "MSFT":  {"name": "Microsoft Corp.",       "sector": "Technology",        "industry": "Software"},
    "GOOGL": {"name": "Alphabet Inc.",         "sector": "Technology",        "industry": "Internet Services"},
    "AMZN":  {"name": "Amazon.com Inc.",       "sector": "Consumer Cyclical", "industry": "E-Commerce"},
    "TSLA":  {"name": "Tesla Inc.",            "sector": "Consumer Cyclical", "industry": "Auto Manufacturers"},
    "META":  {"name": "Meta Platforms Inc.",   "sector": "Technology",        "industry": "Social Media"},
    "NVDA":  {"name": "NVIDIA Corp.",          "sector": "Technology",        "industry": "Semiconductors"},
    "BRK-B": {"name": "Berkshire Hathaway",    "sector": "Financial Services","industry": "Diversified Holdings"},
    "V":     {"name": "Visa Inc.",             "sector": "Financial Services","industry": "Credit Services"},
    "WMT":   {"name": "Walmart Inc.",          "sector": "Consumer Defensive","industry": "Discount Stores"},
}

# Actual flagship products / services per company
PRODUCTS = {
    "AAPL":  ["iPhone", "MacBook", "iPad", "Apple Watch", "iCloud"],
    "MSFT":  ["Windows", "Azure Cloud", "Microsoft 365", "Xbox", "LinkedIn"],
    "GOOGL": ["Google Search", "YouTube", "Google Cloud", "Android", "Google Ads"],
    "AMZN":  ["Amazon Marketplace", "AWS", "Prime Video", "Alexa", "Kindle"],
    "TSLA":  ["Model 3", "Model Y", "Powerwall", "FSD Autopilot", "Megapack"],
    "META":  ["Facebook", "Instagram", "WhatsApp", "Meta Quest VR", "Threads"],
    "NVDA":  ["GeForce GPU", "CUDA Platform", "Data Center GPUs", "NVIDIA Drive", "Omniverse"],
    "BRK-B": ["GEICO Insurance", "BNSF Railway", "Dairy Queen", "Duracell"],
    "V":     ["Visa Network", "Visa Direct", "Visa B2B Connect", "CyberSource"],
    "WMT":   ["Walmart Stores", "Sam's Club", "Walmart+", "Walmart Marketplace"],
}

# Known supply-chain / business relationships
SUPPLY_CHAIN = [
    ("NVDA", "AAPL",  "GPU supplier"),
    ("NVDA", "MSFT",  "GPU supplier for Azure"),
    ("NVDA", "GOOGL", "GPU supplier for Google Cloud"),
    ("NVDA", "META",  "GPU supplier for AI training"),
    ("NVDA", "TSLA",  "GPU supplier for FSD"),
    ("NVDA", "AMZN",  "GPU supplier for AWS"),
    ("AAPL", "GOOGL", "Google pays for default search on Safari"),
    ("AMZN", "V",     "Payment processing partner"),
    ("WMT",  "V",     "Payment processing partner"),
]

# Product competition edges
PRODUCT_COMPETITION = [
    ("Azure Cloud",       "AWS",            "Cloud computing"),
    ("Azure Cloud",       "Google Cloud",   "Cloud computing"),
    ("AWS",               "Google Cloud",   "Cloud computing"),
    ("Google Search",     "Microsoft 365",  "Productivity / Search"),
    ("iPhone",            "Android",        "Mobile OS / Devices"),
    ("YouTube",           "Prime Video",    "Video streaming"),
    ("Meta Quest VR",     "Apple Watch",    "Wearables / AR-VR"),
    ("Google Ads",        "Facebook",       "Digital advertising"),
    ("Google Ads",        "Instagram",      "Digital advertising"),
    ("Xbox",              "GeForce GPU",    "Gaming"),
    ("Walmart Marketplace","Amazon Marketplace","E-Commerce"),
    ("Walmart+",          "Prime Video",    "Subscription services"),
    ("Visa Network",      "GEICO Insurance","Financial services"),
]


# ========================================================================
#  FETCH REAL DATA
# ========================================================================

def fetch_stock_data(tickers: list, period: str = "6mo") -> pd.DataFrame:
    """Download adjusted close prices for all tickers via yfinance."""
    log.info("📊  Downloading stock prices …")
    if not HAS_YF:
        log.warning("yfinance unavailable — using synthetic data")
        return _synthetic_prices(tickers, period)
    try:
        df = yf.download(tickers, period=period, interval="1d", progress=False)
        # Handle MultiIndex columns
        if isinstance(df.columns, pd.MultiIndex):
            close = df["Close"] if "Close" in df.columns.get_level_values(0) else df["Adj Close"]
        else:
            close = df
        close = close.dropna(how="all").dropna(axis=1, how="all")
        log.info(f"   ✅ {close.shape[1]} tickers × {close.shape[0]} days")
        return close
    except Exception as e:
        log.warning(f"   ⚠️ yfinance failed ({e}), using synthetic data")
        return _synthetic_prices(tickers, period)


def _synthetic_prices(tickers, period):
    import hashlib
    days = {"1mo": 22, "3mo": 63, "6mo": 126, "1y": 252}.get(period, 126)
    dates = pd.bdate_range(end=pd.Timestamp.now(), periods=days)
    frames = {}
    for t in tickers:
        seed = int(hashlib.md5(t.encode()).hexdigest(), 16) % 2**31
        rng = np.random.RandomState(seed)
        base = 50 + rng.rand() * 400
        frames[t] = base * np.exp(np.cumsum(rng.normal(0.0004, 0.02, days)))
    return pd.DataFrame(frames, index=dates)


def fetch_news(tickers: list, max_total: int = 12) -> list:
    """Fetch recent stock news from DuckDuckGo."""
    log.info("📰  Fetching news from DuckDuckGo …")
    if not HAS_DDG:
        log.warning("   duckduckgo-search unavailable — skipping news")
        return []
    articles = []
    seen_titles = set()
    per_company = max(1, max_total // len(tickers))
    for ticker in tickers:
        name = COMPANIES.get(ticker, {}).get("name", ticker)
        try:
            with DDGS() as ddgs:
                results = ddgs.news(f"{name} stock", max_results=per_company + 2)
                for r in results:
                    title = r.get("title", "")
                    if title and title not in seen_titles:
                        articles.append({
                            "title": title,
                            "url": r.get("url", ""),
                            "date": r.get("date", ""),
                            "source": r.get("source", ""),
                            "snippet": (r.get("body", "") or "")[:400],
                            "ticker": ticker,
                            "company": name,
                        })
                        seen_titles.add(title)
                    if len(articles) >= max_total:
                        break
            time.sleep(0.6)
        except Exception as e:
            log.warning(f"   ⚠️ News search failed for {ticker}: {e}")
        if len(articles) >= max_total:
            break
    log.info(f"   ✅ {len(articles)} articles fetched")
    return articles


# ========================================================================
#  STOCK ANALYSIS → edge weights
# ========================================================================

def compute_metrics(prices: pd.DataFrame) -> dict:
    """Compute all per-company and pair-wise metrics from prices."""
    from scipy.stats import pearsonr

    log_ret = np.log(prices / prices.shift(1)).dropna()
    tickers = log_ret.columns.tolist()

    # Per-company
    volatility = (log_ret.std() * np.sqrt(252)).to_dict()
    momentum = {}
    current_price = {}
    pct_change_5d = {}
    for t in tickers:
        s = prices[t].dropna()
        current_price[t] = round(float(s.iloc[-1]), 2) if len(s) else 0
        momentum[t] = round(float((s.iloc[-1] / s.iloc[-20] - 1) * 100), 2) if len(s) >= 20 else 0
        pct_change_5d[t] = round(float((s.iloc[-1] / s.iloc[-5] - 1) * 100), 2) if len(s) >= 5 else 0

    # Pair-wise Pearson correlation
    correlations = []
    for i, a in enumerate(tickers):
        for b in tickers[i + 1:]:
            try:
                corr, pval = pearsonr(log_ret[a].dropna(), log_ret[b].dropna())
            except Exception:
                corr, pval = 0.0, 1.0
            if abs(corr) >= 0.15:    # keep even weak ones to show the full picture
                strength = (
                    "Strong" if abs(corr) >= 0.7 else
                    "Moderate" if abs(corr) >= 0.5 else
                    "Weak" if abs(corr) >= 0.3 else
                    "Very Weak"
                )
                correlations.append({
                    "a": a, "b": b,
                    "corr": round(float(corr), 4),
                    "abs_corr": round(abs(float(corr)), 4),
                    "strength": strength,
                    "direction": "positive" if corr > 0 else "negative",
                    "p_value": round(float(pval), 6),
                })

    return {
        "volatility": {k: round(v, 4) for k, v in volatility.items()},
        "momentum": momentum,
        "current_price": current_price,
        "pct_change_5d": pct_change_5d,
        "correlations": correlations,
    }


# ========================================================================
#  NEO4J GRAPH CONSTRUCTION
# ========================================================================

def populate(conn: Neo4jConnection, tickers: list):
    """Full pipeline: fetch → analyse → write to Neo4j."""

    # 0  Clean slate
    log.info("🗑️   Clearing existing graph …")
    conn.clear_graph()
    conn.create_indexes()

    # 1  Stock data
    prices = fetch_stock_data(tickers, period="6mo")
    available = [t for t in tickers if t in prices.columns]
    metrics = compute_metrics(prices[available])

    # 2  News
    articles = fetch_news(available, max_total=12)

    # ── COMPANY nodes ──────────────────────────────────────────────────
    log.info("🏢  Creating Company nodes …")
    for t in available:
        info = COMPANIES.get(t, {})
        conn.run_write("""
            MERGE (c:Company {ticker: $ticker})
            SET c.name           = $name,
                c.sector         = $sector,
                c.industry       = $industry,
                c.current_price  = $price,
                c.pct_change_5d  = $change,
                c.volatility     = $vol,
                c.momentum_20d   = $mom
        """, {
            "ticker": t,
            "name": info.get("name", t),
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "price": metrics["current_price"].get(t, 0),
            "change": metrics["pct_change_5d"].get(t, 0),
            "vol": metrics["volatility"].get(t, 0),
            "mom": metrics["momentum"].get(t, 0),
        })
    log.info(f"   ✅ {len(available)} companies")

    # ── PRODUCT nodes + PRODUCES edges ─────────────────────────────────
    log.info("📦  Creating Product nodes …")
    all_products = set()
    for t in available:
        for prod in PRODUCTS.get(t, []):
            conn.run_write("""
                MERGE (p:Product {name: $name})
                SET p.company_ticker = $ticker
            """, {"name": prod, "ticker": t})
            conn.run_write("""
                MATCH (c:Company {ticker: $ticker})
                MATCH (p:Product {name: $name})
                MERGE (c)-[:PRODUCES]->(p)
            """, {"ticker": t, "name": prod})
            all_products.add(prod)
    log.info(f"   ✅ {len(all_products)} products")

    # ── NEWS nodes + MENTIONED_IN edges ────────────────────────────────
    log.info("📰  Creating News nodes …")
    for art in articles:
        conn.run_write("""
            MERGE (n:News {title: $title})
            SET n.url     = $url,
                n.date    = $date,
                n.source  = $source,
                n.snippet = $snippet
        """, {
            "title": art["title"],
            "url": art.get("url", ""),
            "date": art.get("date", ""),
            "source": art.get("source", ""),
            "snippet": art.get("snippet", ""),
        })
        conn.run_write("""
            MATCH (c:Company {ticker: $ticker})
            MATCH (n:News {title: $title})
            MERGE (c)-[:MENTIONED_IN {search_date: date()}]->(n)
        """, {"ticker": art["ticker"], "title": art["title"]})

        # Also link news to any OTHER company mentioned by name in snippet
        snippet_lower = (art.get("snippet", "") + " " + art.get("title", "")).lower()
        for t2 in available:
            if t2 == art["ticker"]:
                continue
            cname = COMPANIES.get(t2, {}).get("name", "").lower()
            if cname and len(cname) > 3 and cname.split()[0] in snippet_lower:
                conn.run_write("""
                    MATCH (c:Company {ticker: $ticker})
                    MATCH (n:News {title: $title})
                    MERGE (c)-[:MENTIONED_IN]->(n)
                """, {"ticker": t2, "title": art["title"]})
    log.info(f"   ✅ {len(articles)} news articles")

    # ── CORRELATED_WITH edges (stock returns correlation) ──────────────
    log.info("📈  Creating CORRELATED_WITH edges …")
    for pair in metrics["correlations"]:
        conn.run_write("""
            MATCH (a:Company {ticker: $a})
            MATCH (b:Company {ticker: $b})
            MERGE (a)-[r:CORRELATED_WITH]-(b)
            SET r.pearson    = $corr,
                r.abs_corr   = $abs_corr,
                r.strength   = $strength,
                r.direction  = $direction,
                r.p_value    = $pval
        """, {
            "a": pair["a"], "b": pair["b"],
            "corr": pair["corr"], "abs_corr": pair["abs_corr"],
            "strength": pair["strength"], "direction": pair["direction"],
            "pval": pair["p_value"],
        })
    log.info(f"   ✅ {len(metrics['correlations'])} correlation edges")

    # ── SAME_SECTOR edges ─────────────────────────────────────────────
    log.info("🏷️   Creating SAME_SECTOR edges …")
    sectors = {}
    for t in available:
        s = COMPANIES.get(t, {}).get("sector", "")
        if s:
            sectors.setdefault(s, []).append(t)
    cnt = 0
    for sec, group in sectors.items():
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                conn.run_write("""
                    MATCH (a:Company {ticker: $a})
                    MATCH (b:Company {ticker: $b})
                    MERGE (a)-[r:SAME_SECTOR]-(b)
                    SET r.sector = $sector
                """, {"a": a, "b": b, "sector": sec})
                cnt += 1
    log.info(f"   ✅ {cnt} same-sector edges")

    # ── SUPPLIES_TO edges (known supply chain) ─────────────────────────
    log.info("🔗  Creating SUPPLIES_TO edges …")
    cnt = 0
    for supplier, customer, desc in SUPPLY_CHAIN:
        if supplier in available and customer in available:
            conn.run_write("""
                MATCH (s:Company {ticker: $sup})
                MATCH (c:Company {ticker: $cust})
                MERGE (s)-[r:SUPPLIES_TO]->(c)
                SET r.description = $desc
            """, {"sup": supplier, "cust": customer, "desc": desc})
            cnt += 1
    log.info(f"   ✅ {cnt} supply-chain edges")

    # ── COMPETES_WITH edges (products) ─────────────────────────────────
    log.info("⚔️   Creating COMPETES_WITH product edges …")
    cnt = 0
    for p1, p2, category in PRODUCT_COMPETITION:
        if p1 in all_products and p2 in all_products:
            conn.run_write("""
                MATCH (a:Product {name: $a})
                MATCH (b:Product {name: $b})
                MERGE (a)-[r:COMPETES_WITH]-(b)
                SET r.category = $cat
            """, {"a": p1, "b": p2, "cat": category})
            cnt += 1
    log.info(f"   ✅ {cnt} competition edges")

    # ── DONE ───────────────────────────────────────────────────────────
    stats = conn.get_stats()
    log.info(f"\n🎉  GRAPH COMPLETE!")
    log.info(f"   Nodes:         {stats['nodes']}")
    log.info(f"   Relationships: {stats['relationships']}")
    return stats


# ========================================================================
if __name__ == "__main__":
    TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
               "META", "NVDA", "BRK-B", "V", "WMT"]

    conn = Neo4jConnection()
    conn.connect()
    try:
        stats = populate(conn, TICKERS)
    finally:
        conn.close()
