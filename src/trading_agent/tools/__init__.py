"""Trading agent tools module.

Provides web search and financial news capabilities for trading analysis.
"""

from .web_search import web_search
from .news_fetch import search_financial_news
from .market_data import get_market_snapshot

__all__ = [
    "web_search",
    "search_financial_news",
    "get_market_snapshot",
]
