from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from huggingface_hub import hf_hub_download, snapshot_download

from .sector_sentiment import SectorSentimentEngine
from .stock_price_prediction import StockAppEngine


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

    if local_dir.exists() and any(local_dir.iterdir()):
        return local_dir

    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACEHUB_API_TOKEN")
    snapshot_download(
        repo_id=repo_id,
        local_dir=str(local_dir),
        local_dir_use_symlinks=False,
        token=token,
    )
    return local_dir


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


class SectorRequest(BaseModel):
    sector: str = Field(..., examples=["Semiconductors", "Energy"])


class ForecastRequest(BaseModel):
    ticker: str = Field(..., examples=["AAPL", "NVDA"])
    days: int = Field(7, ge=1, le=30)
    news_source: str = Field("gnews", pattern="^(gnews|yfinance)$")
    alpha: float = Field(0.05, ge=0.0, le=1.0)
    sentiment_decay: float = Field(0.85, ge=0.0, le=1.0)
    use_gemini: bool = False


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
