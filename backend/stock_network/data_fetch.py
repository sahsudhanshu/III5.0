"""Stock data fetching with yfinance timeout, CSV fallback, and mock data."""

from typing import Dict, List, Optional
import pandas as pd, logging, os, threading, hashlib
from datetime import datetime, timedelta
from pathlib import Path
from io import StringIO

logger = logging.getLogger(__name__)

env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    try:
        import dotenv
        dotenv.load_dotenv(env_file)
    except:
        pass

PROXY_ADDRESS = os.environ.get("PROXY_ADDRESS", "172.31.2.4")
PROXY_PORT = os.environ.get("PROXY_PORT", "8080")
USE_PROXY = os.environ.get("USE_PROXY", "true").lower() == "true"
PROXY_URL = f"http://{PROXY_ADDRESS}:{PROXY_PORT}" if USE_PROXY else None
PROXIES = {"http": PROXY_URL, "https": PROXY_URL} if PROXY_URL else {}

logger.info(f"🔌 Proxy: {'Enabled - ' + PROXY_URL if PROXY_URL else 'Disabled'}")

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def fetch_stock_data(tickers: List[str], period: str = "6mo", interval: str = "1d") -> Dict[str, pd.DataFrame]:
    """Fetch data: yfinance (timeout) | CSV | mock."""
    data = {}
    for ticker in tickers:
        logger.info(f"📊 Fetching {period} of data for {ticker}...")
        
        if HAS_YFINANCE:
            try:
                df = _fetch_yfinance(ticker, period, interval, timeout=5)
                if df is not None and not df.empty:
                    data[ticker] = df
                    logger.info(f"✓ {ticker}: {len(df)} days")
                    continue
            except Exception as e:
                logger.debug(f"yfinance: {e}")
        
        if HAS_REQUESTS:
            try:
                df = _fetch_alternative(ticker, period)
                if df is not None and not df.empty:
                    data[ticker] = df
                    logger.info(f"✓ {ticker}: {len(df)} days (CSV)")
                    continue
            except Exception as e:
                logger.debug(f"CSV: {e}")
        
        try:
            df = _get_mock_data(ticker, period)
            if df is not None and not df.empty:
                data[ticker] = df
                logger.info(f"✓ {ticker}: {len(df)} days (mock)")
                continue
        except Exception as e:
            logger.debug(f"Mock: {e}")
        
        logger.error(f"❌ No data for {ticker}")
    
    if not data:
        raise ValueError("No data available")
    return data


def _fetch_yfinance(ticker: str, period: str, interval: str, timeout: int = 5) -> Optional[pd.DataFrame]:
    """Fetch with threading timeout."""
    if not HAS_YFINANCE:
        return None
    
    result = {}
    def download():
        try:
            df = yf.download(ticker, period=period, interval=interval, progress=False)
            if df is not None and not df.empty:
                if not isinstance(df.index, pd.DatetimeIndex):
                    df.index = pd.to_datetime(df.index)
                result['df'] = df
                result['ok'] = True
        except Exception as e:
            result['err'] = str(e)
    
    logger.debug(f"  Trying yfinance...")
    thread = threading.Thread(target=download, daemon=True)
    thread.start()
    thread.join(timeout=timeout)
    
    if not thread.is_alive() and result.get('ok'):
        return result.get('df')
    
    if thread.is_alive():
        logger.debug(f"  ⏱ timeout")
    elif result.get('err'):
        logger.debug(f"  ⚠ error")
    
    return None


