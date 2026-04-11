# Quick Start Guide

## Overview

This workspace contains **Two Independent Systems**:

1. **Trading Agent** (`main.py`) - Interactive terminal chatbot for investment analysis
2. **Stock Network Analyzer** (`stock_network/`) - Visualization tool for stock relationships

---

## System 1: Trading Agent (Terminal Chatbot)

### Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables (if using NVIDIA LLaMA API)
export NVIDIA_API_KEY="your_key_here"
export TAVILY_API_KEY="your_key_here"  # Optional, falls back to mock news
```

### Running

```bash
python main.py
```

### How to Use

```
Initial Setup: Loading market data for AAPL, MSFT, GOOGL...
Connected to LLaMA 3.1 70B (NVIDIA API)

You: Should I buy Apple stock right now?

[System analyzes with 3-node pipeline]

Agent: Based on current market conditions...
Risk Level: Medium
Recommendation: HOLD
Confidence: 65%

You: What's happening with tech stocks?

Agent: The tech sector is showing...
```

### Pipeline Architecture

```
User Input 
    ↓
fetch_data_node() → [Market prices from yfinance] + [News articles]
    ↓
market_agent() → Analyzes price trends
    ↓
news_agent() → Analyzes recent news
    ↓
risk_agent() → Final recommendation (BUY/HOLD/SELL)
    ↓
Formatted Output
```

### Key Features

- ✅ Real market data (yfinance)
- ✅ Automatic fallback to mock data if API fails
- ✅ Structured agent reasoning
- ✅ Risk assessment
- ✅ Clean terminal interface (no logs)

---

## System 2: Stock Network Analyzer (Web UI)

### Installation

```bash
# From the main directory
cd stock_network

# Install dependencies
pip install -r requirements.txt

# Or install globally if already in trading agent env
pip install streamlit plotly yfinance scipy statsmodels
```

### Running

#### Option A: Interactive Web UI (Recommended)

```bash
streamlit run app.py
```

Opens browser at `http://localhost:8501`

**Interface:**
- **Sidebar**: Enter tickers, select period, adjust parameters
- **Tab 1**: Network graph (visual relationships)
- **Tab 2**: Correlation matrix (heatmap)
- **Tab 3**: Lagged correlations (with lag detection)
- **Tab 4**: Time series comparison (overlay charts)
- **Tab 5**: Summary statistics (downloadable CSV)

#### Option B: Standalone Script

```bash
python demo.py AAPL,MSFT,GOOGL,NVDA
```

Outputs analysis in terminal:
- Stock data fetch status
- Return statistics
- Correlation matrix
- Lagged correlation results
- Network metrics
- Detected clusters

### Web UI Walkthrough

1. **Enter Tickers** (sidebar)
   ```
   AAPL,MSFT,GOOGL,NVDA,TSLA
   ```

2. **Select Analysis Period**
   ```
   Default: 6 months
   Options: 1mo, 3mo, 6mo, 1y, 2y
   ```

3. **Set Parameters** (sidebar)
   ```
   Max Lag: 5 days (how far to look for delayed correlations)
   Min Correlation: 0.5 (threshold for relationships)
   ```

4. **Click "Analyze Relationships"**

5. **Explore Results**:
   - **Network Tab**: Drag nodes to explore, hover for details
   - **Lagged Tab**: See which stock leads/lags which
   - **Time Series**: Pick 2 stocks to compare side-by-side
   - **Stats Tab**: Download data as CSV

### Analysis Techniques

#### 1. Correlation Matrix
Standard Pearson correlation between all stock pairs.

```
         AAPL   MSFT  GOOGL
AAPL    1.000  0.750  0.680
MSFT    0.750  1.000  0.620
GOOGL   0.680  0.620  1.000
```

#### 2. Lagged Correlation ⭐
Identifies if one stock LEADS another by N days.

```
AAPL → MSFT with lag +1 day and correlation 0.65
  → Means: AAPL's movement today predicts MSFT +1 day later

MSFT → AAPL with lag -2 days and correlation 0.58
  → Means: MSFT movement 2 days ago predicted AAPL today
```

#### 3. Granger Causality (Optional)
Statistical test for causal relationships (not just correlation).

#### 4. Network Clustering
Detects groups of highly-correlated stocks.

```
Cluster 1: [AAPL, MSFT, NVDA]  (Tech leaders)
Cluster 2: [GOOGL, META]        (Ad-tech)
Cluster 3: [TSLA]               (Isolated)
```

### Output Interpretation

**Green Edges**: Positive correlation (stocks move together)
**Red Edges**: Negative correlation (stocks move opposite)
**Node Size**: Popularity (degree centrality)
**Node Color**: Cluster membership

