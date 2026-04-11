# Stock Network Relationship Analyzer

A comprehensive Python system for visualizing and analyzing relationships between companies based on stock price correlations and time-lagged influences.

## Features

- 📈 **Interactive Network Visualization**: See how stocks move together
- 🔥 **Correlation Analysis**: Correlation matrices and heatmaps
- ⏱️ **Lagged Correlation**: Identify which stocks lead/follow others
- 📊 **Time Series Comparison**: Compare normalized price movements
- 🎯 **Cluster Detection**: Automatically identify groups of related stocks
- 🔬 **Statistical Analysis**: Granger causality (experimental)
- 📥 **Data Export**: Download analysis results as CSV

## Architecture

```
stock_network/
├── data_fetch.py          # Fetch stock data from yfinance
├── processing.py          # Data normalization and returns
├── analysis.py            # Correlation & lagged correlation
├── graph_builder.py       # NetworkX graph construction
├── visualization.py       # Plotly interactive charts
├── app.py                 # Streamlit web interface
└── README.md
```

## Installation

### 1. Prerequisites
- Python 3.8+
- pip

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Dependencies

```
streamlit>=1.28.0
plotly>=5.30.0
pandas>=2.0.0
numpy>=1.24.0
networkx>=3.1
yfinance>=0.2.32
scipy>=1.11.0
statsmodels>=0.14.0
```

## Quick Start

### Run the Web App

```bash
streamlit run app.py
```

Then open your browser to `http://localhost:8501`

### Using the App

1. **Enter Stock Tickers**: Enter comma-separated ticker symbols (e.g., `AAPL,MSFT,GOOGL,TSLA`)
2. **Configure Parameters**:
   - Select historical data period (1 month to 2 years)
   - Set max lag for correlation analysis (1-10 days)
   - Set minimum correlation threshold (0.0-1.0)
3. **Click "Analyze Relationships"**
4. **Explore Results**:
   - **Network Graph**: Visual representation of stock relationships
   - **Correlation Matrix**: Heatmap of all correlations
   - **Lagged Correlations**: Time-shifted relationships
   - **Time Series**: Compare two stocks side-by-side
   - **Statistics**: Summary stats for returns

## Module Documentation

### data_fetch.py

Fetch and align stock data from Yahoo Finance.

```python
from data_fetch import fetch_stock_data, align_data, get_close_prices

# Fetch data
data = fetch_stock_data(['AAPL', 'MSFT'], period='6mo')

# Align to common dates
aligned_data = align_data(data)

# Extract close prices
prices = get_close_prices(aligned_data)
```

### processing.py

Compute returns and normalize data.

```python
from processing import compute_returns, normalize_data, get_summary_stats

# Compute log returns
returns = compute_returns(prices, method='log')

# Normalize
normalized = normalize_data(returns, method='zscore')

# Statistics
stats = get_summary_stats(returns)
```

### analysis.py

Compute correlations and relationships.

```python
from analysis import (
    compute_correlation_matrix,
    compute_lagged_correlation,
    filter_edges,
)

# Correlation matrix
corr_matrix = compute_correlation_matrix(returns)

# Lagged correlations (identifies leads/lags)
lagged = compute_lagged_correlation(returns, max_lag=5)

# Filter to significant correlations
filtered_edges = filter_edges(lagged, min_correlation=0.5)
```

### graph_builder.py

Build network graphs.

```python
from graph_builder import build_graph, get_graph_metrics, identify_clusters

# Build graph
G = build_graph(tickers, lagged_correlations)

# Get metrics
metrics = get_graph_metrics(G)

# Find clusters
clusters = identify_clusters(G)
```

### visualization.py

Create interactive visualizations.

```python
from visualization import (
    plot_correlation_heatmap,
    plot_network_graph,
    plot_time_series_comparison,
)

# Heatmap
fig1 = plot_correlation_heatmap(correlation_matrix)

# Network graph
fig2 = plot_network_graph(G, lagged_correlations)

# Time series
fig3 = plot_time_series_comparison(returns, 'AAPL', 'MSFT')

# Show in browser
fig1.show()
```

## Understanding Outputs

### Network Graph
- **Nodes**: Each stock
- **Node Size**: Number of connections (degree)
- **Edges**: Correlations between stocks
  - **Green**: Positive correlation (move together)
  - **Red**: Negative correlation (move opposite)
- **Hover**: Shows correlation value, lag, and direction

### Lagged Correlation
- **Lag**: Time shift in days
  - Lag = -2: Stock A leads Stock B by 2 days
  - Lag = +3: Stock B leads Stock A by 3 days
  - Lag = 0: Move together (no lead)
- **Direction**: Shows which stock leads/lags

### Metrics
- **Density**: How connected the network is (0-1, higher = more connected)
- **Components**: Number of separate clusters
- **Centrality**: Which stocks are most influential

## Example Workflows

### Workflow 1: Tech Sector Analysis

```python
tickers = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'TSLA']
period = '6mo'
max_lag = 5
min_correlation = 0.5
```

### Workflow 2: Portfolio Diversification

Find stocks with LOW correlation (good for diversification):

```
Adjust min_correlation = 0.3 (instead of 0.5)
Look for red edges (negative correlation)
Aim for disconnected nodes in the network
```

### Workflow 3: Sector Rotation

Identify leading stocks by lag:

```
Stocks with negative lag (A→B) lead market moves
Stocks with positive lag (B→A) follow market moves
Use to identify trends before they happen
```

## Performance Considerations

- **6 months of data**: ~5-10 seconds
- **1 year of data**: ~10-20 seconds
- **Max tickers**: 15-20 (for clarity)
- **Recommended**: 5-10 tickers for best visualization

## Limitations & Caveats

- **Correlation ≠ Causation**: Strong correlation doesn't mean one causes the other
- **Lagged Correlation**: Uses past patterns; future may differ
- **Granger Causality**: Experimental; requires more validation
- **Data Quality**: Depends on Yahoo Finance data availability
- **Weekend/Holidays**: Auto-aligned to trading days only

## Troubleshooting

### "No data found for ticker"
- Check ticker spelling (must be valid Yahoo Finance symbol)
- Some tickers may not have historical data

### "Lagged correlations are all near zero"
- Try longer time periods (6mo or 1y)
- Reduce max_lag to focus on recent patterns
- Reduce min_correlation threshold

### Graph is too cluttered
- Increase min_correlation threshold (0.6, 0.7)
- Reduce number of tickers
- Use shorter time period

## Future Enhancements

- [ ] Real-time streaming data
- [ ] Sector classification coloring
- [ ] Portfolio optimization suggestions
- [ ] Animated graph over time
- [ ] Alternative correlation methods (Spearman, Kendall)
- [ ] Machine learning clustering
- [ ] Backtesting based on relationships

## Dependencies

- **yfinance**: Stock data
- **pandas**: Data manipulation
- **numpy**: Numerical computing
- **networkx**: Graph structure
- **plotly**: Interactive visualization
- **streamlit**: Web interface
- **scipy**: Statistical functions
- **statsmodels**: Granger causality

## References

- [Correlation Analysis](https://en.wikipedia.org/wiki/Correlation_and_dependence)
- [Granger Causality](https://en.wikipedia.org/wiki/Granger_causality)
- [Network Analysis](https://en.wikipedia.org/wiki/Network_analysis)
- [Financial Returns](https://www.investopedia.com/terms/r/return.asp)

## License

MIT License

## Author

Quant Developer

---

**Version**: 1.0.0  
**Last Updated**: 2026-04-11
