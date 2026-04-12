"""
Stock data fetcher — pulls real market data via yfinance.
Returns price history, company info (sector, industry, name, market cap).
"""

import logging
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# yfinance availability
# ---------------------------------------------------------------------------
try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False
    logger.warning("yfinance not installed – will use fallback data")

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_multi_stock_data(
    tickers: List[str],
    period: str = "6mo",
) -> Dict[str, pd.DataFrame]:
    """Fetch OHLCV data for multiple tickers.

    Returns dict  ticker -> DataFrame (Date index, OHLCV columns).
    Falls back to realistic synthetic data if yfinance fails.
    """
    data: Dict[str, pd.DataFrame] = {}
    for ticker in tickers:
        df = _fetch_single(ticker, period)
        if df is not None and not df.empty:
            data[ticker] = df
            logger.info(f"✅ {ticker}: {len(df)} trading days")
        else:
            logger.warning(f"⚠️ {ticker}: no data")
    if not data:
        raise ValueError("Could not fetch data for any ticker")
    return data


def get_company_info(ticker: str) -> dict:
    """Return company metadata from yfinance (sector, industry, name, …)."""
    if not HAS_YFINANCE:
        return _fallback_info(ticker)
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        return {
            "ticker": ticker,
            "name": info.get("shortName") or info.get("longName") or ticker,
            "sector": info.get("sector", "Unknown"),
            "industry": info.get("industry", "Unknown"),
            "market_cap": info.get("marketCap", 0),
            "country": info.get("country", "Unknown"),
            "website": info.get("website", ""),
            "description": (info.get("longBusinessSummary") or "")[:300],
        }
    except Exception as e:
        logger.warning(f"yfinance info failed for {ticker}: {e}")
        return _fallback_info(ticker)


def get_close_prices(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Build a single DataFrame of adjusted close prices (columns = tickers)."""
    close: Dict[str, pd.Series] = {}
    for ticker, df in data.items():
        col = "Adj Close" if "Adj Close" in df.columns else "Close"
        s = df[col].copy()
        if isinstance(s.index, pd.DatetimeIndex):
            s.index = pd.to_datetime(s.index.date)
        close[ticker] = s
    prices = pd.DataFrame(close).dropna()
    return prices


def get_volumes(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Build a single DataFrame of volume (columns = tickers)."""
    vols: Dict[str, pd.Series] = {}
    for ticker, df in data.items():
        if "Volume" in df.columns:
            s = df["Volume"].copy()
            if isinstance(s.index, pd.DatetimeIndex):
                s.index = pd.to_datetime(s.index.date)
            vols[ticker] = s
    return pd.DataFrame(vols).fillna(0)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _fetch_single(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Try yfinance, then fallback."""
    if HAS_YFINANCE:
        try:
            df = yf.download(ticker, period=period, interval="1d", progress=False)
            if df is not None and not df.empty:
                # Flatten MultiIndex columns if present
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                if not isinstance(df.index, pd.DatetimeIndex):
                    df.index = pd.to_datetime(df.index)
                return df
        except Exception as e:
            logger.debug(f"yfinance download failed for {ticker}: {e}")

    # fallback: realistic synthetic data so the app still works
    return _synthetic_data(ticker, period)


def _synthetic_data(ticker: str, period: str) -> pd.DataFrame:
    """Generate deterministic synthetic OHLCV data (fallback only)."""
    period_days = {"1mo": 22, "3mo": 63, "6mo": 126, "1y": 252, "2y": 504}
    days = period_days.get(period, 126)
    seed = int(hashlib.md5(ticker.encode()).hexdigest(), 16) % 2**31
    rng = np.random.RandomState(seed)
    base = 50 + rng.rand() * 300

    dates = pd.bdate_range(end=datetime.now(), periods=days)
    returns = rng.normal(0.0003, 0.018, size=days)
    prices = base * np.exp(np.cumsum(returns))

    df = pd.DataFrame(
        {
            "Open": prices * (1 + rng.uniform(-0.005, 0.005, days)),
            "High": prices * (1 + rng.uniform(0.002, 0.02, days)),
            "Low": prices * (1 - rng.uniform(0.002, 0.02, days)),
            "Close": prices,
            "Adj Close": prices,
            "Volume": (rng.uniform(500_000, 50_000_000, days)).astype(int),
        },
        index=dates,
    )
    df.index.name = "Date"
    return df


def _fallback_info(ticker: str) -> dict:
    """Minimal placeholder info when yfinance metadata is unavailable."""
    _SECTORS = {
        "AAPL": ("Apple Inc.", "Technology", "Consumer Electronics"),
        "MSFT": ("Microsoft Corp.", "Technology", "Software—Infrastructure"),
        "GOOGL": ("Alphabet Inc.", "Technology", "Internet Content & Information"),
        "AMZN": ("Amazon.com Inc.", "Consumer Cyclical", "Internet Retail"),
        "NVDA": ("NVIDIA Corp.", "Technology", "Semiconductors"),
        "TSLA": ("Tesla Inc.", "Consumer Cyclical", "Auto Manufacturers"),
        "META": ("Meta Platforms Inc.", "Technology", "Internet Content & Information"),
        "JPM": ("JPMorgan Chase & Co.", "Financial Services", "Banks—Diversified"),
        "V": ("Visa Inc.", "Financial Services", "Credit Services"),
        "JNJ": ("Johnson & Johnson", "Healthcare", "Drug Manufacturers"),
        "WMT": ("Walmart Inc.", "Consumer Defensive", "Discount Stores"),
        "PG": ("Procter & Gamble Co.", "Consumer Defensive", "Household Products"),
        "XOM": ("Exxon Mobil Corp.", "Energy", "Oil & Gas Integrated"),
        "UNH": ("UnitedHealth Group", "Healthcare", "Healthcare Plans"),
        "HD": ("Home Depot Inc.", "Consumer Cyclical", "Home Improvement Retail"),
    }
    name, sector, industry = _SECTORS.get(ticker, (ticker, "Unknown", "Unknown"))
    return {
        "ticker": ticker,
        "name": name,
        "sector": sector,
        "industry": industry,
        "market_cap": 0,
        "country": "US",
        "website": "",
        "description": "",
    }
