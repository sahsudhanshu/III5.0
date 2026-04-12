"""
Graph Manager — orchestrates building the full Neo4j Stock Network graph.

Creates Company, Product, and News nodes with relationships based on
real stock data and computed metrics.
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cypher templates
# ---------------------------------------------------------------------------

_CREATE_COMPANY = """
MERGE (c:Company {ticker: $ticker})
SET c.name        = $name,
    c.sector      = $sector,
    c.industry    = $industry,
    c.market_cap  = $market_cap,
    c.country     = $country,
    c.website     = $website,
    c.description = $description,
    c.current_price     = $current_price,
    c.price_change_pct  = $price_change_pct,
    c.volatility        = $volatility,
    c.beta              = $beta,
    c.momentum          = $momentum
"""

_CREATE_PRODUCT = """
MERGE (p:Product {name: $name})
SET p.sector   = $sector,
    p.industry = $industry
"""

_COMPANY_PRODUCES = """
MATCH (c:Company {ticker: $ticker})
MATCH (p:Product {name: $product_name})
MERGE (c)-[:PRODUCES]->(p)
"""

_CREATE_NEWS = """
MERGE (n:News {title: $title})
SET n.url          = $url,
    n.date         = $date,
    n.source       = $source,
    n.snippet      = $snippet,
    n.search_query = $search_query
"""

_COMPANY_MENTIONED_IN = """
MATCH (c:Company {ticker: $ticker})
MATCH (n:News {title: $title})
MERGE (c)-[:MENTIONED_IN]->(n)
"""

_CORRELATED_WITH = """
MATCH (a:Company {ticker: $ticker_a})
MATCH (b:Company {ticker: $ticker_b})
MERGE (a)-[r:CORRELATED_WITH]-(b)
SET r.pearson   = $pearson,
    r.spearman  = $spearman,
    r.abs_avg   = $abs_avg,
    r.strength  = $strength,
    r.direction = $direction