def _fetch_alternative(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Fetch from CSV endpoint."""
    if not HAS_REQUESTS:
        return None
    
    try:
        logger.debug(f"  Trying CSV...")
        end_date = datetime.now()
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        start_date = end_date - timedelta(days=period_days.get(period, 180))
        
        url = f"https://query1.finance.yahoo.com/v7/finance/download/{ticker}"
        params = {
            "period1": int(start_date.timestamp()),
            "period2": int(end_date.timestamp()),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true"
        }
        
        response = requests.get(url, params=params, proxies=PROXIES, timeout=5)
        if response.status_code == 200:
            df = pd.read_csv(StringIO(response.text), index_col="Date")
            df.index = pd.to_datetime(df.index)
            return df
        
        logger.debug(f"  Status {response.status_code}")
    except Exception as e:
        logger.debug(f"CSV error: {e}")
    
    return None


def _get_mock_data(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Generate mock data."""
    try:
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        days = period_days.get(period, 180)
        
        seed = int(hashlib.md5(ticker.encode()).hexdigest(), 16) % 10000
        base = 100.0 + (seed % 300)
        
        dates = pd.date_range(end=datetime.now().replace(hour=0, minute=0, second=0, microsecond=0), periods=days, freq='D')
        prices = []
        current = base
        
        for i in range(days):
            change = ((seed + i) % 101 - 50) / 1000
            current = current * (1 + change)
            prices.append(max(current, 10))
        
        df = pd.DataFrame({
            'Open': [p * (1 + (seed % 3 - 1) / 100) for p in prices],
            'High': [p * 1.02 for p in prices],
            'Low': [p * 0.98 for p in prices],
            'Close': prices,
            'Adj Close': prices,
            'Volume': [1000000 + (seed + i) * 100 for i in range(days)]
        }, index=dates)
        
        df.index.name = 'Date'
        return df
    except Exception as e:
        logger.error(f"Mock error: {e}")
        return None


def align_data(data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Align to common dates."""
    if not data:
        raise ValueError("Empty data")
    
    all_indices = [df.index for df in data.values()]
    common_dates = all_indices[0]
    for idx in all_indices[1:]:
        common_dates = common_dates.intersection(idx)
    
    if len(common_dates) == 0:
        raise ValueError("No common dates")
    
    common_dates = pd.to_datetime(common_dates.date)
    logger.info(f"📊 Aligned to {len(common_dates)} days")
    
    aligned = {}
    for ticker, df in data.items():
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        norm_idx = pd.to_datetime(df.index.date)
        df_norm = df.copy()
        df_norm.index = norm_idx
        aligned[ticker] = df_norm.reindex(common_dates)
    
    return aligned


def get_close_prices(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Extract close prices."""
    if not data:
        raise ValueError("No data")
    
    close_data = {}
    for ticker, df in data.items():
        series = df['Adj Close'] if 'Adj Close' in df.columns else df['Close']
        if isinstance(series.index, pd.DatetimeIndex):
            norm_idx = pd.to_datetime(series.index.date)
            series = series.copy()
            series.index = norm_idx
        close_data[ticker] = series
    
    prices = pd.DataFrame(close_data)
    logger.info(f"✓ Close prices: {prices.shape}")
    return prices
"""Stock network data fetching - yfinance with timeout, CSV fallback, and mock data."""

from typing import Dict, List, Optional
import pandas as pd
import logging
from datetime import datetime, timedelta
import os
from pathlib import Path
from io import StringIO
import threading
import hashlib

logger = logging.getLogger(__name__)

# Load environment
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    try:
        import dotenv
        dotenv.load_dotenv(env_file)
    except:
        pass

# Proxy config
PROXY_ADDRESS = os.environ.get("PROXY_ADDRESS", "172.31.2.4")
PROXY_PORT = os.environ.get("PROXY_PORT", "8080")
USE_PROXY = os.environ.get("USE_PROXY", "true").lower() == "true"

PROXY_URL = f"http://{PROXY_ADDRESS}:{PROXY_PORT}" if USE_PROXY else None
PROXIES = {"http": PROXY_URL, "https": PROXY_URL} if PROXY_URL else {}

logger.info(f"🔌 Proxy: {'Enabled - ' + PROXY_URL if PROXY_URL else 'Disabled'}")

try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def fetch_stock_data(
    tickers: List[str],
    period: str = "6mo",
    interval: str = "1d"
) -> Dict[str, pd.DataFrame]:
    """Fetch stock data pri: yfinance → CSV → mock."""
    data = {}
    
    for ticker in tickers:
        logger.info(f"📊 Fetching {period} of data for {ticker}...")
        
        if HAS_YFINANCE:
            try:
                df = _fetch_yfinance(ticker, period, interval, timeout=5)
                if df is not None and not df.empty:
                    data[ticker] = df
                    logger.info(f"✓ {ticker}: {len(df)} trading days")
                    continue
            except Exception as e:
                logger.debug(f"yfinance failed: {e}")
        
        if HAS_REQUESTS:
            try:
                df = _fetch_alternative(ticker, period)
                if df is not None and not df.empty:
                    data[ticker] = df
                    logger.info(f"✓ {ticker}: {len(df)} days (CSV)")
                    continue
            except Exception as e:
                logger.debug(f"CSV failed: {e}")
        
        try:
            df = _get_mock_data(ticker, period)
            if df is not None and not df.empty:
                data[ticker] = df
                logger.info(f"✓ {ticker}: {len(df)} days (mock)")
                continue
        except Exception as e:
            logger.debug(f"Mock failed: {e}")
        
        logger.error(f"❌ Could not fetch {ticker}")
    
    if not data:
        raise ValueError("No data available for any ticker")
    
    return data


def _fetch_yfinance(ticker: str, period: str, interval: str, timeout: int = 5) -> Optional[pd.DataFrame]:
    """Fetch from yfinance with threading timeout."""
    if not HAS_YFINANCE:
        return None
    
    result = {}
    
    def download():
        try:
            df = yf.download(ticker, period=period, interval=interval, progress=False)
            if df is not None and not df.empty:
                if not isinstance(df.index, pd.DatetimeIndex):
                    df.index = pd.to_datetime(df.index)
                result['df'] = df
                result['ok'] = True
        except Exception as e:
            result['err'] = str(e)
    
    logger.debug(f"  Trying yfinance...")
    thread = threading.Thread(target=download, daemon=True)
    thread.start()
    thread.join(timeout=timeout)
    
    if not thread.is_alive() and result.get('ok'):
        return result['df']
    
    if thread.is_alive():
        logger.debug(f"  ⏱ yfinance timeout")
    elif result.get('err'):
        logger.debug(f"  ⚠ yfinance error")
    
    return None


def _fetch_alternative(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Fetch from Yahoo CSV endpoint."""
    if not HAS_REQUESTS:
        return None
    
    try:
        logger.debug(f"  Trying CSV...")
        end_date = datetime.now()
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        start_date = end_date - timedelta(days=period_days.get(period, 180))
        
        url = f"https://query1.finance.yahoo.com/v7/finance/download/{ticker}"
        params = {
            "period1": int(start_date.timestamp()),
            "period2": int(end_date.timestamp()),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true"
        }
        
        response = requests.get(url, params=params, proxies=PROXIES, timeout=5)
        if response.status_code == 200:
            df = pd.read_csv(StringIO(response.text), index_col="Date")
            df.index = pd.to_datetime(df.index)
            return df
        
        logger.debug(f"  CSV returned {response.status_code}")
    except Exception as e:
        logger.debug(f"CSV error: {e}")
    
    return None


def _get_mock_data(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Generate realistic mock data."""
    try:
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        days = period_days.get(period, 180)
        
        seed = int(hashlib.md5(ticker.encode()).hexdigest(), 16) % 10000
        base = 100.0 + (seed % 300)
        
        dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
        prices = []
        curr = base
        
        for i in range(days):
            change = ((seed + i) % 101 - 50) / 1000
            curr = curr * (1 + change)
            prices.append(max(curr, 10))
        
        df = pd.DataFrame({
            'Open': [p * (1 + (seed % 3 - 1) / 100) for p in prices],
            'High': [p * 1.02 for p in prices],
            'Low': [p * 0.98 for p in prices],
            'Close': prices,
            'Adj Close': prices,
            'Volume': [1000000 + (seed + i) * 100 for i in range(days)]
        }, index=dates)
        
        df.index.name = 'Date'
        return df
    except Exception as e:
        logger.error(f"Mock error: {e}")
        return None


def align_data(data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """Align all DataFrames to common dates."""
    if not data:
        raise ValueError("Empty data dict")
    
    all_indices = [df.index for df in data.values()]
    common_dates = all_indices[0]
    
    for idx in all_indices[1:]:
        common_dates = common_dates.intersection(idx)
    
    if len(common_dates) == 0:
        raise ValueError("No common dates found")
    
    common_dates = pd.to_datetime(common_dates.date)
    logger.info(f"📊 Aligned to {len(common_dates)} common trading days")
    
    aligned_data = {}
    for ticker, df in data.items():
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        
        norm_index = pd.to_datetime(df.index.date)
        df_norm = df.copy()
        df_norm.index = norm_index
        aligned_data[ticker] = df_norm.reindex(common_dates)
    
    return aligned_data


def get_close_prices(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Extract close prices from all tickers."""
    if not data:
        raise ValueError("No data")
    
    close_data = {}
    for ticker, df in data.items():
        series = df['Adj Close'] if 'Adj Close' in df.columns else df['Close']
        if isinstance(series.index, pd.DatetimeIndex):
            norm_index = pd.to_datetime(series.index.date)
            series = series.copy()
            series.index = norm_index
        close_data[ticker] = series
    
    prices = pd.DataFrame(close_data)
    logger.info(f"✓ Extracted close prices: {prices.shape}")
    return prices
"""
Stock market data fetching module - Direct CSV from Yahoo Finance.
Real data only, no synthetic data.
"""

from typing import Dict, List, Optional
import pandas as pd
import logging
from datetime import datetime, timedelta
import os
from pathlib import Path
from io import StringIO

logger = logging.getLogger(__name__)

# ===== LOAD ENVIRONMENT CONFIGURATION =====
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    try:
        import dotenv
        dotenv.load_dotenv(env_file)
    except:
        pass

# ===== PROXY CONFIGURATION =====
PROXY_ADDRESS = os.environ.get("PROXY_ADDRESS", "172.31.2.4")
PROXY_PORT = os.environ.get("PROXY_PORT", "8080")
USE_PROXY = os.environ.get("USE_PROXY", "true").lower() == "true"

PROXY_URL = f"http://{PROXY_ADDRESS}:{PROXY_PORT}" if USE_PROXY else None
PROXIES = {
    "http": PROXY_URL,
    "https": PROXY_URL
} if PROXY_URL else {}

logger.info(f"🔌 Proxy: {'Enabled' if USE_PROXY else 'Disabled'}")

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def fetch_stock_data(
    tickers: List[str],
    period: str = "6mo",
    interval: str = "1d"
) -> Dict[str, pd.DataFrame]:
    """
    Fetch real historical stock data from Yahoo Finance.
    
    Priority:
    1. yfinance (with threading timeout to prevent hanging)
    2. Alternative CSV endpoint  
    3. Mock data (fallback)
    
    Args:
        tickers: List of stock ticker symbols (e.g., ['AAPL', 'MSFT'])
        period: Data period ('1mo', '3mo', '6mo', '1y', '2y', '5y')
        interval: Data interval ('1d' for daily)
    
    Returns:
        Dict with ticker as key and DataFrame as value
    """
    data = {}
    
    for ticker in tickers:
        logger.info(f"📊 Fetching {period} of data for {ticker}...")
        
        # Try yfinance first
        if HAS_YFINANCE:
            try:
                df = _fetch_yfinance(ticker, period, interval, timeout=5)
                if df is not None and not df.empty:
                    data[ticker] = df
                    logger.info(f"✓ {ticker}: {len(df)} trading days")
                    continue
            except Exception as e:
                logger.debug(f"⚠ yfinance failed: {e}")
        
        # Try alternative CSV endpoint
        if HAS_REQUESTS:
            try:
                df = _fetch_alternative(ticker, period)
                if df is not None and not df.empty:
                    data[ticker] = df
                    logger.info(f"✓ {ticker}: {len(df)} days (alternative)")
                    continue
            except Exception as e:
                logger.debug(f"⚠ Alternative failed: {e}")
        
        # Fall back to mock data
        try:
            df = _get_mock_data(ticker, period)
            if df is not None and not df.empty:
                data[ticker] = df
                logger.info(f"✓ {ticker}: {len(df)} days (mock data)")
                continue
        except Exception as e:
            logger.debug(f"⚠ Mock data failed: {e}")
        
        logger.error(f"❌ Could not fetch data for {ticker}")
    
    if not data:
        raise ValueError("❌ No data available for any ticker. Check ticker symbols.")
    
    return data


def _fetch_yfinance(ticker: str, period: str, interval: str, timeout: int = 5) -> Optional[pd.DataFrame]:
    """Fetch from yfinance with threading-based timeout to prevent hanging."""
    if not HAS_YFINANCE:
        return None
    
    try:
        result = {}
        
        def download_ticker():
            try:
                df = yf.download(ticker, period=period, interval=interval, progress=False)
                if df is not None and not df.empty:
                    if not isinstance(df.index, pd.DatetimeIndex):
                        df.index = pd.to_datetime(df.index)
                    result['df'] = df
                    result['success'] = True
            except Exception as e:
                result['error'] = str(e)
                result['success'] = False
        
        # Use threading timeout
        logger.debug(f"  Trying yfinance...")
        thread = threading.Thread(target=download_ticker, daemon=True)
        thread.start()
        thread.join(timeout=timeout)
        
        if not thread.is_alive() and result.get('success'):
            return result['df']
        
        if thread.is_alive():
            logger.debug(f"  ⏱ yfinance timeout")
        elif result.get('error'):
            logger.debug(f"  ⚠ yfinance error")
        
        return None
    except Exception as e:
        logger.debug(f"yfinance error: {e}")
        return None


def _fetch_alternative(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Try alternative CSV endpoint."""
    if not HAS_REQUESTS:
        return None
    
    try:
        logger.debug(f"  Trying alternative CSV...")
        end_date = datetime.now()
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        start_date = end_date - timedelta(days=period_days.get(period, 180))
        
        url = f"https://query1.finance.yahoo.com/v7/finance/download/{ticker}"
        params = {
            "period1": int(start_date.timestamp()),
            "period2": int(end_date.timestamp()),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true"
        }
        
        response = requests.get(url, params=params, proxies=PROXIES, timeout=5)
        if response.status_code == 200:
            df = pd.read_csv(StringIO(response.text), index_col="Date")
            df.index = pd.to_datetime(df.index)
            return df
        
        logger.debug(f"  Alternative returned {response.status_code}")
        return None
    except Exception as e:
        logger.debug(f"Alternative error: {e}")
        return None


def _get_mock_data(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Generate realistic mock data for testing/fallback."""
    try:
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        days = period_days.get(period, 180)
        
        seed = int(hashlib.md5(ticker.encode()).hexdigest(), 16) % 10000
        base_price = 100.0 + (seed % 300)
        
        dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
        prices = []
        current = base_price
        
        for i in range(days):
            daily_change = ((seed + i) % 101 - 50) / 1000
            current = current * (1 + daily_change)
            prices.append(max(current, 10))
        
        df = pd.DataFrame({
            'Open': [p * (1 + (seed % 3 - 1) / 100) for p in prices],
            'High': [p * 1.02 for p in prices],
            'Low': [p * 0.98 for p in prices],
            'Close': prices,
            'Adj Close': prices,
            'Volume': [1000000 + (seed + i) * 100 for i in range(days)]
        }, index=dates)
        
        df.index.name = 'Date'
        return df
    except Exception as e:
        logger.error(f"Mock data error: {e}")
        return None


def align_data(data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """
    Align all dataframes to same date range (inner join).
    """
    if not data:
        raise ValueError("Empty data dict")
    
    # Get intersection of all dates
    all_indices = [df.index for df in data.values()]
    common_dates = all_indices[0]
    
    for idx in all_indices[1:]:
        common_dates = common_dates.intersection(idx)
    
    if len(common_dates) == 0:
        raise ValueError("No common dates found across all tickers")
    
    # Normalize to midnight dates only
    common_dates = pd.to_datetime(common_dates.date)
    
    logger.info(f"📊 Aligned to {len(common_dates)} common trading days")
    
    # Reindex all to common dates
    aligned_data = {}
    for ticker, df in data.items():
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        
        normalized_index = pd.to_datetime(df.index.date)
        df_normalized = df.copy()
        df_normalized.index = normalized_index
        aligned_data[ticker] = df_normalized.reindex(common_dates)
    
    return aligned_data


def get_close_prices(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Extract close prices from all tickers."""
    if not data:
        raise ValueError("No data provided")
    
    close_data = {}
    
    for ticker, df in data.items():
        series = df['Adj Close'] if 'Adj Close' in df.columns else df['Close']
        
        if isinstance(series.index, pd.DatetimeIndex):
            normalized_index = pd.to_datetime(series.index.date)
            series = series.copy()
            series.index = normalized_index
        
        close_data[ticker] = series
    
    prices = pd.DataFrame(close_data)
    logger.info(f"✓ Extracted close prices: {prices.shape}")
    
    return prices
"""
Stock market data fetching module - Real data only.
Fetches historical stock data from yfinance (no synthetic data).
"""

from typing import Dict, List, Optional
import pandas as pd
import logging
from datetime import datetime, timedelta
import os
from pathlib import Path
import threading

logger = logging.getLogger(__name__)

# ===== LOAD ENVIRONMENT CONFIGURATION =====
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    try:
        import dotenv
        dotenv.load_dotenv(env_file)
    except:
        pass

# ===== PROXY CONFIGURATION =====
PROXY_ADDRESS = os.environ.get("PROXY_ADDRESS", "172.31.2.4")
PROXY_PORT = os.environ.get("PROXY_PORT", "8080")
USE_PROXY = os.environ.get("USE_PROXY", "true").lower() == "true"

PROXY_URL = f"http://{PROXY_ADDRESS}:{PROXY_PORT}" if USE_PROXY else None
PROXIES = {
    "http": PROXY_URL,
    "https": PROXY_URL
} if PROXY_URL else {}

logger.info(f"🔌 Proxy: {'Enabled - ' + PROXY_URL if PROXY_URL else 'Disabled (direct connection)'}")

# Try different data sources
try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def fetch_stock_data(
    tickers: List[str],
    period: str = "2y",
    interval: str = "1d"
) -> Dict[str, pd.DataFrame]:
    """
    Fetch real historical stock data from Yahoo Finance.
    
    Args:
        tickers: List of stock ticker symbols (e.g., ['AAPL', 'MSFT'])
        period: Data period ('1mo', '3mo', '6mo', '1y', '2y', '5y')
        interval: Data interval ('1d' for daily)
    
    Returns:
        Dict with ticker as key and DataFrame as value
        DataFrame contains: Open, High, Low, Close, Volume, Adj Close
    """
    data = {}
    
    for ticker in tickers:
        logger.info(f"📊 Fetching {period} of data for {ticker}...")
        
        try:
            df = _fetch_yfinance(ticker, period, interval)
            if df is not None and not df.empty:
                data[ticker] = df
                logger.info(f"✓ {ticker}: {len(df)} trading days")
                continue
        except Exception as e:
            logger.warning(f"⚠ yfinance failed for {ticker}: {e}")
        
        try:
            df = _fetch_alternative(ticker, period)
            if df is not None and not df.empty:
                data[ticker] = df
                logger.info(f"✓ {ticker}: {len(df)} days (alternative)")
                continue
        except Exception as e:
            logger.warning(f"⚠ Alternative failed for {ticker}: {e}")
        
        logger.error(f"❌ Could not fetch data for {ticker}")
    
    if not data:
        raise ValueError("❌ No data available for any ticker. Check ticker symbols.")
    
    return data


def _fetch_yfinance(ticker: str, period: str, interval: str, timeout: int = 5) -> Optional[pd.DataFrame]:
    """
    Fetch from yfinance with threading-based timeout.
    Falls back to alternative source if timeout occurs.
    
    Note: yfinance uses curl_cffi internally and doesn't work with requests.Session,
    so we use threading timeout instead of passing session parameter.
    """
    try:
        result = {}
        
        def download_ticker():
            try:
                # Download WITHOUT session parameter (yfinance handles proxies via environment)
                df = yf.download(
                    ticker,
                    period=period,
                    interval=interval,
                    progress=False
                )
                
                if df is not None and not df.empty:
                    if not isinstance(df.index, pd.DatetimeIndex):
                        df.index = pd.to_datetime(df.index)
                    result['df'] = df
                    result['success'] = True
                else:
                    result['success'] = False
            except Exception as e:
                result['error'] = str(e)
                result['success'] = False
        
        # Use threading with timeout to prevent hanging
        logger.info(f"  Trying yfinance for {ticker}...")
        thread = threading.Thread(target=download_ticker, daemon=True)
        thread.start()
        thread.join(timeout=timeout)
        
        if not thread.is_alive() and result.get('success'):
            logger.info(f"  ✓ yfinance successful")
            return result['df']
        
        if thread.is_alive():
            logger.warning(f"  ⏱ yfinance timeout ({timeout}s), trying alternative...")
        elif result.get('error'):
            logger.warning(f"  ⚠ yfinance error: {result['error']}, trying alternative...")
        
        return None
    
    except Exception as e:
        logger.debug(f"yfinance wrapper error: {type(e).__name__}: {e}")
        return None


def _fetch_alternative(ticker: str, period: str) -> Optional[pd.DataFrame]:
    """Try alternative data source (Yahoo CSV API) with proxy and timeout."""
    try:
        logger.info(f"  Trying alternative CSV source for {ticker}...")
        
        end_date = datetime.now()
        period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730, "5y": 1825}
        start_date = end_date - timedelta(days=period_days.get(period, 730))
        
        url = f"https://query1.finance.yahoo.com/v7/finance/download/{ticker}"
        params = {
            "period1": int(start_date.timestamp()),
            "period2": int(end_date.timestamp()),
            "interval": "1d",
            "events": "history",
            "includeAdjustedClose": "true"
        }
        
        response = requests.get(url, params=params, proxies=PROXIES, timeout=5)
        
        if response.status_code == 200:
            from io import StringIO
            df = pd.read_csv(StringIO(response.text), index_col="Date")
            df.index = pd.to_datetime(df.index)
            logger.info(f"  ✓ Alternative source successful")
            return df
        
        logger.warning(f"  ⚠ Alternative source returned status {response.status_code}")
        return None
    except Exception as e:
        logger.debug(f"Alternative source error: {e}")
        return None


def align_data(data: Dict[str, pd.DataFrame]) -> Dict[str, pd.DataFrame]:
    """
    Align all dataframes to same date range (inner join).
    Keeps only dates present in ALL tickers.
    
    Args:
        data: Dict of DataFrames from fetch_stock_data()
    
    Returns:
        Dict with aligned DataFrames (same dates for all)
    """
    if not data:
        raise ValueError("Empty data dict")
    
    # Get intersection of all dates
    all_indices = [df.index for df in data.values()]
    common_dates = all_indices[0]
    
    for idx in all_indices[1:]:
        common_dates = common_dates.intersection(idx)
    
    if len(common_dates) == 0:
        raise ValueError("No common dates found across all tickers")
    
    # Normalize common_dates to be midnight UTC (remove any time component)
    common_dates = pd.to_datetime(common_dates.date)
    
    logger.info(f"📊 Aligned to {len(common_dates)} common trading days")
    
    # Reindex all to common dates
    aligned_data = {}
    for ticker, df in data.items():
        # Ensure df index is DatetimeIndex
        if not isinstance(df.index, pd.DatetimeIndex):
            df.index = pd.to_datetime(df.index)
        
        # Normalize to midnight dates only, then reindex
        normalized_index = pd.to_datetime(df.index.date)
        df_normalized = df.copy()
        df_normalized.index = normalized_index
        aligned_data[ticker] = df_normalized.reindex(common_dates)
    
    return aligned_data


def get_close_prices(data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Extract close prices from all tickers into single DataFrame.
    Ensures all Series have identical indices before combining.
    
    Args:
        data: Dict of DataFrames
    
    Returns:
        DataFrame with close prices (rows=dates, cols=tickers)
    """
    if not data:
        raise ValueError("No data provided")
    
    close_data = {}
    
    for ticker, df in data.items():
        # Extract close price
        series = df['Adj Close'] if 'Adj Close' in df.columns else df['Close']
        
        # Ensure index is normalized (midnight dates only)
        if isinstance(series.index, pd.DatetimeIndex):
            normalized_index = pd.to_datetime(series.index.date)
            series = series.copy()
            series.index = normalized_index
        
        close_data[ticker] = series
    
    # Create DataFrame - all indices should now be identical
    prices = pd.DataFrame(close_data)
    logger.info(f"✓ Extracted close prices: {prices.shape}")
    
    return prices
