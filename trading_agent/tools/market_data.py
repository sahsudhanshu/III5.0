"""
Market data tool - yfinance integration.

Fetches historical stock prices and market data for trading analysis.
Returns formatted string with price arrays for visualization and analysis.
"""
from __future__ import annotations

from langchain_core.tools import tool
import logging

logger = logging.getLogger(__name__)


@tool
def get_market_snapshot(symbols: list[str], period: str = "3y") -> str:
    """
    Fetch historical stock prices and market data using yfinance.
    
    Returns formatted data suitable for technical analysis, visualization,
    and trading decisions. Includes price arrays spanning multiple years.

    Args:
        symbols: List of stock tickers (e.g., ['AAPL', 'MSFT', 'GOOGL'])
        period: Time period ('1y', '2y', '3y', '5y', 'max'; default '3y')
    
    Returns:
        Formatted string with stock prices, volumes, and statistics as arrays
    """
    print(f"📊 [TOOL] get_market_snapshot called → symbols={symbols!r}, period={period!r}")
    
    if not symbols:
        return "⚠️ Error: No symbols provided"
    
    # Validate period
    valid_periods = ["1y", "2y", "3y", "5y", "max"]
    if period not in valid_periods:
        period = "3y"
        logger.warning(f"Invalid period, defaulting to 3y")
    
    try:
        import yfinance as yf
        import json
    except ImportError:
        return "⚠️ yfinance not installed. Install with: pip install yfinance"
    
    try:
        results = {}
        
        for symbol in symbols:
            try:
                logger.info(f"Fetching data for {symbol} (period: {period})")
                
                # Fetch historical data
                ticker_obj = yf.Ticker(symbol)
                hist = ticker_obj.history(period=period)
                
                if hist.empty:
                    logger.warning(f"No data found for {symbol}")
                    results[symbol] = {
                        "status": "error",
                        "message": f"No historical data available for {symbol}"
                    }
                    continue
                
                # Extract arrays from dataframe
                dates = hist.index.strftime("%Y-%m-%d").tolist()
                opens = hist["Open"].values.tolist()
                highs = hist["High"].values.tolist()
                lows = hist["Low"].values.tolist()
                closes = hist["Close"].values.tolist()
                volumes = hist["Volume"].values.tolist()
                
                # Calculate key statistics
                current_price = closes[-1] if closes else 0
                price_change = closes[-1] - closes[0] if len(closes) > 1 else 0
                price_change_pct = (price_change / closes[0] * 100) if closes[0] != 0 else 0
                
                high_price = max(highs) if highs else 0
                low_price = min(lows) if lows else 0
                avg_volume = sum(volumes) / len(volumes) if volumes else 0
                
                results[symbol] = {
                    "status": "success",
                    "current_price": round(current_price, 2),
                    "price_change": round(price_change, 2),
                    "price_change_pct": round(price_change_pct, 2),
                    "high_52w": round(high_price, 2),
                    "low_52w": round(low_price, 2),
                    "avg_volume": round(avg_volume, 0),
                    "data_points": len(closes),
                    "dates": dates,
                    "opens": [round(v, 2) for v in opens],
                    "highs": [round(v, 2) for v in highs],
                    "lows": [round(v, 2) for v in lows],
                    "closes": [round(v, 2) for v in closes],
                    "volumes": [int(v) for v in volumes],
                }
                logger.info(f"✓ Retrieved {len(closes)} data points for {symbol}")
                
            except Exception as e:
                logger.error(f"Error fetching {symbol}: {e}")
                results[symbol] = {
                    "status": "error",
                    "message": str(e)
                }
        
        # Format output as readable string
        lines = [f"📊 Market Data Snapshot (Period: {period})\n"]
        
        for symbol, data in results.items():
            if data.get("status") == "error":
                lines.append(f"❌ {symbol}: {data.get('message')}\n")
            else:
                lines.append(f"\n**{symbol}**")
                lines.append(f"  Current Price: ${data['current_price']}")
                lines.append(f"  Change: ${data['price_change']} ({data['price_change_pct']:+.2f}%)")
                lines.append(f"  52-Week Range: ${data['low_52w']} - ${data['high_52w']}")
                lines.append(f"  Avg Volume: {data['avg_volume']:,.0f}")
                lines.append(f"  Data Points: {data['data_points']}")
                lines.append(f"  Date Range: {data['dates'][0]} to {data['dates'][-1]}")
                
                # Provide array info
                lines.append(f"\n  Arrays available:")
                lines.append(f"    - {len(data['dates'])} dates")
                lines.append(f"    - {len(data['closes'])} close prices")
                lines.append(f"    - {len(data['opens'])} open prices")
                lines.append(f"    - {len(data['highs'])} high prices")
                lines.append(f"    - {len(data['lows'])} low prices")
                lines.append(f"    - {len(data['volumes'])} volume records\n")
        
        # Add JSON representation at the end for programmatic access
        lines.append(f"\n**Raw Data (JSON):**\n```json\n{json.dumps(results, indent=2)}\n```")
        
        return "\n".join(lines)
        
    except Exception as e:
        logger.error(f"Market snapshot error: {e}")
        return f"⚠️ Market data fetch failed: {e}"
