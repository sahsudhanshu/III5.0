"""
FastAPI server that wraps the LangGraph trading agent.
Run from the trading_agent directory with myenv activated:
    myenv\\Scripts\\python.exe server.py
"""
import sys
import os
import logging
from pathlib import Path

# Force UTF-8 output on Windows to avoid charmap errors with emoji
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Add parent dir to sys.path so 'trading_agent' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# Also load the .env from this directory
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Now import the graph as a package
from trading_agent.graph import graph
from trading_agent.tools.news_fetch import fetch_gnews

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(name)s  %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Aria – Trading Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None


def _extract_text_content(content: object) -> Optional[str]:
    if content is None:
        return None

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, dict):
        for key in ("text", "content", "output_text", "value"):
            value = content.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str) and block.strip():
                parts.append(block.strip())
                continue
            if isinstance(block, dict):
                if block.get("type") in {"text", "output_text"}:
                    for key in ("text", "content", "output_text", "value"):
                        value = block.get(key)
                        if isinstance(value, str) and value.strip():
                            parts.append(value.strip())
                            break
                else:
                    for key in ("text", "content", "output_text", "value"):
                        value = block.get(key)
                        if isinstance(value, str) and value.strip():
                            parts.append(value.strip())
                            break
        return "\n".join(parts).strip() if parts else None

    return None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/news")
async def news_endpoint(q: str = "market", limit: int = 5):
    """Directly fetch financial news without involving the LLM."""
    try:
        articles = await fetch_gnews(query=q, max_results=limit)
        return {"status": "success", "articles": articles}
    except Exception as e:
        logger.error(f"Error fetching news for {q}: {e}")
        return {"status": "error", "error": str(e), "articles": []}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    logger.info(f"Received query: {request.message[:120]}")
    if request.context:
        logger.info(f"Page context: {request.context[:200]}")

    initial_state = {
        "human_input": request.message,
        "messages": [],
        "page_context": request.context or "",
    }

    try:
        result = await graph.ainvoke(initial_state)
        messages = result.get("messages", [])
        
        logger.info(f"Agent finished with {len(messages)} messages total.")
        
        # Extract the last AI text response (non-tool-call message)
        response_text = None
        for i, msg in enumerate(reversed(messages)):
            # Log exact details of each message encountered
            m_type = getattr(msg, "type", "UNKNOWN_TYPE")
            m_class = msg.__class__.__name__
            content = getattr(msg, "content", None)
            tool_calls = getattr(msg, "tool_calls", None)
            
            logger.info(f"Msg {i} from end: Class={m_class}, Type={m_type}, HasContent={bool(content)}, ToolCalls={len(tool_calls) if tool_calls else 0}")
            
            # More lenient AI check
            is_ai = m_type == "ai" or m_class == "AIMessage" or "AI" in m_class
            has_tools = bool(tool_calls)
            
            if is_ai and content and not has_tools:
                response_text = _extract_text_content(content)
                if not response_text:
                    extra = getattr(msg, "additional_kwargs", None)
                    if isinstance(extra, dict):
                        response_text = _extract_text_content(extra.get("content"))
                        if not response_text:
                            response_text = _extract_text_content(extra.get("text"))
                        if not response_text:
                            response_text = _extract_text_content(extra.get("output_text"))
                
                if response_text and response_text.lower() != "none" and response_text != "":
                    logger.info(f"Found valid AI response in message {i} from end.")
                    break

        if not response_text or response_text.lower() == "none" or response_text == "":
            logger.warning("Extraction loop failed to find a content-heavy AI message. Trying total fallback.")
            
            # Last ditch: Find ANY message with content that isn't a tool message
            for msg in reversed(messages):
                m_type = getattr(msg, "type", "")
                content = getattr(msg, "content", "")
                if content and m_type != "tool" and m_type != "system":
                    response_text = _extract_text_content(content) or str(content).strip()
                    if response_text and response_text.lower() != "none":
                        break
            
            if not response_text or response_text.lower() == "none" or response_text == "":
                response_text = "I'm here! I understood your message but couldn't format a text response. Try asking me for a stock analysis or market update."

        logger.info(f"Sending response to frontend (len: {len(response_text)})")
        return {"response": response_text}

    except Exception as e:
        logger.exception("Error during agent graph execution")
        return {
            "error": str(e),
            "response": f"⚠️ Analysis error: {e}\n\nPlease check the server logs for details.",
        }