"""

_SAME_SECTOR = """
MATCH (a:Company {ticker: $ticker_a})
MATCH (b:Company {ticker: $ticker_b})
MERGE (a)-[:SAME_SECTOR]-(b)
"""

_RELATED_PRODUCT = """
MATCH (p1:Product {name: $product_a})
MATCH (p2:Product {name: $product_b})
MERGE (p1)-[:RELATED_PRODUCT]-(p2)
"""

_NEWS_RELATED = """
MATCH (n1:News {title: $title_a})
MATCH (n2:News {title: $title_b})
MERGE (n1)-[:RELATED_NEWS]-(n2)
"""


# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------

def build_full_graph(
    tickers: List[str],
    period: str = "6mo",
    min_correlation: float = 0.25,
    max_news_per_company: int = 5,
    conn=None,
):
    """End-to-end pipeline: fetch data → compute metrics → populate Neo4j.

    Args:
        tickers:  list of stock ticker symbols
        period:   yfinance period string
        min_correlation:  threshold for CORRELATED_WITH edges
        max_news_per_company:  number of news articles to fetch per company
        conn:     optional Neo4jConnection (created if None)
    """
    # -- lazy imports so callers don't need everything installed to import this file
    from neo4j_connection import Neo4jConnection
    from stock_data import fetch_multi_stock_data, get_company_info, get_close_prices
    from news_fetcher import fetch_news_for_tickers
    from stock_analysis import (
        compute_log_returns,
        compute_correlation_pairs,
        compute_rolling_comovement,
        compute_volatility,
        compute_beta,
        compute_momentum,
        compute_current_prices,
        compute_price_change_pct,
    )

    own_conn = conn is None
    if own_conn:
        conn = Neo4jConnection()
        conn.connect()

    try:
        # 0  Prepare DB
        logger.info("🗑️  Clearing existing graph …")
        conn.clear_graph()
        conn.create_indexes()

        # 1  Fetch stock price data
        logger.info("📊 Fetching stock data …")
        raw_data = fetch_multi_stock_data(tickers, period=period)
        prices = get_close_prices(raw_data)

        # Add SPY as benchamrk for beta (if not already present)
        if "SPY" not in prices.columns:
            try:
                spy_data = fetch_multi_stock_data(["SPY"], period=period)
                spy_prices = get_close_prices(spy_data)
                prices = prices.join(spy_prices, how="inner")
            except Exception:
                logger.warning("Could not fetch SPY for beta computation")

        # 2  Compute analysis metrics
        logger.info("🔢 Computing metrics …")
        returns = compute_log_returns(prices)
        volatilities = compute_volatility(returns)
        betas = compute_beta(returns, benchmark="SPY")
        momenta = compute_momentum(prices)
        current_prices_map = compute_current_prices(prices)
        price_changes = compute_price_change_pct(prices)
        corr_pairs = compute_correlation_pairs(returns, min_abs_corr=min_correlation)
        comovement = compute_rolling_comovement(returns)

        # 3  Fetch company info
        logger.info("🏢 Fetching company metadata …")
        # Only real tickers, not SPY (unless user specified it)
        real_tickers = [t for t in tickers if t in prices.columns]
        company_info: Dict[str, dict] = {}
        for t in real_tickers:
            company_info[t] = get_company_info(t)

        # 4  Fetch news
        logger.info("📰 Fetching news from DuckDuckGo …")
        news_map = fetch_news_for_tickers(company_info, max_per_company=max_news_per_company, delay=0.8)

        # 5  Create Company nodes
        logger.info("🏗️  Creating Company nodes …")
        for t in real_tickers:
            info = company_info[t]
            params = {
                "ticker": t,
                "name": info.get("name", t),
                "sector": info.get("sector", "Unknown"),
                "industry": info.get("industry", "Unknown"),
                "market_cap": info.get("market_cap", 0),
                "country": info.get("country", ""),
                "website": info.get("website", ""),
                "description": info.get("description", ""),
                "current_price": current_prices_map.get(t, 0.0),
                "price_change_pct": price_changes.get(t, 0.0),
                "volatility": volatilities.get(t, 0.0),
                "beta": betas.get(t, 1.0),
                "momentum": momenta.get(t, 0.0),
            }
            conn.run_write(_CREATE_COMPANY, params)

        # 6  Create Product nodes (from sector / industry)
        logger.info("📦 Creating Product nodes …")
        products_created = set()
        for t in real_tickers:
            info = company_info[t]
            industry = info.get("industry", "Unknown")
            sector = info.get("sector", "Unknown")
            if industry and industry != "Unknown":
                product_name = industry
                if product_name not in products_created:
                    conn.run_write(_CREATE_PRODUCT, {
                        "name": product_name,
                        "sector": sector,
                        "industry": industry,
                    })
                    products_created.add(product_name)
                # link company → product
                conn.run_write(_COMPANY_PRODUCES, {
                    "ticker": t,
                    "product_name": product_name,
                })

        # 7  Create RELATED_PRODUCT edges (same sector → related products)
        products_by_sector: Dict[str, List[str]] = {}
        for pname in products_created:
            # get sector for this product from company_info
            for t in real_tickers:
                info = company_info[t]
                if info.get("industry") == pname:
                    sec = info.get("sector", "")
                    products_by_sector.setdefault(sec, []).append(pname)
                    break
        for sector, pnames in products_by_sector.items():
            unique_products = list(set(pnames))
            for i, pa in enumerate(unique_products):
                for pb in unique_products[i + 1:]:
                    conn.run_write(_RELATED_PRODUCT, {"product_a": pa, "product_b": pb})

        # 8  Create News nodes + MENTIONED_IN edges
        logger.info("📰 Creating News nodes …")
        all_news_titles_per_ticker: Dict[str, List[str]] = {}
        for t, articles in news_map.items():
            titles = []
            for art in articles:
                if not art.get("title"):
                    continue
                conn.run_write(_CREATE_NEWS, {
                    "title": art["title"],
                    "url": art.get("url", ""),
                    "date": art.get("date", ""),
                    "source": art.get("source", ""),
                    "snippet": art.get("snippet", ""),
                    "search_query": art.get("search_query", ""),
                })
                conn.run_write(_COMPANY_MENTIONED_IN, {
                    "ticker": t,
                    "title": art["title"],
                })
                titles.append(art["title"])
            all_news_titles_per_ticker[t] = titles

        # RELATED_NEWS: news items sharing companies
        _create_related_news(conn, all_news_titles_per_ticker)

        # 9  CORRELATED_WITH edges
        logger.info("🔗 Creating CORRELATED_WITH edges …")
        for pair in corr_pairs:
            a, b = pair["ticker_a"], pair["ticker_b"]
            if a not in real_tickers or b not in real_tickers:
                continue
            conn.run_write(_CORRELATED_WITH, {
                "ticker_a": a,
                "ticker_b": b,
                "pearson": pair["pearson"],
                "spearman": pair["spearman"],
                "abs_avg": pair["abs_avg"],
                "strength": pair["strength"],
                "direction": pair["direction"],
            })

        # 10  SAME_SECTOR edges
        logger.info("🏷️  Creating SAME_SECTOR edges …")
        sector_groups: Dict[str, List[str]] = {}
        for t in real_tickers:
            sec = company_info[t].get("sector", "Unknown")
            sector_groups.setdefault(sec, []).append(t)
        for sec, group in sector_groups.items():
            if sec == "Unknown":
                continue
            for i, a in enumerate(group):
                for b in group[i + 1:]:
                    conn.run_write(_SAME_SECTOR, {"ticker_a": a, "ticker_b": b})

        # Done
        stats = conn.get_stats()
        logger.info(f"✅ Graph built! {stats}")
        return stats

    finally:
        if own_conn:
            conn.close()


def _create_related_news(conn, titles_per_ticker: Dict[str, List[str]]):
    """Create RELATED_NEWS edges between news items that share a company connection."""
    all_titles = set()
    for titles in titles_per_ticker.values():
        all_titles.update(titles)

    # Group titles that appear with same company
    # If two tickers share overlapping news titles, those news are related
    tickers = list(titles_per_ticker.keys())
    for i, ta in enumerate(tickers):
        for tb in tickers[i + 1:]:
            shared = set(titles_per_ticker[ta]) & set(titles_per_ticker[tb])
            # Even without overlap: link news from co-correlated companies
            for tit_a in titles_per_ticker[ta]:
                for tit_b in titles_per_ticker[tb]:
                    if tit_a != tit_b and (tit_a in shared or tit_b in shared):
                        conn.run_write(_NEWS_RELATED, {"title_a": tit_a, "title_b": tit_b})
