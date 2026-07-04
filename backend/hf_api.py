from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from huggingface_hub import hf_hub_download, snapshot_download

from .rl_balancer import AILivePortfolioManager
from .sector_sentiment import SectorSentimentEngine
from .stock_price_prediction import StockAppEngine

import sys
_sn_path = str(Path(__file__).parent / "stock_network")
if _sn_path not in sys.path:
    sys.path.insert(0, _sn_path)

from .stock_network.graph_manager import build_full_graph
from .stock_network.graph_chat import chat_with_graph


app = FastAPI(title="III5 Backend (Sentiment + Forecast)", version="1.0.0")


def _download_sector_model_if_needed() -> Optional[Path]:
    """Ensure the sector sentiment model directory exists.

    If SECTOR_MODEL_REPO_ID is provided, downloads the repo snapshot.
    Returns model_dir if downloaded, else None.
    """

    repo_id = os.getenv("SECTOR_MODEL_REPO_ID")
    if not repo_id:
        return None

    # Prefer /data if available (HF Spaces), else /tmp
    base = Path("/data") if Path("/data").exists() else Path("/tmp")
    local_dir = base / "models" / "sector_sentiment" / repo_id.replace("/", "__")

    # If snapshot already exists, use it immediately.
    if local_dir.exists() and any(local_dir.iterdir()):
        nested = local_dir / "final_trading_model"
        return nested if nested.exists() else local_dir

    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")
    snapshot_download(
        repo_id=repo_id,
        local_dir=str(local_dir),
        token=token,
    )

    # In our model repo layout, files are under final_trading_model/.
    nested = local_dir / "final_trading_model"
    return nested if nested.exists() else local_dir


def _download_bundle_if_needed() -> Optional[Path]:
    """Ensure unified_stock_brain.pt exists.

    If BUNDLE_REPO_ID + BUNDLE_FILENAME are provided, downloads the file.
    Returns file path if downloaded, else None.
    """

    repo_id = os.getenv("BUNDLE_REPO_ID")
    filename = os.getenv("BUNDLE_FILENAME", "unified_stock_brain.pt")
    if not repo_id:
        return None

    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")
    path = hf_hub_download(repo_id=repo_id, filename=filename, token=token)
    return Path(path)


# Lazy singletons
_sector_engine: SectorSentimentEngine | None = None
_stock_engine: StockAppEngine | None = None
_rl_engine: AILivePortfolioManager | None = None


def get_sector_engine() -> SectorSentimentEngine:
    global _sector_engine
    if _sector_engine is None:
        model_dir = _download_sector_model_if_needed()
        _sector_engine = SectorSentimentEngine(model_dir=model_dir)
    return _sector_engine


def get_stock_engine() -> StockAppEngine:
    global _stock_engine
    if _stock_engine is None:
        bundle_path = _download_bundle_if_needed()
        _stock_engine = StockAppEngine(bundle_file=bundle_path)
    return _stock_engine


def get_rl_engine() -> AILivePortfolioManager:
    global _rl_engine
    if _rl_engine is None:
        _rl_engine = AILivePortfolioManager()
    return _rl_engine


class SectorRequest(BaseModel):
    sector: str = Field(..., examples=["Semiconductors", "Energy"])


class BuildGraphRequest(BaseModel):
    tickers: list[str] = Field(..., examples=[["AAPL", "MSFT"]])


class GraphChatRequest(BaseModel):
    query: str
    history: Optional[list[dict]] = None
    selected_ticker: Optional[str] = None


class SectorHeadlinesRequest(BaseModel):
    num_news: int = Field(..., ge=1, le=200, description="Number of provided headlines")
    headlines: list[str] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Externally-fetched news headlines",
    )


class ForecastRequest(BaseModel):
    ticker: str = Field(..., examples=["AAPL", "NVDA"])
    days: int = Field(7, ge=1, le=30)
    news_source: str = Field("gnews", pattern="^(gnews|yfinance)$")
    alpha: float = Field(0.05, ge=0.0, le=1.0)
    sentiment_decay: float = Field(0.85, ge=0.0, le=1.0)
    use_gemini: bool = False


class PortfolioHoldingRequest(BaseModel):
    symbol: str = Field(..., examples=["AAPL", "MSFT"])
    qty: float = Field(..., ge=0.0)
    avg_buy_price: float | None = Field(default=None, ge=0.0)


