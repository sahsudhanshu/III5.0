import json
import urllib.request
import urllib.error
import asyncio
from langchain_core.tools import tool

async def fetch_ml_forecast(ticker: str, days: int = 7) -> dict:
    """Fetch 7-day stock forecast from the HF Space API."""
    url = "https://SaqlainSQX-iii5-backend.hf.space/stock-forecast"
    data = json.dumps({
        "ticker": ticker,
        "days": days,
        "news_source": "gnews",
        "use_gemini": False
    }).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

    loop = asyncio.get_event_loop()
    
    def _do_request():
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError as e:
            print(f"⚠️ HF Space API forecast fetch error: {e}")
            return None
        except Exception as e:
            print(f"⚠️ Unexpected error fetching forecast: {e}")
            return None

    return await loop.run_in_executor(None, _do_request)


@tool
async def analyze_ml_stock_forecast(ticker: str) -> str:
    """
    Fetches ML-based news classification and sentiment for a specific company ticker.
    The ML model acts purely as a news classification mechanism.
    
    CRITICAL INSTRUCTION FOR LLM: 
    When using this tool, DO NOT call search_financial_news or get_market_snapshot 
    at the same time. The ML model provides a basic news classification layer. 
    You MUST actively use your own internal knowledge about the specific company 
    (products, market position, executives, etc.) to interpret this data and provide 
    a highly company-specific, cohesive response.
    
    Args:
        ticker: The stock ticker symbol (e.g., "AAPL", "TSLA")
    
    Returns:
        Formatted string containing the ML-driven forecast, technical base, AI forecast, sentiment, and signals.
    """
    ticker = ticker.upper()
    print(f"🤖 [ML FORECAST] analyze_ml_stock_forecast called → ticker={ticker!r}")
    data = await fetch_ml_forecast(ticker, days=7)
    
    if not data:
        return f"Could not fetch the ML forecast for {ticker}. The backend AI service might be unavailable."
    
    # Format the forecast output beautifully for the LLM to read
    lines = [
        f"🤖 **Deep Learning ML Forecast: {ticker}**",
        f"Signal: {data.get('signal', 'UNKNOWN')} (Confidence: {data.get('confidence', 0.0):.2f})",
        f"News Sentiment Score: {data.get('sentiment_score', 0.0):.2f} (Based on {data.get('headlines_used', 0)} headlines)",
        f"News Summary (AI Analysis): {data.get('news_summary', 'N/A')}",
        "",
        "**7-Day AI Price Forecast vs Technical Baseline:**"
    ]
    
    forecast_data = data.get('forecast', [])
    for f in forecast_data:
        day = f.get('day', 0)
        t_close = f.get('tech_close', 0.0)
        a_close = f.get('ai_close', 0.0)
        lines.append(f" - Day {int(day)}: Technical Base = ${t_close:.2f} | AI Predicted Close = ${a_close:.2f}")
    
    lines.append("")
    lines.append("Instructions for LLM: The ML model above is just a news classification engine. YOU MUST use your innate knowledge about this specific company to explain what these numbers mean in the context of their actual business, products, or current market position. DO NOT call other tools.")
    
    return "\n".join(lines)
