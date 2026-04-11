from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import threading

from ..config import get_proxy_dict, get_proxy_settings

logger = logging.getLogger(__name__)


def get_market_snapshot(symbols: List[str], timeout: int = 5) -> Dict[str, Any]:
    """
    Get market data snapshot for given symbols.
    Uses yfinance for real data with fast fallback to mock data.
    
    Args:
        symbols: List of ticker symbols (e.g., ['SPY', 'QQQ', 'IWM'])
        timeout: Timeout in seconds for yfinance fetch (default 5)
        
    Returns:
        Dict with market data for each symbol (fallback to mock if timeout/error)
    """
    # Normalize symbols
    normalized = [s.strip().upper() for s in symbols if s and s.strip()]
    
    if not normalized:
        error_msg = "At least one valid symbol is required for market snapshot."
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Try to get real data from yfinance with timeout
    real_data = _fetch_yfinance_data(normalized, timeout)
    
    # Fill in any missing symbols with mock data
    market_data = real_data.copy()
    for symbol in normalized:
        if symbol not in market_data:
            market_data[symbol] = _get_fallback_data(symbol)
    
    logger.info(f"Retrieved market data for {len(market_data)} symbols")
    return market_data


def _fetch_yfinance_data(symbols: List[str], timeout: int = 5) -> Dict[str, Any]:
    """
    Fetch real market data from yfinance with timeout.
    Returns partial results if some symbols fail.
    """
    market_data = {}
    
    try:
        import yfinance as yf
        
        # Get proxy settings for logging
        use_proxy, proxy_address, proxy_port = get_proxy_settings()
        if use_proxy and proxy_address:
            logger.info(f"Attempting market fetch with proxy: {proxy_address}:{proxy_port}")
        
        logger.info(f"Fetching real market data for {len(symbols)} symbols (timeout: {timeout}s)")
        
        for symbol in symbols:
            try:
                # Use threading with timeout
                result = {}
                
                def fetch_ticker():
                    try:
                        ticker = yf.Ticker(symbol)
                        hist = ticker.history(period="1d")
                        info = ticker.info if hasattr(ticker, 'info') else {}
                        
                        if len(hist) > 0:
                            latest = hist.iloc[-1]
                            result['data'] = {
                                "price": float(latest.get('Close', 0)),
                                "open": float(latest.get('Open', 0)),
                                "high": float(latest.get('High', 0)),
                                "low": float(latest.get('Low', 0)),
                                "volume": float(latest.get('Volume', 0)),
                                "change_pct": float(info.get('regularMarketChangePercent', 0)),
                                "pe_ratio": float(info.get('trailingPE', 0)),
                                "market_cap": float(info.get('marketCap', 0)),
                                "52_week_high": float(info.get('fiftyTwoWeekHigh', 0)),
                                "52_week_low": float(info.get('fiftyTwoWeekLow', 0)),
                            }
                            result['success'] = True
                    except Exception as e:
                        result['error'] = str(e)
                        result['success'] = False
                
                thread = threading.Thread(target=fetch_ticker, daemon=True)
                thread.start()
                thread.join(timeout=timeout)
                
                if not thread.is_alive():
                    # Thread completed
                    if result.get('success'):
                        market_data[symbol] = result['data']
                        logger.info(f"✓ Real data for {symbol}: ${market_data[symbol]['price']}")
                    else:
                        logger.warning(f"Failed to fetch {symbol}: {result.get('error')}, using mock data")
                else:
                    # Thread timed out
                    logger.warning(f"Timeout fetching {symbol} ({timeout}s), using mock data")
                    
            except Exception as e:
                logger.warning(f"Error fetching {symbol}: {e}, using mock data")
        
        return market_data
        
    except ImportError:
        logger.info("yfinance not installed, using mock market data")
        return {}
    except Exception as e:
        logger.error(f"Unexpected error: {e}, returning empty for real data")
        return {}


def _get_fallback_data(symbol: str) -> Dict[str, Any]:
    """Generate realistic fallback market data for a symbol."""
    import hashlib
    
    # Generate consistent but varied data based on symbol
    seed = int(hashlib.md5(symbol.encode()).hexdigest(), 16) % 10000
    base_price = 100.0 + (seed % 300)
    
    return {
        "price": round(base_price, 2),
        "open": round(base_price * 0.98, 2),
        "high": round(base_price * 1.02, 2),
        "low": round(base_price * 0.96, 2),
        "volume": 1_000_000 + (seed * 1000),
        "change_pct": round((seed % 5) - 2.5, 2),
        "pe_ratio": round(15.0 + (seed % 10), 1),
        "market_cap": 500_000_000_000 + (seed * 1_000_000),
        "52_week_high": round(base_price * 1.3, 2),
        "52_week_low": round(base_price * 0.7, 2),
    }
