"""
Graph Manager — orchestrates building the full Neo4j Stock Network graph.

Creates Company, Product, and News nodes with relationships based on
real stock data and computed metrics.
"""

import logging
from typing import Dict, List, Optional

import pandas as pd

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
    c.momentum          = $momentum,
    c.sma_50            = $sma_50,
    c.sma_200           = $sma_200,
    c.ema_20            = $ema_20,
    c.rsi               = $rsi,
    c.macd              = $macd,
    c.macd_signal       = $macd_signal,
    c.bb_upper          = $bb_upper,
    c.bb_lower          = $bb_lower,
    c.vol_latest        = $vol_latest,
    c.vol_ma_20         = $vol_ma_20
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
    n.search_query = $search_query,
    n.sentiment    = $sentiment
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

_RELATED_TO = """
MATCH (a:Company {ticker: $ticker_a})
MATCH (b:Company {ticker: $ticker_b})
MERGE (a)-[r:RELATED_TO]-(b)
SET r.strength = $strength,
    r.reason   = $reason
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

    New tickers are ADDED to the existing graph (not replaced).
    Cross-correlations and sector edges are computed between new and
    existing tickers so the graph stays fully connected.

    Args:
        tickers:  list of stock ticker symbols to add
        period:   yfinance period string
        min_correlation:  threshold for CORRELATED_WITH edges
        max_news_per_company:  number of news articles to fetch per company
        conn:     optional Neo4jConnection (created if None)
    """
    # -- lazy imports so callers don't need everything installed to import this file
    from neo4j_connection import Neo4jConnection
    from stock_data import fetch_multi_stock_data, get_company_info, get_close_prices, get_volumes
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
        compute_technical_indicators,
        compute_volume_metrics,
        build_trend_similarity_scores
    )

    own_conn = conn is None
    if own_conn:
        conn = Neo4jConnection()
        conn.connect()

    try:
        # 0  Ensure indexes exist (idempotent — safe to call every time)
        conn.create_indexes()

        # 0b  Discover tickers already in the graph
        existing_rows = conn.run_query(
            "MATCH (c:Company) RETURN c.ticker AS ticker"
        )
        existing_tickers: List[str] = [
            r["ticker"] for r in existing_rows if r.get("ticker")
        ]
        new_tickers = [t.upper() for t in tickers]

        # all_tickers = union of existing + new (for cross-correlation)
        all_tickers = list(dict.fromkeys(existing_tickers + new_tickers))
        logger.info(
            f"Existing tickers in graph: {existing_tickers} | "
            f"New tickers to add: {new_tickers} | "
            f"Full set for analysis: {all_tickers}"
        )

        # 1  Fetch stock price data for ALL tickers (existing + new)
        logger.info("📊 Fetching stock data …")
        raw_data = fetch_multi_stock_data(all_tickers, period=period)
        prices = get_close_prices(raw_data)
        volumes = get_volumes(raw_data)

        # Add SPY as benchmark for beta (if not already present)
        if "SPY" not in prices.columns:
            try:
                spy_data = fetch_multi_stock_data(["SPY"], period=period)
                spy_prices = get_close_prices(spy_data)
                prices = prices.join(spy_prices, how="inner")
            except Exception:
                logger.warning("Could not fetch SPY for beta computation")

        # 2  Compute analysis metrics across ALL tickers
        logger.info("🔢 Computing metrics …")
        returns = compute_log_returns(prices)
        volatilities = compute_volatility(returns)
        betas = compute_beta(returns, benchmark="SPY")
        momenta = compute_momentum(prices)
        current_prices_map = compute_current_prices(prices)
        price_changes = compute_price_change_pct(prices)
        corr_pairs = compute_correlation_pairs(returns, min_abs_corr=min_correlation)
        comovement = compute_rolling_comovement(returns)
        tech_inds = compute_technical_indicators(prices)
        vol_metrics = compute_volume_metrics(volumes)
        trend_similarity = build_trend_similarity_scores(tech_inds)

        # 3  Fetch company info — only for NEW tickers
        logger.info("🏢 Fetching company metadata …")
        real_new_tickers = [t for t in new_tickers if t in prices.columns]
        company_info: Dict[str, dict] = {}
        for t in real_new_tickers:
            company_info[t] = get_company_info(t)

        # Also load info for existing tickers (needed for sector edges)
        existing_company_info: Dict[str, dict] = {}
        for t in existing_tickers:
            if t in prices.columns:
                existing_company_info[t] = get_company_info(t)

        # 4  Fetch news — only for NEW tickers
        logger.info("📰 Fetching news from DuckDuckGo …")
        news_map = fetch_news_for_tickers(company_info, max_per_company=max_news_per_company, delay=0.8)

        # 5  Create / update Company nodes — only for NEW tickers
        logger.info("🏗️  Creating Company nodes …")
        for t in real_new_tickers:
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
                "sma_50": tech_inds.get(t, {}).get("sma_50", 0.0),
                "sma_200": tech_inds.get(t, {}).get("sma_200", 0.0),
                "ema_20": tech_inds.get(t, {}).get("ema_20", 0.0),
                "rsi": tech_inds.get(t, {}).get("rsi", 50.0),
                "macd": tech_inds.get(t, {}).get("macd", 0.0),
                "macd_signal": tech_inds.get(t, {}).get("macd_signal", 0.0),
                "bb_upper": tech_inds.get(t, {}).get("bb_upper", 0.0),
                "bb_lower": tech_inds.get(t, {}).get("bb_lower", 0.0),
                "vol_latest": vol_metrics.get(t, {}).get("vol_latest", 0),
                "vol_ma_20": vol_metrics.get(t, {}).get("vol_ma_20", 0),
            }
            conn.run_write(_CREATE_COMPANY, params)

        # 6  Create Product nodes (from sector / industry) — only for NEW tickers
        logger.info("📦 Creating Product nodes …")
        products_created = set()
        for t in real_new_tickers:
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
            for t in real_new_tickers:
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

        # 8  Create News nodes + MENTIONED_IN edges — only for NEW tickers
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
                    "sentiment": art.get("sentiment", "Neutral"),
                })
                conn.run_write(_COMPANY_MENTIONED_IN, {
                    "ticker": t,
                    "title": art["title"],
                })
                titles.append(art["title"])
            all_news_titles_per_ticker[t] = titles

        # RELATED_NEWS: news items sharing companies
        _create_related_news(conn, all_news_titles_per_ticker)

        # 9  CORRELATED_WITH edges — computed across ALL tickers
        #    (includes new↔existing cross-correlations)
        logger.info("🔗 Creating CORRELATED_WITH edges …")
        # Build set of valid tickers in the graph
        all_real = set(real_new_tickers) | set(
            t for t in existing_tickers if t in prices.columns
        )
        for pair in corr_pairs:
            a, b = pair["ticker_a"], pair["ticker_b"]
            # At least one of the pair must be a NEW ticker
            # (existing↔existing edges already exist in the graph)
            if a not in all_real or b not in all_real:
                continue
            if a not in real_new_tickers and b not in real_new_tickers:
                continue  # both already existed — edge was created earlier
            conn.run_write(_CORRELATED_WITH, {
                "ticker_a": a,
                "ticker_b": b,
                "pearson": pair["pearson"],
                "spearman": pair["spearman"],
                "abs_avg": pair["abs_avg"],
                "strength": pair["strength"],
                "direction": pair["direction"],
            })

            # If high correlation + similar trend, add RELATED_TO
            trend_score = trend_similarity.get((a, b), 0.0)
            if pair["abs_avg"] > 0.4 and trend_score >= 0.6:
                conn.run_write(_RELATED_TO, {
                    "ticker_a": a,
                    "ticker_b": b,
                    "strength": pair["abs_avg"] + (trend_score * 0.5),
                    "reason": f"High correlation ({pair['abs_avg']:.2f}) + similar trend ({trend_score:.2f})"
                })

        # 10  SAME_SECTOR edges — between new tickers AND between new↔existing
        logger.info("🏷️  Creating SAME_SECTOR edges …")
        # Merge company info for sector lookup
        all_company_info = {**existing_company_info, **company_info}
        sector_groups: Dict[str, List[str]] = {}
        for t in all_real:
            sec = all_company_info.get(t, {}).get("sector", "Unknown")
            sector_groups.setdefault(sec, []).append(t)
        for sec, group in sector_groups.items():
            if sec == "Unknown":
                continue
            for i, a in enumerate(group):
                for b in group[i + 1:]:
                    # Only create edge if at least one ticker is new
                    if a in real_new_tickers or b in real_new_tickers:
                        conn.run_write(_SAME_SECTOR, {"ticker_a": a, "ticker_b": b})

        # 11  Ensure new tickers are connected to existing companies
        logger.info("🔌 Ensuring new tickers are connected …")
        existing_in_prices = [t for t in existing_tickers if t in prices.columns]
        for t in real_new_tickers:
            rel_count = conn.run_query(
                "MATCH (a:Company {ticker: $ticker})--(b:Company) RETURN count(b) AS cnt",
                {"ticker": t},
            )
            if rel_count and rel_count[0].get("cnt", 0) > 0:
                continue

            best = _best_correlation_pair(returns, t, existing_in_prices)
            if best:
                conn.run_write(_RELATED_TO, {
                    "ticker_a": t,
                    "ticker_b": best["ticker"],
                    "strength": best["abs_avg"],
                    "reason": f"Fallback: nearest correlation ({best['abs_avg']:.2f})",
                })
                continue

            if existing_in_prices:
                conn.run_write(_RELATED_TO, {
                    "ticker_a": t,
                    "ticker_b": existing_in_prices[0],
                    "strength": 0.0,
                    "reason": "Fallback: seed link",
                })

        # Done
        stats = conn.get_stats()
        logger.info(f"✅ Graph updated! {stats}")
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


def _best_correlation_pair(
    returns: pd.DataFrame,
    ticker: str,
    candidates: List[str],
) -> Optional[Dict[str, float]]:
    """Find the most correlated existing ticker for fallback connectivity."""
    if ticker not in returns.columns:
        return None

    try:
        from scipy.stats import pearsonr, spearmanr
    except Exception:
        return None

    best = None
    for other in candidates:
        if other not in returns.columns:
            continue
        sa = returns[ticker].dropna()
        sb = returns[other].dropna()
        common = sa.index.intersection(sb.index)
        if len(common) < 20:
            continue

        sa, sb = sa.loc[common], sb.loc[common]
        try:
            p_corr, _ = pearsonr(sa, sb)
        except Exception:
            p_corr = 0.0
        try:
            s_corr, _ = spearmanr(sa, sb)
        except Exception:
            s_corr = 0.0

        abs_avg = (abs(p_corr) + abs(s_corr)) / 2
        if best is None or abs_avg > best["abs_avg"]:
            best = {"ticker": other, "abs_avg": round(float(abs_avg), 4)}

    return best
