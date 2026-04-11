"""
Data processing module.
Computes returns, normalizes data, and handles preprocessing.
"""

import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)


def compute_returns(prices: pd.DataFrame, method: str = "log") -> pd.DataFrame:
    """
    Compute daily returns from price data.
    
    Args:
        prices: DataFrame with prices (rows=dates, cols=tickers)
        method: 'log' for log returns, 'pct' for percentage returns
    
    Returns:
        DataFrame with daily returns
    """
    if method == "log":
        returns = np.log(prices / prices.shift(1))
    elif method == "pct":
        returns = prices.pct_change()
    else:
        raise ValueError("method must be 'log' or 'pct'")
    
    # Remove first row (NaN)
    returns = returns.dropna()
    
    logger.info(f"Computed {method} returns: {returns.shape}")
    return returns


def normalize_data(data: pd.DataFrame, method: str = "zscore") -> pd.DataFrame:
    """
    Normalize data using zscore or minmax scaling.
    
    Args:
        data: DataFrame to normalize
        method: 'zscore' or 'minmax'
    
    Returns:
        Normalized DataFrame
    """
    if method == "zscore":
        normalized = (data - data.mean()) / data.std()
    elif method == "minmax":
        normalized = (data - data.min()) / (data.max() - data.min())
    else:
        raise ValueError("method must be 'zscore' or 'minmax'")
    
    logger.info(f"Normalized data using {method}")
    return normalized


def get_summary_stats(returns: pd.DataFrame) -> pd.DataFrame:
    """
    Get summary statistics for each stock return series.
    
    Args:
        returns: DataFrame of returns
    
    Returns:
        DataFrame with stats (mean, std, skew, kurtosis, etc.)
    """
    stats = pd.DataFrame({
        'Mean': returns.mean(),
        'Std': returns.std(),
        'Min': returns.min(),
        'Max': returns.max(),
        'Skew': returns.skew(),
        'Kurtosis': returns.kurtosis(),
    })
    
    logger.info(f"Computed summary statistics")
    return stats
