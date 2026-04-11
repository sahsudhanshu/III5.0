"""
Web search tool - Tavily Search API.

Gives the agent access to real-time web information for financial research,
market news, analyst reports, and broader context.
"""
from __future__ import annotations

import httpx
from langchain_core.tools import tool
from ..config import get_settings


@tool
async def web_search(query: str, max_results: int = 5) -> str:
    """
    Search the web for real-time information relevant to financial markets,
    trading, market news, analyst reports, or any other financial topic.
    
    Use this when you need current or recent information not available in your
    knowledge base or through other tools (market data, financial news).

    Args:
        query: The search query (be specific for best results)
        max_results: Number of results to return (default 5, max 10)
    
    Returns:
        Formatted string with search results and relevant summaries
    """
    print(f"🔍 [TOOL] web_search called → query={query!r}")
    
    settings = get_settings()
    if not settings.tavily_api_key:
        return "⚠️ Web search not configured. Set TAVILY_API_KEY in .env"

    max_results = min(max(1, max_results), 10)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.tavily_api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "basic",
                    "include_answer": True,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        lines: list[str] = [f"🔍 Web Search: {query}\n"]

        # Add summary if available
        if data.get("answer"):
            lines.append(f"**Summary:** {data['answer']}\n")

        # Process search results
        results = data.get("results", [])
        if not results:
            return "\n".join(lines) + "\nNo results found."
        
        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            url = r.get("url", "")
            content = r.get("content", "").strip()
            score = r.get("score", 0)
            
            # Truncate long content
            if content and len(content) > 400:
                content = content[:400] + "..."
            
            lines.append(f"**[{i}] {title}**")
            if content:
                lines.append(content)
            lines.append(f"Source: {url}  (relevance: {score:.0%})\n")

        return "\n".join(lines)

    except httpx.HTTPStatusError as e:
        return f"⚠️ Web search failed (HTTP {e.response.status_code}): {e.response.text[:200]}"
    except Exception as e:
        return f"⚠️ Web search error: {e}"