class PortfolioInsightRequest(BaseModel):
    cash_balance: float = Field(..., ge=0.0)
    holdings: list[PortfolioHoldingRequest] = Field(default_factory=list, max_length=500)
    sentiment_source: str = Field("gnews", pattern="^(gnews|yfinance)$")
    headlines_per_ticker: int = Field(5, ge=1, le=20)
    use_gemini: bool = True


def _build_ai_insight_text(
    *,
    use_gemini: bool,
    cash_balance: float,
    net_worth: float,
    buy_suggestions: list[dict],
    sell_suggestions: list[dict],
    average_sentiment: float,
) -> tuple[str, str]:
    if not use_gemini:
        direction = "neutral"
        if average_sentiment > 0.1:
            direction = "constructive"
        elif average_sentiment < -0.1:
            direction = "defensive"
        text = (
            f"Portfolio net worth is about ${net_worth:.2f} with cash ${cash_balance:.2f}. "
            f"Market tone is {direction} (sentiment {average_sentiment:.3f}). "
            f"Suggested rebalancing: {len(buy_suggestions)} buys and {len(sell_suggestions)} sells."
        )
        return text, "template"

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="GEMINI_API_KEY is required when use_gemini=true",
        )

    try:
        import google.generativeai as genai
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"google-generativeai import failed: {type(e).__name__}: {e}",
        ) from e

    prompt = (
        "You are a portfolio rebalancing assistant. Give a concise, practical recommendation in plain English.\n"
        f"Cash balance: ${cash_balance:.2f}\n"
        f"Net worth: ${net_worth:.2f}\n"
        f"Average market sentiment score: {average_sentiment:.4f}\n"
        f"Top BUY suggestions (JSON): {buy_suggestions[:5]}\n"
        f"Top SELL suggestions (JSON): {sell_suggestions[:5]}\n\n"
        "Explain what to buy and what to reduce, mention risk awareness, and keep it under 120 words."
    )

    model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.0-flash")
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(prompt)
        text = (response.text or "").strip()
        if not text:
            raise HTTPException(status_code=502, detail="Gemini returned empty response")
        return text, "gemini"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini insight generation failed: {type(e).__name__}: {e}",
        ) from e


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/sector-sentiment")
def sector_sentiment(req: SectorRequest):
    engine = get_sector_engine()
    result = engine.run_analysis(req.sector)
    if not result:
        raise HTTPException(status_code=404, detail="No news found for sector")
    return result


@app.post("/sector-sentiment-headlines")
def sector_sentiment_headlines(req: SectorHeadlinesRequest):
    # News fetching is expected outside this API. We only score provided headlines.
    cleaned = [h.strip() for h in req.headlines if h and h.strip()]
    if len(cleaned) != req.num_news:
        raise HTTPException(
            status_code=400,
            detail=f"num_news ({req.num_news}) must match non-empty headlines count ({len(cleaned)})",
        )

    engine = get_sector_engine()
    result = engine.analyze_headlines(cleaned, sector_query="HEADLINES")
    if not result:
        raise HTTPException(status_code=400, detail="No valid headlines provided")

    positive = int(result["positive"])
    negative = int(result["negative"])
    neutral = int(result["neutral"])
    if positive > negative and positive > neutral:
        overall = "POSITIVE"
    elif negative > positive and negative > neutral:
        overall = "NEGATIVE"
    else:
        overall = "NEUTRAL"

    return {
        "total_headlines": result["total_headlines"],
        "positive": result["positive"],
        "negative": result["negative"],
        "neutral": result["neutral"],
        "positive_pct": result["positive_pct"],
        "negative_pct": result["negative_pct"],
        "neutral_pct": result["neutral_pct"],
        "overall_sentiment": overall,
        "sentiment_score": result["sentiment_score"],
        "signal": result["signal"],
        "per_news_sentiment": result.get("per_news_sentiment", []),
        "timestamp": result["timestamp"],
    }


