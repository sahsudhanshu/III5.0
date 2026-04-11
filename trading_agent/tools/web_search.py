from __future__ import annotations

from typing import Any, Dict, List
import logging

import requests

from ..config import get_settings, get_proxy_dict

logger = logging.getLogger(__name__)


def search_financial_news(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search for financial news using Tavily API with fallback to mock data.
    
    Args:
        query: Search query string
        limit: Max number of results (default 5)
        
    Returns:
        List of normalized news articles
    """
    try:
        settings = get_settings()
        
        if not query or not query.strip():
            logger.warning("Empty query provided, returning mock data")
            return _get_mock_news(limit)
        
        payload = {
            "api_key": settings.tavily_api_key,
            "query": query[:500],  # Limit query length
            "topic": settings.tavily_topic,
            "search_depth": settings.tavily_search_depth,
            "max_results": min(limit, 20),  # Cap at 20
            "include_answer": False,
            "include_raw_content": False,
        }
        
        # Get proxy configuration
        proxies = get_proxy_dict()
        
        logger.info(f"Searching financial news for: {query[:50]}")
        if proxies:
            logger.info(f"Using proxy: {settings.proxy_address}:{settings.proxy_port}")
        
        response = requests.post(
            settings.tavily_base_url, 
            json=payload, 
            timeout=settings.connection_timeout,
            proxies=proxies,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("results", [])
        
        normalized: List[Dict[str, Any]] = []
        for item in results:
            if not isinstance(item, dict):
                continue
                
            article = {
                "title": str(item.get("title", ""))[:200],
                "summary": str(item.get("content", ""))[:500],
                "source": str(item.get("source", "unknown"))[:100],
                "url": str(item.get("url", ""))[:500],
                "score": float(item.get("score", 0.0)),
                "published": str(item.get("published_date", ""))[:20],
            }
            normalized.append(article)
        
        logger.info(f"Retrieved {len(normalized)} news articles")
        return normalized[:limit]
        
    except requests.exceptions.Timeout:
        logger.error("Tavily API timeout, returning mock data")
        return _get_mock_news(limit)
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error to Tavily: {e}, returning mock data")
        return _get_mock_news(limit)
    except Exception as e:
        logger.error(f"Error fetching news: {e}, returning mock data")
        return _get_mock_news(limit)


def _get_mock_news(limit: int = 5) -> List[Dict[str, Any]]:
    """Fallback mock news data when API is unavailable."""
    mock_articles = [
        {
            "title": "Federal Reserve Signals Possible Rate Cuts in Q2",
            "summary": "Fed officials indicated potential interest rate reductions depending on inflation trends. Markets responded positively to dovish commentary.",
            "source": "CNBC",
            "url": "https://example.com/fed-rates",
            "score": 0.95,
            "published": "2026-04-10",
        },
        {
            "title": "Tech Sector Rally Continues Amid AI Chip Demand",
            "summary": "Semiconductor companies report strong earnings with growing AI chip demand. NVIDIA extends gains as cloud spending accelerates.",
            "source": "Bloomberg",
            "url": "https://example.com/tech-ai",
            "score": 0.92,
            "published": "2026-04-10",
        },
        {
            "title": "Corporate Earnings Beat Expectations",
            "summary": "Q1 earnings season shows 8% growth in corporate profits. Tech and healthcare sectors lead gains.",
            "source": "Reuters",
            "url": "https://example.com/earnings",
            "score": 0.88,
            "published": "2026-04-09",
        },
        {
            "title": "Treasury Yields Decline Amid Economic Uncertainty",
            "summary": "10-year yields fall 15bps as investors seek safe-haven assets. Mixed employment data fuels debate on economic slowdown.",
            "source": "MarketWatch",
            "url": "https://example.com/yields",
            "score": 0.85,
            "published": "2026-04-09",
        },
        {
            "title": "Energy Prices Surge on Geopolitical Tensions",
            "summary": "Oil futures climb 3% as supply concerns emerge. Natural gas also higher on demand expectations.",
            "source": "Financial Times",
            "url": "https://example.com/energy",
            "score": 0.80,
            "published": "2026-04-08",
        },
    ]
    
    logger.info(f"Using mock news data (limit={limit})")
    return mock_articles[:limit]
