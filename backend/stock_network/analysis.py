"""
Stock relationship analysis module.
Computes multiple correlation types: Pearson, Spearman, Kendall, rolling correlations, and Granger causality.
"""

import pandas as pd
import numpy as np
from scipy.stats import pearsonr, spearmanr, kendalltau
import logging
from typing import Dict, Tuple, List

logger = logging.getLogger(__name__)


def compute_correlation_matrix(returns: pd.DataFrame, method: str = 'pearson') -> pd.DataFrame:
    """
    Compute correlation matrix between all stock pairs.
    Supports multiple methods: pearson, spearman, kendall
    
    Args:
        returns: DataFrame of returns
        method: 'pearson', 'spearman', or 'kendall'
    
    Returns:
        Correlation matrix (symmetric)
    """
    if method not in ['pearson', 'spearman', 'kendall']:
        method = 'pearson'
    
    try:
        correlation = returns.corr(method=method)
        logger.info(f"Computed {method} correlation matrix: {correlation.shape}")
        return correlation
    except Exception as e:
        logger.warning(f"Failed to compute {method} correlation: {e}, falling back to pearson")
        return returns.corr(method='pearson')


def compute_rolling_correlation(returns: pd.DataFrame, window: int = 20) -> Dict[Tuple[str, str], float]:
    """
    Compute rolling correlation to capture time-varying relationships.
    
    Args:
        returns: DataFrame of returns
        window: Rolling window size (days)
    
    Returns:
        Dict with average rolling correlation between pairs
    """
    tickers = returns.columns.tolist()
    rolling_corrs = {}
    
    for i, ticker_a in enumerate(tickers):
        for ticker_b in tickers[i+1:]:
            try:
                # Calculate rolling correlation
                rolling = returns[ticker_a].rolling(window).corr(returns[ticker_b])
                # Take mean of rolling correlations, ignoring NaN
                mean_rolling = rolling.dropna().mean()
                
                if not np.isnan(mean_rolling):
                    rolling_corrs[(ticker_a, ticker_b)] = mean_rolling
            except Exception as e:
                logger.debug(f"Rolling correlation failed for {ticker_a}-{ticker_b}: {e}")
    
    logger.info(f"Computed rolling correlations for {len(rolling_corrs)} pairs")
    return rolling_corrs


def compute_multivariate_correlation(returns: pd.DataFrame) -> pd.DataFrame:
    """
    Compute correlation using Spearman's rank correlation (robust to outliers).
    
    Args:
        returns: DataFrame of returns
    
    Returns:
        Spearman correlation matrix
    """
    return compute_correlation_matrix(returns, method='spearman')


