from __future__ import annotations

from typing import Any, Dict, List, Optional
import logging
import threading

from ..config import get_proxy_dict, get_proxy_settings

logger = logging.getLogger(__name__)


def get_market_snapshot(symbols: List[str], timeout: int = 5, period: str = "3mo") -> Dict[str, Any]:
    """
    Get comprehensive market data with historical time series for visualization.
    Uses yfinance for real data with fast fallback to mock data.
    
    Args:
        symbols: List of ticker symbols (e.g., ['SPY', 'QQQ', 'IWM'])
        timeout: Timeout in seconds for yfinance fetch (default 5)
        period: Historical period ('1mo', '3mo', '6mo', '1y', etc.) for graphs
        
    Returns:
        Dict with current snapshot + historical arrays for each symbol:
        {
            'symbol': {
                'current': {...latest price data...},
                'history': {
                    'dates': [...], 'open': [...], 'high': [...], 
                    'low': [...], 'close': [...], 'volume': [...]
                },
                'stats': {...52-week stats...}
            }
        }
    """
    # Normalize symbols
    normalized = [s.strip().upper() for s in symbols if s and s.strip()]
    
    if not normalized:
        error_msg = "At least one valid symbol is required for market snapshot."
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Try to get real data from yfinance with timeout
    real_data = _fetch_yfinance_data(normalized, timeout, period)
    
    # Fill in any missing symbols with mock data
    market_data = real_data.copy()
    for symbol in normalized:
        if symbol not in market_data:
            market_data[symbol] = _get_fallback_data(symbol, period)
    
    logger.info(f"Retrieved market data (with history) for {len(market_data)} symbols")
    return market_data


def _fetch_yfinance_data(symbols: List[str], timeout: int = 5, period: str = "3mo") -> Dict[str, Any]:
    """
    Fetch real market data from yfinance with historical time series.
    Returns partial results if some symbols fail.
    """
    market_data = {}
    
    try:
        import yfinance as yf
        
        # Get proxy settings for logging
        use_proxy, proxy_address, proxy_port = get_proxy_settings()
        if use_proxy and proxy_address:
            logger.info(f"Attempting market fetch with proxy: {proxy_address}:{proxy_port}")
        
        logger.info(f"Fetching real market data for {len(symbols)} symbols (period: {period}, timeout: {timeout}s)")
        
        for symbol in symbols:
            try:
                # Use threading with timeout
                result = {}
                
                def fetch_ticker():
                    try:
                        ticker = yf.Ticker(symbol)
                        hist = ticker.history(period=period)
                        info = ticker.info if hasattr(ticker, 'info') else {}
                        
                        if len(hist) > 0:
                            latest = hist.iloc[-1]
                            
                            # Current data
                            current = {
                                "price": float(latest.get('Close', 0)),
                                "open": float(latest.get('Open', 0)),
                                "high": float(latest.get('High', 0)),
                                "low": float(latest.get('Low', 0)),
                                "volume": float(latest.get('Volume', 0)),
                                "change_pct": float(info.get('regularMarketChangePercent', 0)),
                            }
                            
                            # Historical arrays for graphing
                            history = {
                                "dates": [d.strftime("%Y-%m-%d") for d in hist.index],
                                "open": [float(v) for v in hist['Open']],
                                "high": [float(v) for v in hist['High']],
                                "low": [float(v) for v in hist['Low']],
                                "close": [float(v) for v in hist['Close']],
                                "volume": [float(v) for v in hist['Volume']],
                            }
                            
                            # Statistics
                            close_prices = hist['Close'].values
                            stats = {
                                "pe_ratio": float(info.get('trailingPE', 0)),
                                "market_cap": float(info.get('marketCap', 0)),
                                "52_week_high": float(close_prices.max()),
                                "52_week_low": float(close_prices.min()),
                                "avg_volume": float(hist['Volume'].mean()),
                                "volatility": float(hist['Close'].pct_change().std() * 100),  # Annualized %
                            }
                            
                            result['data'] = {
                                "current": current,
                                "history": history,
                                "stats": stats,
                                "data_source": "yfinance"
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
                        logger.info(f"✓ Real data for {symbol}: ${market_data[symbol]['current']['price']}, {len(market_data[symbol]['history']['dates'])} candles")
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


def _get_fallback_data(symbol: str, period: str = "3mo") -> Dict[str, Any]:
    """Generate realistic fallback market data with historical arrays for a symbol."""
    from datetime import datetime, timedelta
    import hashlib
    
    # Generate consistent but varied data based on symbol
    seed = int(hashlib.md5(symbol.encode()).hexdigest(), 16) % 10000
    base_price = 100.0 + (seed % 300)
    
    # Determine number of days based on period
    period_days = {"1mo": 21, "3mo": 63, "6mo": 126, "1y": 252, "2y": 504}
    num_days = period_days.get(period, 63)
    
    # Generate historical data
    dates = []
    prices_open = []
    prices_high = []
    prices_low = []
    prices_close = []
    volumes = []
    
    current_price = base_price
    for i in range(num_days):
        # Date going backwards from today
        date = datetime.now() - timedelta(days=num_days - i - 1)
        dates.append(date.strftime("%Y-%m-%d"))
        
        # Generate realistic OHLCV
        change = ((seed + i) % 101 - 50) / 1000
        current_price = current_price * (1 + change)
        current_price = max(current_price, base_price * 0.5)  # Floor at 50% of base
        
        open_price = current_price * (1 - abs(change) * 0.5)
        high_price = current_price * (1 + abs(change) * 0.3)
        low_price = current_price * (1 - abs(change) * 0.3)
        close_price = current_price
        
        prices_open.append(round(open_price, 2))
        prices_high.append(round(high_price, 2))
        prices_low.append(round(low_price, 2))
        prices_close.append(round(close_price, 2))
        volumes.append(int(1_000_000 + (seed + i) * 100))
    
    # Calculate statistics from historical data
    close_array = prices_close
    min_price = min(close_array)
    max_price = max(close_array)
    
    return {
        "current": {
            "price": round(current_price, 2),
            "open": round(prices_open[-1], 2),
            "high": round(prices_high[-1], 2),
            "low": round(prices_low[-1], 2),
            "volume": volumes[-1],
            "change_pct": round(((current_price - base_price) / base_price) * 100, 2),
        },
        "history": {
            "dates": dates,
            "open": prices_open,
            "high": prices_high,
            "low": prices_low,
            "close": prices_close,
            "volume": volumes,
        },
        "stats": {
            "pe_ratio": round(15.0 + (seed % 10), 1),
            "market_cap": 500_000_000_000 + (seed * 1_000_000),
            "52_week_high": round(max_price, 2),
            "52_week_low": round(min_price, 2),
            "avg_volume": round(sum(volumes) / len(volumes), 0),
            "volatility": round((max_price - min_price) / base_price * 100, 2),
        },
        "data_source": "mock"
    }
