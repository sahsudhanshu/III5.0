"""
News fetcher — uses GNews to get recent stock/business news for companies.
"""

import logging
import time
from typing import Dict, List

logger = logging.getLogger(__name__)

try:
    from gnews import GNews
    HAS_GNEWS = True
except ImportError:
    HAS_GNEWS = False
    logger.warning("gnews not installed — run: pip install gnews")


def fetch_company_news(
    company_name: str,
    ticker: str,
    max_results: int = 5,
) -> List[dict]:
    """Search GNews for recent stock news about a company."""
    if not HAS_GNEWS:
        return []

    query = f"{company_name} stock"
    items: List[dict] = []

    try:
        gn = GNews(language="en", country="US", max_results=max_results)
        results = gn.get_news(query)
        for r in results:
            items.append({
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "date": r.get("published date", ""),
                "source": r.get("publisher", {}).get("title", "") if isinstance(r.get("publisher"), dict) else str(r.get("publisher", "")),
                "snippet": r.get("description", "")[:500] if r.get("description") else "",
                "search_query": query,
            })
        logger.info(f"📰 {ticker}: fetched {len(items)} news articles via GNews")
    except Exception as e:
        logger.warning(f"GNews search failed for {ticker}: {e}")

    return items


def fetch_news_for_tickers(
    company_info_map: Dict[str, dict],
    max_per_company: int = 3,
    delay: float = 1.0,
) -> Dict[str, List[dict]]:
    """Fetch news for multiple companies via GNews."""
    all_news: Dict[str, List[dict]] = {}

    for i, (ticker, info) in enumerate(company_info_map.items()):
        name = info.get("name", ticker)
        news = fetch_company_news(name, ticker, max_results=max_per_company)
        all_news[ticker] = news

        if delay > 0 and i < len(company_info_map) - 1:
            time.sleep(delay)

    total = sum(len(v) for v in all_news.values())
    logger.info(f"📰 Total news articles fetched: {total}")
    return all_news
