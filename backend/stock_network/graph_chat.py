"""
Graph Chat — Simple chatbot that fetches graph context from Neo4j
and sends it to the LLM for natural-language explanation.

No function calling — just context injection.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "trading_agent", ".env"))

from openai import OpenAI
from neo4j_connection import Neo4jConnection

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")

client = OpenAI(api_key=NVIDIA_API_KEY, base_url=NVIDIA_BASE_URL) if NVIDIA_API_KEY else None

# ---------------------------------------------------------------------------
# Known tickers
# ---------------------------------------------------------------------------

TICKER_MAP = {
    "apple": "AAPL", "aapl": "AAPL",
    "microsoft": "MSFT", "msft": "MSFT",
    "google": "GOOGL", "alphabet": "GOOGL", "googl": "GOOGL",
    "amazon": "AMZN", "amzn": "AMZN",
    "tesla": "TSLA", "tsla": "TSLA",
    "meta": "META", "facebook": "META",
    "nvidia": "NVDA", "nvda": "NVDA",
    "berkshire": "BRK-B", "brk-b": "BRK-B", "brkb": "BRK-B",
    "visa": "V",
    "walmart": "WMT", "wmt": "WMT",
    "jpmorgan": "JPM", "jpm": "JPM",
    "netflix": "NFLX", "nflx": "NFLX",
    "amd": "AMD",
}


def _extract_tickers(query: str) -> List[str]:
    """Pull tickers from the user's natural language query."""
    query_lower = query.lower()
    found = set()

    # Check name/ticker map
    for name, ticker in TICKER_MAP.items():
        if name in query_lower:
            found.add(ticker)

    # Also try to find uppercase ticker-like words (2-5 uppercase letters)
    for word in query.split():
        clean = re.sub(r"[^A-Za-z\-]", "", word).upper()
        if 1 <= len(clean) <= 5 and clean.isupper():
            if clean in TICKER_MAP.values():
                found.add(clean)

    return list(found)


# ---------------------------------------------------------------------------
# Neo4j context fetcher
# ---------------------------------------------------------------------------

def _fetch_graph_context(conn: Neo4jConnection, tickers: List[str]) -> str:
    """Query Neo4j for all relevant data about the given tickers."""
    context_parts = []

    for ticker in tickers:
        # Company details
        rows = conn.run_query(
            "MATCH (c:Company {ticker: $t}) RETURN properties(c) AS p",
            {"t": ticker},
        )
        if rows:
            props = rows[0]["p"]
            context_parts.append(f"\n## {props.get('name', ticker)} ({ticker})")
            context_parts.append(f"- Sector: {props.get('sector', 'N/A')}")
            context_parts.append(f"- Price: ${props.get('current_price', 'N/A')}")
            context_parts.append(f"- Momentum (20d): {props.get('momentum', 'N/A')}%")
            context_parts.append(f"- Volatility: {props.get('volatility', 'N/A')}")
            context_parts.append(f"- RSI: {props.get('rsi', 'N/A')}")
            context_parts.append(f"- SMA 50: {props.get('sma_50', 'N/A')} | SMA 200: {props.get('sma_200', 'N/A')}")
            context_parts.append(f"- MACD: {props.get('macd', 'N/A')} | Signal: {props.get('macd_signal', 'N/A')}")
            context_parts.append(f"- Beta: {props.get('beta', 'N/A')}")

        # Correlations
        corr_rows = conn.run_query(
            """MATCH (c:Company {ticker: $t})-[r:CORRELATED_WITH]-(o:Company)
               RETURN o.ticker AS ticker, o.name AS name,
                      r.pearson AS pearson, r.spearman AS spearman,
                      r.strength AS strength, r.direction AS direction
               ORDER BY abs(toFloat(r.pearson)) DESC""",
            {"t": ticker},
        )
        if corr_rows:
            context_parts.append(f"\n### Correlations with {ticker}:")
            for cr in corr_rows:
                context_parts.append(
                    f"- {cr['name']} ({cr['ticker']}): Pearson={cr['pearson']}, "
                    f"Spearman={cr['spearman']}, Strength={cr['strength']}, "
                    f"Direction={cr['direction']}"
                )

        # Products
        prod_rows = conn.run_query(
            """MATCH (c:Company {ticker: $t})-[:PRODUCES]->(p:Product)
               RETURN p.name AS name, p.sector AS sector, p.industry AS industry""",
            {"t": ticker},
        )
        if prod_rows:
            context_parts.append(f"\n### Products/Industries of {ticker}:")
            for pr in prod_rows:
                context_parts.append(f"- {pr['name']} ({pr.get('industry', 'N/A')})")

        # News
        news_rows = conn.run_query(
            """MATCH (c:Company {ticker: $t})-[:MENTIONED_IN]->(n:News)
               RETURN n.title AS title, n.sentiment AS sentiment, n.source AS source
               ORDER BY n.date DESC LIMIT 5""",
            {"t": ticker},
        )
        if news_rows:
            context_parts.append(f"\n### Recent news for {ticker}:")
            for nr in news_rows:
                context_parts.append(
                    f"- [{nr.get('sentiment', 'Neutral')}] {nr['title']} — {nr.get('source', '')}"
                )

        # Same sector peers
        sector_rows = conn.run_query(
            """MATCH (c:Company {ticker: $t})-[:SAME_SECTOR]-(o:Company)
               RETURN o.ticker AS ticker, o.name AS name LIMIT 5""",
            {"t": ticker},
        )
        if sector_rows:
            peers = ", ".join(f"{r['name']} ({r['ticker']})" for r in sector_rows)
            context_parts.append(f"\n### Same-sector peers: {peers}")

    # If no tickers found, get a general overview
    if not tickers:
        all_companies = conn.run_query(
            "MATCH (c:Company) RETURN c.ticker AS ticker, c.name AS name, "
            "c.current_price AS price, c.sector AS sector ORDER BY c.current_price DESC"
        )
        if all_companies:
            context_parts.append("\n## All companies in the graph:")
            for c in all_companies:
                context_parts.append(
                    f"- {c['name']} ({c['ticker']}): ${c.get('price', 'N/A')} — {c.get('sector', 'N/A')}"
                )

    return "\n".join(context_parts)


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a financial analyst AI embedded inside an interactive knowledge graph dashboard.

