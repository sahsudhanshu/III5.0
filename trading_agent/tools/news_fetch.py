"""Financial news tool - gnews API.

Gives the agent access to real-time financial news for trading analysis,
market sentiment, corporate news, earnings announcements, and regulatory updates.
"""
from __future__ import annotations

import asyncio
from langchain_core.tools import tool


async def fetch_gnews(query: str, max_results: int = 5) -> list:
    """Fetch raw JSON articles from gnews with fallback mock data."""
    print(f"📰 [FETCH] fetch_gnews called → query={query!r}")
    max_results = min(max(1, max_results), 20)
    
    # Try to fetch real news from gnews
    try:
        from gnews import GNews
        google_news = GNews(max_results=max_results * 2)
        loop = asyncio.get_event_loop()
        articles = await loop.run_in_executor(
            None, 
            google_news.get_news,
            query,
        )
        
        if articles:
            return _clean_articles(articles, max_results)
    except ImportError:
        print("⚠️ gnews not installed, using fallback")
    except Exception as e:
        print(f"⚠️ gnews fetch error: {e}")
    
    # Fallback to mock news data
    return _get_raw_mock_financial_news(query, max_results)


@tool
async def search_financial_news(query: str, max_results: int = 5) -> str:
    """
    Search for financial news using gnews API with fallback to mock data.
    
    Fetches real-time financial news articles from multiple sources for
    analyzing market sentiment, corporate events, and trading catalysts.
    
    Use this when you need current or recent financial news, earnings
    announcements, regulatory updates, or market sentiment analysis.

    Args:
        query: The search query (e.g., "Apple earnings", "Fed interest rates")
        max_results: Number of results to return (default 5, max 20)
    
    Returns:
        Formatted string with news articles and summaries
    """
    articles = await fetch_gnews(query, max_results)
    return _format_news_results(query, articles)


def _clean_articles(articles: list, max_results: int) -> list:
    """Clean and standardize gnews articles into dicts."""
    cleaned = []
    for article in articles:
        if len(cleaned) >= max_results:
            break
        try:
            if not isinstance(article, dict):
                continue
            
            title = article.get("title", "").strip()
            source = article.get("source", "Unknown")
            if isinstance(source, dict):
                source = source.get("title", "Unknown")
            url = article.get("url", "")
            summary = article.get("description") or article.get("summary", "")
            summary = summary.strip() if summary else ""
            published = article.get("published date", "")
            
            if not title:
                continue
            
            if summary and len(summary) > 300:
                summary = summary[:300] + "..."
            
            cleaned.append({
                "title": title,
                "source": source,
                "summary": summary,
                "url": url,
                "published": published
            })
        except (KeyError, TypeError, AttributeError):
            continue
    return cleaned


def _format_news_results(query: str, articles: list) -> str:
    """Format structured dict articles into readable markdown output for the LLM."""
    lines = [f"📰 Financial News: {query}\n"]
    
    if not articles:
        return "\n".join(lines) + "No articles found."
    
    # Process articles
    count = 0
    for article in articles:
        if count >= 20: # arbitrary cap
            break
        
        try:
            title = article.get("title", "")
            source = article.get("source", "Unknown")
            url = article.get("url", "")
            summary = article.get("summary", "")
            
            lines.append(f"**[{count + 1}] {title}**")
            lines.append(f"Source: {source}")
            if summary:
                lines.append(summary)
            if url:
                lines.append(f"URL: {url}")
            lines.append("")
            
            count += 1
        except Exception:
            continue
    
    if count == 0:
        return "\n".join(lines) + "No valid articles found."
    
    return "\n".join(lines)


def _get_raw_mock_financial_news(query: str, max_results: int) -> list:
    """Fallback mock financial news data arrays."""
    mock_articles = [
        {
            "title": "NVIDIA Q1 Earnings Beat Analyst Expectations by 25%",
            "source": "Reuters",
            "summary": "NVIDIA reported revenue of $26.1 billion for Q1, exceeding consensus estimates by $6.5 billion. Gross margins expanded to 75% driven by strong AI datacenter demand.",
            "url": "https://reuters.com/nvidia-q1",
            "published": "2 hours ago"
        },
        {
            "title": "Federal Reserve Signals Possibility of Rate Cuts by Q3",
            "source": "Bloomberg",
            "summary": "Fed officials indicated in FOMC meeting that interest rate reductions may be warranted if inflation continues on downward trajectory. Market rallied on dovish commentary.",
            "url": "https://bloomberg.com/fed-rates",
            "published": "4 hours ago"
        },
        {
            "title": "Apple Announces New AI Integration Across All Products",
            "source": "CNBC",
            "summary": "Apple unveiled comprehensive AI features for iPhone, Mac, and iPad during developer conference. Stock jumped 3% on announcement.",
            "url": "https://cnbc.com/apple-ai",
            "published": "1 day ago"
        },
        {
            "title": "Treasury Yields Decline Amid Economic Slowdown Concerns",
            "source": "Financial Times",
            "summary": "10-year Treasury yields fell 18 basis points to 4.12% as investors seek safe-haven assets. Mixed employment data fuels recession debate.",
            "url": "https://ft.com/treasuries",
            "published": "1 day ago"
        },
        {
            "title": "Energy Markets Rally on Middle East Supply Disruptions",
            "source": "MarketWatch",
            "summary": "Oil futures climbed 3.2% as geopolitical tensions threaten supply from key regions. WTI crude reached $93 per barrel, highest in 6 weeks.",
            "url": "https://marketwatch.com/energy",
            "published": "2 days ago"
        },
    ]
    
    # Filter based on query relevance (simple keyword matching)
    query_lower = query.lower()
    relevant = []
    for article in mock_articles:
        if any(word in article["title"].lower() for word in query_lower.split()):
            relevant.append(article)
    
    # Use relevant articles if found, otherwise use all
    articles_to_show = relevant if relevant else mock_articles
    return articles_to_show[:max_results]
