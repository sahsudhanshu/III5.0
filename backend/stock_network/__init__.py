"""
Stock Network Analyzer Package
Analyzes and visualizes relationships between stocks based on price movements.
"""

__version__ = "1.0.0"
__author__ = "Quant Developer"

from .data_fetch import fetch_stock_data, align_data, get_close_prices
from .processing import compute_returns, normalize_data, get_summary_stats
from .analysis import (
    compute_correlation_matrix,
    compute_lagged_correlation,
    compute_granger_causality,
)
from .graph_builder import build_graph, get_graph_metrics, identify_clusters

__all__ = [
    'fetch_stock_data',
    'align_data',
    'get_close_prices',
    'compute_returns',
    'normalize_data',
    'get_summary_stats',
    'compute_correlation_matrix',
    'compute_lagged_correlation',
    'compute_granger_causality',
    'build_graph',
    'get_graph_metrics',
    'identify_clusters',
]