You receive real-time graph data from a Neo4j database containing companies, their correlations, products, news sentiment, and technical indicators.

Your role:
- Analyze the graph data provided in the context
- Give insightful, data-driven explanations
- Reference ACTUAL numbers from the data (correlation values, prices, RSI, momentum, etc.)
- Explain what the numbers MEAN for investors (e.g., "Pearson of 0.85 means these stocks move nearly in lockstep")
- Keep responses conversational but precise — like a senior analyst briefing
- Use bullet points for clarity when comparing multiple stocks
- If news sentiment is provided, relate it to price movement
- If technical indicators are provided, give actionable insights (overbought/oversold, trend direction)

NEVER make up data. Only reference what's in the graph context below. If data is missing, say so."""


# ---------------------------------------------------------------------------
# Main chat function
# ---------------------------------------------------------------------------

async def chat_with_graph(
    user_query: str,
    history: Optional[List[dict]] = None,
    selected_ticker: Optional[str] = None,
) -> Dict[str, Any]:
    """
    1. Extract tickers from the query
    2. Fetch their graph context from Neo4j
    3. Send query + context to LLM
    4. Return response text + tickers for graph highlighting
    """
    if not client:
        return {
            "response": "⚠️ NVIDIA_API_KEY not configured.",
            "tickers": [],
            "related": [],
            "edges": [],
        }

    conn = Neo4jConnection()
    conn.connect()

    try:
        # Extract tickers from query + any currently selected node
        tickers = _extract_tickers(user_query)
        if selected_ticker and selected_ticker not in tickers:
            tickers.insert(0, selected_ticker)

        logger.info(f"Chat query: '{user_query}' | tickers: {tickers}")

        # Fetch graph context
        graph_context = _fetch_graph_context(conn, tickers)
        logger.info(f"Graph context: {len(graph_context)} chars")

        # Also fetch correlated tickers for graph highlighting
        related_tickers = []
        highlight_edges = []
        for t in tickers:
            corr_rows = conn.run_query(
                """MATCH (c:Company {ticker: $t})-[r:CORRELATED_WITH]-(o:Company)
                   RETURN o.ticker AS ticker, r.pearson AS pearson, r.direction AS direction
                   ORDER BY abs(toFloat(r.pearson)) DESC LIMIT 5""",
                {"t": t},
            )
            for cr in corr_rows:
                if cr["ticker"] not in tickers:
                    related_tickers.append(cr["ticker"])
                pearson = float(cr.get("pearson", 0) or 0)
                highlight_edges.append({
                    "source": t,
                    "target": cr["ticker"],
                    "color": "#10b981" if pearson >= 0 else "#ef4444",
                    "width": max(2, round(abs(pearson) * 8)),
                })

        # Build messages
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]

        if graph_context.strip():
            messages.append({
                "role": "system",
                "content": f"GRAPH DATA FROM NEO4J:\n{graph_context}",
            })

        # Add conversation history (last 6 messages)
        if history:
            for msg in history[-6:]:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

        messages.append({"role": "user", "content": user_query})

        # Call LLM
        response = client.chat.completions.create(
            model=NVIDIA_MODEL,
            messages=messages,
            temperature=0.3,
            max_tokens=1024,
        )

        answer = response.choices[0].message.content or "No response generated."
        logger.info(f"Chat response: {len(answer)} chars")

        return {
            "response": answer,
            "tickers": tickers,                         # primary tickers (blue)
            "related": list(set(related_tickers))[:8],  # correlated tickers (light blue)
            "edges": highlight_edges,                    # edges to color
        }

    except Exception as e:
        logger.exception("Chat error")
        return {
            "response": f"⚠️ Error: {str(e)}",
            "tickers": tickers if 'tickers' in dir() else [],
            "related": [],
            "edges": [],
        }
    finally:
        conn.close()