---

## Advanced Usage

### Trading Agent + Stock Network Integration

Combine both systems:

```python
# 1. Analyze stock relationships
# Use stock_network/app.py to find correlated stocks

# 2. Feed insights into trading agent
# Ask trading agent: "What's your view on AAPL knowing it correlates with MSFT?"

# 3. Get enhanced decision
# Agent uses both individual analysis + relationship insights
```

### Programmatic Access

#### Trading Agent

```python
from src.trading_agent.graph import create_graph

# Create and run graph
graph = create_graph()
state = graph.invoke({
    "query": "Should I buy tech stocks?",
    "symbols": ["AAPL", "MSFT", "GOOGL"]
})
print(state["final_decision"])
```

#### Stock Network

```python
from stock_network.data_fetch import fetch_stock_data
from stock_network.analysis import compute_lagged_correlation

# Fetch data
data = fetch_stock_data(['AAPL', 'MSFT'])

# Analyze
lagged_corr = compute_lagged_correlation(data)
print(lagged_corr)
```

---

## Troubleshooting

### Trading Agent Issues

**"ModuleNotFoundError: No module named 'langchain'"**
```bash
pip install langchain langchain-community langchain-nvidia-ai-endpoints
```

**"NVIDIA_API_KEY not found"**
```bash
export NVIDIA_API_KEY="your_key_from_build.nvidia.com"
```

**"yfinance not working"**
```bash
# System automatically falls back to mock data
# Check internet connection
pip install --upgrade yfinance
```

### Stock Network Issues

**"ModuleNotFoundError: No module named 'streamlit'"**
```bash
cd stock_network
pip install -r requirements.txt
```

**"Port 8501 already in use"**
```bash
streamlit run app.py --server.port=8502
```

**"No data returned for ticker"**
- Check ticker is correct (AAPL not apple)
- yfinance may be blocked in your region
- Try shorter period (1mo instead of 2y)

---

## Performance Tips

### For Trading Agent
- Limit symbols to 3-5 for faster analysis
- Use cached market data (rerun within 5 minutes)
- Disable news search if internet is slow (falls back to mock)

### For Stock Network
- Start with 5-10 tickers
- Use 6-month period for good balance (speed vs data)
- Increase lag window only if looking for specific patterns
- Export statistics for further Excel analysis

---

## Project Structure

```
III5.0/
├── main.py                           # Trading agent chatbot
├── requirements.txt                  # Dependencies
├── QUICKSTART.md                     # This file
│
├── src/trading_agent/
│   ├── agents.py                     # 3 core agents
│   ├── graph.py                      # LangGraph pipeline
│   ├── state.py                      # State schema
│   ├── config.py                     # Configuration
│   ├── tools/
│   │   ├── market_data.py           # yfinance wrapper
│   │   └── web_search.py            # News retrieval
│   └── memory/
│       └── long_term.py             # Memory persistence
│
└── stock_network/                    # Stock relationship analyzer
    ├── app.py                        # Streamlit web UI
    ├── demo.py                       # Standalone script
    ├── data_fetch.py                # yfinance wrapper
    ├── processing.py                # Data transformation
    ├── analysis.py                  # Correlation analysis
    ├── graph_builder.py             # Network construction
    ├── visualization.py             # Plotly charts
    ├── __init__.py                  # Package init
    ├── requirements.txt             # Dependencies
    └── README.md                    # Full documentation
```

---

## Next Steps

### 1. Quick Test
```bash
# Terminal 1: Test trading agent
python main.py

# Terminal 2: Test stock network (from stock_network/)
python demo.py AAPL,MSFT

# Terminal 3: Full web UI
cd stock_network && streamlit run app.py
```

### 2. Customization
- Edit system prompts in `src/trading_agent/agents.py`
- Add new visualization types in `stock_network/visualization.py`
- Modify lag range in `stock_network/analysis.py` (line with `max_lag`)

### 3. Integration
- Run both simultaneously for multi-perspective analysis
- Create hybrid dashboard combining both outputs
- Build notification system based on findings

---

## Resources

- **LangGraph Docs**: https://python.langchain.com/docs/langgraph/
- **yfinance**: https://github.com/ranaroussi/yfinance
- **Streamlit**: https://docs.streamlit.io/
- **NetworkX**: https://networkx.org/documentation/
- **Plotly**: https://plotly.com/python/

---

## Support

For issues:
1. Check troubleshooting section above
2. Review README files in each module
3. Check module docstrings: `python -c "import module; help(module)"`
4. Run demo script first to validate setup

Happy analyzing! 🚀