def compute_lagged_correlation(
    returns: pd.DataFrame,
    max_lag: int = 5,
    min_overlap: int = 20
) -> Dict[Tuple[str, str], Dict]:
    """
    Compute lagged correlations between all stock pairs.
    Identifies if one stock leads another.
    Uses multiple correlation measures for robustness.
    
    Args:
        returns: DataFrame of returns
        max_lag: Maximum lag to test (±max_lag days)
        min_overlap: Minimum overlapping points for correlation
    
    Returns:
        Dict with structure:
        {(ticker_a, ticker_b): {'lag': -2, 'pearson': 0.65, 'spearman': 0.68, 'direction': 'A→B'}}
    """
    tickers = returns.columns.tolist()
    lagged_corr = {}
    
    for i, ticker_a in enumerate(tickers):
        for ticker_b in tickers[i+1:]:
            
            series_a = returns[ticker_a].values
            series_b = returns[ticker_b].values
            
            best_lag = 0
            best_corr = 0
            best_spearman = 0
            best_direction = None
            best_corr_dict = {}
            
            # Test all lags
            for lag in range(-max_lag, max_lag + 1):
                if lag < 0:
                    # A leads B (shift B backward)
                    a = series_a[:len(series_b) + lag]
                    b = series_b[-len(series_b) - lag:]
                    direction_str = f"{ticker_a}→{ticker_b}"
                elif lag > 0:
                    # B leads A (shift A backward)
                    a = series_a[lag:]
                    b = series_b[:len(series_a) - lag]
                    direction_str = f"{ticker_b}→{ticker_a}"
                else:
                    # No lag
                    a = series_a
                    b = series_b
                    direction_str = f"{ticker_a}←→{ticker_b}"
                
                if len(a) < min_overlap or len(b) < min_overlap:
                    continue
                
                # Compute multiple correlations
                corrs_dict = {}
                try:
                    pearson_corr, _ = pearsonr(a, b)
                    corrs_dict['pearson'] = pearson_corr
                except:
                    pearson_corr = 0
                
                try:
                    spearman_corr, _ = spearmanr(a, b)
                    corrs_dict['spearman'] = spearman_corr
                except:
                    spearman_corr = 0
                
                try:
                    kendall_corr, _ = kendalltau(a, b)
                    corrs_dict['kendall'] = kendall_corr
                except:
                    kendall_corr = 0
                
                # Use average of correlation methods for robustness
                avg_corr = np.mean([abs(v) for v in corrs_dict.values()])
                
                if avg_corr > abs(best_corr):
                    best_corr = pearson_corr
                    best_spearman = spearman_corr
                    best_lag = lag
                    best_direction = direction_str
                    best_corr_dict = corrs_dict
            
            # Store significant correlations (lower threshold for synthetic data)
            if best_lag != 0 or abs(best_corr) > 0.15 or abs(best_spearman) > 0.15:
                lagged_corr[(ticker_a, ticker_b)] = {
                    'lag': best_lag,
                    'correlation': best_corr,
                    'spearman': best_spearman,
                    'direction': best_direction,
                    'abs_correlation': abs(best_corr),
                    'avg_correlation': np.mean([abs(v) for v in best_corr_dict.values()]),
                }
    
    logger.info(f"Computed lagged correlations for {len(lagged_corr)} pairs")
    return lagged_corr


def compute_granger_causality(
    returns: pd.DataFrame,
    max_lag: int = 3,
    significance_level: float = 0.05
) -> Dict[Tuple[str, str], Dict]:
    """
    Test Granger causality between stock pairs using statsmodels.
    Tests if X Granger-causes Y (X helps predict Y).
    
    Args:
        returns: DataFrame of returns
        max_lag: Maximum lag for Granger test
        significance_level: p-value threshold
    
    Returns:
        Dict with Granger causality results
    """
    try:
        from statsmodels.tsa.stattools import grangercausalitytests
    except ImportError:
        logger.warning("statsmodels not installed. Skipping Granger causality.")
        return {}
    
    tickers = returns.columns.tolist()
    granger_results = {}
    
    for i, ticker_x in enumerate(tickers):
        for ticker_y in tickers:
            if ticker_x == ticker_y:
                continue
            
            try:
                # Prepare data: [y, x] format
                data = returns[[ticker_y, ticker_x]].values
                
                # Run Granger causality test
                gc_test = grangercausalitytests(data, max_lag, verbose=False)
                
                # Get p-values for different lags
                p_values = [gc_test[lag][0]['ssr_ftest'][1] for lag in range(1, max_lag + 1)]
                min_p_value = min(p_values)
                best_lag = p_values.index(min_p_value) + 1
                
                if min_p_value < significance_level:
                    granger_results[(ticker_x, ticker_y)] = {
                        'p_value': min_p_value,
                        'lag': best_lag,
                        'causality': True,
                    }
            except Exception as e:
                logger.debug(f"Granger causality failed for {ticker_x}→{ticker_y}: {e}")
                continue
    
    logger.info(f"Computed Granger causality: {len(granger_results)} significant pairs")
    return granger_results


def filter_edges(
    lagged_corr: Dict,
    min_correlation: float = 0.2
) -> Dict:
    """
    Filter edges to include only significant correlations.
    Uses average of multiple correlation measures for robustness.
    
    Args:
        lagged_corr: Output from compute_lagged_correlation()
        min_correlation: Minimum average correlation to include
    
    Returns:
        Filtered dictionary with only strong correlations
    """
    filtered = {}
    for key, val in lagged_corr.items():
        # Use avg_correlation if available (multi-method), otherwise abs_correlation
        corr_value = val.get('avg_correlation', val.get('abs_correlation', 0))
        if corr_value >= min_correlation:
            filtered[key] = val
    
    logger.info(f"Filtered to {len(filtered)} edges (min_corr={min_correlation})")
    return filtered