@app.post("/stock-forecast")
def stock_forecast(req: ForecastRequest):
    # Stock engine requires TRUSTED_CHECKPOINT=1 for loading sklearn objects.
    if os.getenv("TRUSTED_CHECKPOINT", "").strip().lower() not in {"1", "true", "yes"}:
        raise HTTPException(
            status_code=400,
            detail="Set TRUSTED_CHECKPOINT=1 (Space secret/env) to allow loading the unified bundle.",
        )

    if not req.use_gemini:
        # Force no-gemini without requiring GEMINI_API_KEY
        engine = StockAppEngine(bundle_file=_download_bundle_if_needed(), use_gemini=False)
    else:
        engine = get_stock_engine()

    r = engine.predict(
        req.ticker,
        days=req.days,
        news_source=req.news_source,
        alpha=req.alpha,
        sentiment_decay=req.sentiment_decay,
    )

    return {
        "ticker": r.ticker,
        "headlines_used": r.headlines_used,
        "news_summary": r.news_summary,
        "day1_technical_base": r.technical_base,
        "day1_ai_forecast": r.ai_adjusted_price,
        "sentiment_score": r.sentiment_score,
        "confidence": r.confidence,
        "signal": r.signal,
        "forecast": r.forecast_7d,
    }


@app.post("/portfolio-ai-insight")
def portfolio_ai_insight(req: PortfolioInsightRequest):
    engine = get_rl_engine()

    holdings_qty = {ticker: 0.0 for ticker in engine.tickers}
    ignored_symbols: list[str] = []
    for h in req.holdings:
        symbol = h.symbol.strip().upper()
        if symbol in holdings_qty:
            holdings_qty[symbol] += float(h.qty)
        else:
            ignored_symbols.append(symbol)

    ordered_quantities = [holdings_qty[ticker] for ticker in engine.tickers]
    trade_plan, net_worth, live_prices, live_sentiments = engine.calculate_trades_from_live_data(
        current_cash=float(req.cash_balance),
        current_quantities=ordered_quantities,
        sentiment_source=req.sentiment_source,
        headlines_per_ticker=req.headlines_per_ticker,
    )

    buy_suggestions: list[dict] = []
    sell_suggestions: list[dict] = []
    per_ticker: list[dict] = []

    for idx, ticker in enumerate(engine.tickers):
        item = trade_plan[ticker]
        row = {
            "ticker": ticker,
            "action": item["action"],
            "shares_to_trade": item["shares_to_trade"],
            "target_weight_pct": item["target_weight_pct"],
            "target_quantity": item["target_quantity"],
            "current_price": round(float(live_prices[idx]), 4),
            "sentiment_score": round(float(live_sentiments[idx]), 4),
        }
        per_ticker.append(row)
        if item["action"] == "BUY":
            buy_suggestions.append(row)
        elif item["action"] == "SELL":
            sell_suggestions.append(row)

    buy_suggestions.sort(key=lambda x: x["shares_to_trade"], reverse=True)
    sell_suggestions.sort(key=lambda x: abs(x["shares_to_trade"]), reverse=True)
    avg_sent = float(sum(live_sentiments) / len(live_sentiments)) if live_sentiments else 0.0

    insight_text, insight_source = _build_ai_insight_text(
        use_gemini=req.use_gemini,
        cash_balance=float(req.cash_balance),
        net_worth=float(net_worth),
        buy_suggestions=buy_suggestions,
        sell_suggestions=sell_suggestions,
        average_sentiment=avg_sent,
    )

    return {
        "cash_balance": round(float(req.cash_balance), 2),
        "net_worth": round(float(net_worth), 2),
        "tracked_tickers": engine.tickers,
        "ignored_symbols": ignored_symbols,
        "average_market_sentiment": round(avg_sent, 4),
        "buy_suggestions": buy_suggestions,
        "sell_suggestions": sell_suggestions,
        "per_ticker_plan": per_ticker,
        "ai_insight_text": insight_text,
        "ai_insight_source": insight_source,
    }


@app.post("/api/build-graph")
def build_graph(req: BuildGraphRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="Must provide at least one ticker.")
    try:
        clean_tickers = [t.strip().upper() for t in req.tickers if t.strip()]
        stats = build_full_graph(tickers=clean_tickers, period="6mo")
        return {"status": "success", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/graph-chat")
async def graph_chat(req: GraphChatRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        result = await chat_with_graph(
            user_query=req.query,
            history=req.history,
            selected_ticker=req.selected_ticker,
        )
        return result
    except Exception as e:
        return {"response": f"⚠️ Error: {str(e)}", "tickers": [], "related": [], "edges": []}