@app.post("/api/analyze-point")
async def analyze_point_endpoint(request: dict):
    """
    Analyze a specific clicked data point on the chart.
    Frontend sends: symbol, date (YYYY-MM-DD), timeframe.
    Backend fetches REAL data from yfinance + Tavily news for the exact date,
    then asks the LLM to explain price movement using real catalysts.
    """
    try:
        symbol    = request.get("symbol", "UNKNOWN").upper()
        date_str  = request.get("date", "")
        timeframe = request.get("timeframe", "1M")

        if not date_str:
            return {"error": "No date provided", "analysis": "No data to analyze."}

        logger.info(f"Analyzing chart point: {symbol} @ {date_str}")

        import asyncio
        import yfinance as yf
        import httpx
        from datetime import datetime as dt, timezone

        # ── 1. Fetch OHLCV from yfinance ────────────────────────────────────
        def _fetch_price_data():
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1y")
            if hist.empty:
                return None, None, None
            info = {}
            try:
                info = ticker.info or {}
            except Exception:
                pass
            news = []
            try:
                news = ticker.news or []
            except Exception:
                pass
            hist.index = hist.index.strftime("%Y-%m-%d")
            return hist, info, news

        logger.info(f"Fetching yfinance data for {symbol}...")
        loop = asyncio.get_event_loop()
        hist, yf_info, yf_news_raw = await loop.run_in_executor(None, _fetch_price_data)

        if hist is None:
            return {"error": f"No data for {symbol}", "analysis": f"Could not fetch market data for {symbol}."}

        dates = list(hist.index)

        # Find exact or nearest trading date
        if date_str in dates:
            idx = dates.index(date_str)
        else:
            target_dt = dt.strptime(date_str, "%Y-%m-%d")
            parsed = [dt.strptime(d, "%Y-%m-%d") for d in dates]
            idx = min(range(len(parsed)), key=lambda i: abs((parsed[i] - target_dt).days))
            logger.info(f"Using nearest date: {dates[idx]}")

        def make_candle(i: int) -> dict:
            row = hist.iloc[i]
            return {
                "date":   dates[i],
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row["Volume"]),
            }

        clicked_candle = make_candle(idx)
        before_candles = [make_candle(i) for i in range(max(0, idx - 2), idx)]
        after_candles  = [make_candle(i) for i in range(idx + 1, min(len(dates), idx + 3))]

        closes  = [float(hist.iloc[i]["Close"])  for i in range(len(dates))]
        volumes = [int(hist.iloc[i]["Volume"])    for i in range(len(dates))]

        ma5  = round(sum(closes[max(0, idx-4):idx+1])  / min(5,  idx+1), 2)
        ma20 = round(sum(closes[max(0, idx-19):idx+1]) / min(20, idx+1), 2)
        avg_vol_10 = sum(volumes[max(0, idx-9):idx+1]) / min(10, idx+1)
        vol_ratio  = round(clicked_candle["volume"] / avg_vol_10, 2) if avg_vol_10 > 0 else 1.0

        op, cl = clicked_candle["open"], clicked_candle["close"]
        pct_change  = round(((cl - op) / op) * 100, 2) if op > 0 else 0.0
        body        = abs(cl - op)
        wick_range  = clicked_candle["high"] - clicked_candle["low"]
        movement_type = "neutral/doji"
        if abs(pct_change) > 3:
            movement_type = "strong spike" if pct_change > 0 else "strong drop"
        elif abs(pct_change) > 1.5:
            movement_type = "moderate move up" if pct_change > 0 else "moderate drop"
        elif abs(pct_change) < 0.3 and wick_range < body * 0.5:
            movement_type = "stagnant/consolidation"

        # ── 2. Company identity ──────────────────────────────────────────────
        company_name = (
            (yf_info or {}).get("longName")
            or (yf_info or {}).get("shortName")
            or symbol
        )
        sector   = (yf_info or {}).get("sector", "")
        industry = (yf_info or {}).get("industry", "")

        # ── 3. Human-readable date for search queries ────────────────────────
        clicked_actual_date = clicked_candle["date"]
        try:
            clicked_dt   = dt.strptime(clicked_actual_date, "%Y-%m-%d")
            # strftime on Windows doesn't support %-d; use lstrip("0") instead
            date_human   = clicked_dt.strftime("%B %d %Y").replace(" 0", " ")   # "April 9 2026"
            date_compact = clicked_dt.strftime("%Y-%m-%d")                      # "2026-04-09"
        except ValueError:
            date_human   = clicked_actual_date
            date_compact = clicked_actual_date

        # ── 4. Real news via Tavily (3 targeted queries in parallel) ─────────
        from trading_agent.config import get_settings
        settings = get_settings()

        # One day before → one day after to widen net
        from datetime import timedelta
        try:
            before_date = (clicked_dt - timedelta(days=2)).strftime("%Y-%m-%d")
            after_date  = (clicked_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        except Exception:
            before_date = after_date = date_compact

        search_queries = [
            f"{company_name} ({symbol}) stock news {date_human}",
            f"{symbol} {company_name} earnings analyst news {date_compact}",
            f"stock market S&P 500 {date_human} news",
        ]

        async def _tavily(query: str) -> list[str]:
            try:
                async with httpx.AsyncClient(timeout=12) as client:
                    resp = await client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": settings.tavily_api_key,
                            "query": query,
                            "max_results": 5,
                            "search_depth": "basic",
                            "include_answer": False,
                            "topic": "news",
                        },
                    )
                    resp.raise_for_status()
                    data = resp.json()
                snippets = []
                for r in data.get("results", []):
                    title   = r.get("title", "").strip()
                    content = r.get("content", "").strip()[:400]
                    url     = r.get("url", "")
                    pub     = r.get("published_date", "")
                    if title:
                        s = f"• [{title}]"
                        if pub: s += f" ({pub})"
                        if content: s += f"\n  {content}"
                        if url: s += f"\n  Source: {url}"
                        snippets.append(s)
                return snippets
            except Exception as ex:
                logger.warning(f"Tavily query failed ('{query[:50]}'): {ex}")
                return []

        logger.info(f"Running {len(search_queries)} Tavily searches for {symbol}...")
        tavily_results = await asyncio.gather(*[_tavily(q) for q in search_queries])

        # De-duplicate
        seen_keys: set[str] = set()
        deduped_tavily: list[str] = []
        for batch in tavily_results:
            for item in batch:
                key = item[:70]
                if key not in seen_keys:
                    seen_keys.add(key)
                    deduped_tavily.append(item)

        # yfinance ticker.news headlines (free, near real-time)
        yf_news_snippets: list[str] = []
        for item in (yf_news_raw or [])[:8]:
            title  = (item.get("title") or "").strip()
            pub_ts = item.get("providerPublishTime", 0)
            link   = item.get("link", "")
            if title:
                pub_str = ""
                if pub_ts:
                    pub_str = f" ({dt.fromtimestamp(pub_ts, tz=timezone.utc).strftime('%Y-%m-%d')})"
                entry = f"• {title}{pub_str}"
                if link: entry += f"\n  {link}"
                yf_news_snippets.append(entry)

        all_news = deduped_tavily[:10] + yf_news_snippets[:5]
        news_block = "\n".join(all_news) if all_news else "(No news articles retrieved — rely on your knowledge of this date.)"
        logger.info(f"News context: {len(all_news)} items for {symbol} @ {clicked_actual_date}")

        # ── 5. OHLCV context block ───────────────────────────────────────────
        def fmt(c: dict) -> str:
            return (f"  {c['date']} | O:{c['open']} H:{c['high']} "
                    f"L:{c['low']} C:{c['close']} Vol:{c['volume']:,}")

        ohlcv_lines = (
            (["2 days before:"] + [fmt(c) for c in before_candles] if before_candles else [])
            + [
                f"\n→ CLICKED: {fmt(clicked_candle)}",
                f"  MA5={ma5}  MA20={ma20}  Vol ratio={vol_ratio}x 10d avg",
                f"  Movement: {movement_type}  |  Change: {pct_change:+.2f}%",
                "",
            ]
            + ([f"2 days after:"] + [fmt(c) for c in after_candles] if after_candles else [])
        )

        # ── 6. Grounded LLM prompt ───────────────────────────────────────────
        prompt = f"""You are a financial market historian explaining to a retail investor
WHY {company_name} ({symbol}) moved the way it did on **{clicked_actual_date}**.

=== COMPANY ===
{company_name} ({symbol}) | Sector: {sector} | Industry: {industry}
52W Range: ${round(min(closes), 2)} – ${round(max(closes), 2)}

=== PRICE ACTION ON {clicked_actual_date} ===
{"".join(l + chr(10) for l in ohlcv_lines)}

=== REAL NEWS & EVENTS (retrieved for {date_human}) ===
{news_block}

=== YOUR TASK ===
Write EXACTLY 4 bullet points explaining what ACTUALLY caused this price movement.

RULES (violations mean failure):
✅ Each bullet MUST be a single line — no multi-sentence explanations, no follow-up sentences.
✅ Max ~20 words per bullet. Be punchy and specific.
✅ Every bullet must reference a real, specific, named event — not a vague description.
   Examples of GOOD (single-line) bullets:
   - "📉 JNJ fell 1.8% after White House announced new drug pricing executive orders cutting pharma revenues."
   - "🏛️ S&P 500 dropped on 104% US-China tariff confirmation, dragging broad market lower."
   - "💊 FDA approved Amgen's Stelara biosimilar in Q1 2026, pressuring JNJ's immunology segment."
✅ If movement was small/flat, explain competing forces in one line each.
✅ Use the news articles above as primary source; fall back to training knowledge if needed.
✅ Start each bullet with a fitting emoji (📉 📈 🏛️ 💊 ⚖️ 💰 🌍 📊 🔬 📢 ⚡ 🛡️)

❌ DO NOT write:
   - Multi-sentence bullets or explanatory follow-ups after a bullet
   - "Key level held as support" or "resistance at $X"
   - "Uptrend intact" or "downtrend confirmed"
   - "MA5 above MA20" as a standalone reason
   - "Volume confirmation" without a specific catalyst
   - Generic platitudes that would apply to ANY stock on ANY day

Focus on: earnings, macro events, sector news, analyst actions, regulatory decisions, geopolitical events, product announcements, executive changes, lawsuits, index events — anything REAL."""

        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatOpenAI(
            model=settings.nvidia_model,
            api_key=settings.nvidia_api_key,
            base_url=settings.nvidia_base_url,
            temperature=0.2,
            max_tokens=350,
        )

        response = await llm.ainvoke([
            SystemMessage(content=(
                "You are a precise financial market historian and analyst. "
                "You explain stock price movements using REAL, specific events — never generic technical analysis. "
                "You always ground your analysis in actual news, earnings, macroeconomic data, regulatory events, or geopolitical developments. "
                "Every bullet point must cite something real that happened in the world."
            )),
            HumanMessage(content=prompt),
        ])

        analysis = response.content if isinstance(response.content, str) else str(response.content)
        logger.info(f"Analysis ready ({len(analysis)} chars) for {symbol} @ {clicked_actual_date}")

        return {
            "symbol": symbol,
            "date":   clicked_actual_date,
            "movement_type": movement_type,
            "pct_change": pct_change,
            "candle": clicked_candle,
            "ma5": ma5,
            "ma20": ma20,
            "vol_ratio": vol_ratio,
            "analysis": analysis,
        }

    except Exception as e:
        logger.exception("Error in analyze-point endpoint")
        return {"error": str(e), "analysis": f"⚠️ Analysis failed: {e}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
