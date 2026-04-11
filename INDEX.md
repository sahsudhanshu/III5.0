# System Index & Architecture Guide

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [Getting Started](#getting-started)
4. [System Descriptions](#system-descriptions)
5. [Running Each System](#running-each-system)
6. [Architecture Diagrams](#architecture-diagrams)

---

## Project Overview

This workspace contains **Two Complementary Systems**:

### 🤖 **Trading Agent** 
A terminal-based chatbot for investment analysis using LangGraph and NVIDIA LLaMA 3.1 70B.

### 📊 **Stock Network Analyzer**
A web-based visualization tool for analyzing relationships between stock prices.

Both systems use **yfinance** for real market data and are designed to be run independently or in parallel.

---

## File Structure

```
III5.0/
│
├── 📄 QUICKSTART.md                    ← START HERE: Setup & usage guide
├── 📄 README.md                        ← Project overview
├── 📄 INDEX.md                         ← This file
│
├── 🔧 VALIDATION & TESTING
│   ├── validate_system.py              ← Run this first! Checks all dependencies
│   ├── validate_pipeline.py            ← Tests trading agent pipeline
│   └── test_pipeline.py                ← Integration tests
│
├── 🤖 TRADING AGENT (Terminal Chatbot)
│   ├── main.py                         ← Entry point: `python main.py`
│   ├── requirements.txt                ← Python dependencies
│   ├── .env.example                    ← API key template
│   │
│   └── src/trading_agent/              ← Core agent modules
│       ├── __init__.py
│       ├── agents.py                   ← 3 agents: market, news, risk
│       ├── graph.py                    ← LangGraph: 4-node pipeline
│       ├── state.py                    ← State schema
│       ├── config.py                   ← Configuration
│       │
│       ├── tools/
│       │   ├── market_data.py          ← yfinance wrapper + fallback
│       │   └── web_search.py           ← Tavily API + mock fallback
│       │
│       └── memory/
│           └── long_term.py            ← SQLite persistence
│
├── 📊 STOCK NETWORK (Web UI + Script)
│   ├── app.py                          ← Streamlit UI: `streamlit run app.py`
│   ├── demo.py                         ← Script: `python demo.py`
│   │
│   ├── data_fetch.py                   ← Fetch & align stock data
│   ├── processing.py                   ← Returns & normalization
│   ├── analysis.py                     ← Correlation & lagged correlation
│   ├── graph_builder.py                ← NetworkX graph construction
│   ├── visualization.py                ← Plotly interactive charts
│   │
│   ├── __init__.py                     ← Package init
│   ├── requirements.txt                ← Dependencies
│   └── README.md                       ← Full documentation
│
└── 📊 METADATA
    ├── trading_memory.db               ← SQLite memory cache
    ├── CHANGES_SUMMARY.md              ← Recent modifications log
    └── .gitignore                      ← Git configuration
```

---

## Getting Started

### 1️⃣ Quick Validation (5 minutes)

```bash
# Test that everything is properly set up
python validate_system.py
```

✅ This checks:
- All Python packages installed
- All required files present
- Module imports work
- Quick demo runs successfully

### 2️⃣ Trading Agent Setup (2 minutes)

```bash
# Set your API keys
export NVIDIA_API_KEY="your_key_from_build.nvidia.com"
export TAVILY_API_KEY="your_key_optional"  # Optional, falls back to mock

# Or create a .env file (see .env.example)
```

Then run:
```bash
python main.py
```

### 3️⃣ Stock Network Setup (2 minutes)

```bash
cd stock_network

# Quick test (terminal output)
python demo.py AAPL,MSFT

# Or interactive web UI
streamlit run app.py
```

---

## System Descriptions

### Trading Agent Architecture

```
┌─────────────────────────────────────┐
│   User Query (Terminal Chatbot)     │
└────────────────┬────────────────────┘
                 │ "Should I buy AAPL?"
                 ▼
┌─────────────────────────────────────┐
│   fetch_data_node()                 │
│  ├─ Get latest prices (yfinance)    │
│  └─ Get latest news (Tavily/mock)   │
└────────────────┬────────────────────┘
                 │
                 ▼ [market_context + news_articles]
┌─────────────────────────────────────┐
│   market_agent()                    │
│  Analyzes: price trends, volatility │
│  Output: Market analysis            │
└────────────────┬────────────────────┘
                 │
                 ▼ [market_analysis]
┌─────────────────────────────────────┐
│   news_agent()                      │
│  Analyzes: recent news, sentiment   │
│  Output: News sentiment             │
└────────────────┬────────────────────┘
                 │
                 ▼ [news_sentiment]
┌─────────────────────────────────────┐
│   risk_agent()                      │
│  Makes: Final recommendation        │
│  Outputs: BUY / HOLD / SELL         │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│   Formatted Response                │
│  ├─ Recommendation: HOLD            │
│  ├─ Risk Level: MEDIUM              │
│  └─ Confidence: 65%                 │
└─────────────────────────────────────┘
```

### Stock Network Architecture

```
┌──────────────────────────────────────┐
│  User Input (Web UI or Script)       │
│  Tickers: AAPL,MSFT,GOOGL,NVDA,TSLA │
│  Period: 6 months                    │
└────────────┬─────────────────────────┘
             │
             ▼ data_fetch.py
┌──────────────────────────────────────┐
│  Fetch Stock Data (yfinance)         │
│  Output: OHLCV time series per stock │
└────────────┬─────────────────────────┘
             │
             ▼ processing.py
┌──────────────────────────────────────┐
│  Transform Data                      │
│  ├─ Compute daily returns            │
│  ├─ Normalize values                 │
│  └─ Summary statistics               │
└────────────┬─────────────────────────┘
             │
             ▼ analysis.py (3 methods)
┌──────────────────────────────────────┐
│  CORRELATION ANALYSIS                │
│  1. Pearson Correlation Matrix       │
│     ├─ All pairs compared            │
│     └─ Shows co-movement             │
│                                      │
│  2. Lagged Correlation (STAR)        │
│     ├─ Tests -5 to +5 day lags       │
│     ├─ Identifies leads/lags         │
│     └─ Ex: AAPL→MSFT +1 day, r=0.65  │
│                                      │
│  3. Granger Causality (Optional)     │
│     ├─ Statistical causality test    │
│     └─ Not just correlation          │
└────────────┬─────────────────────────┘
             │
             ▼ graph_builder.py
┌──────────────────────────────────────┐
│  Build Network Graph (NetworkX)      │
│  ├─ Nodes: stock tickers             │
│  ├─ Edges: correlations > threshold  │
│  ├─ Edge color: green (pos), red (neg)
│  └─ Community detection (clusters)   │
└────────────┬─────────────────────────┘
             │
             ▼ visualization.py
┌──────────────────────────────────────┐
│  Generate Visualizations (Plotly)    │
│  ├─ Interactive network graph        │
│  ├─ Correlation heatmap              │
│  ├─ Lagged correlation table         │
│  └─ Time series comparison plots     │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│  Display Results                     │
│  Streamlit UI: 5 interactive tabs    │
│  Script: Terminal-formatted output   │
│  Export: CSV statistics download     │
└──────────────────────────────────────┘
```

---

## Running Each System

### 🤖 Trading Agent

#### Quick Start
```bash
python main.py
```

#### Interface
```
You: Should I invest in tech stocks now?

[System analyzes...]

Agent: The tech sector shows mixed signals...
       Market sentiment is cautious due to recent Fed statements.
       
Recommendation: HOLD
Risk Level: MEDIUM
Confidence: 68%

You: What about Apple specifically?
```

#### Features
- ✅ Real market prices (yfinance)
- ✅ Latest financial news (Tavily or mock)
- ✅ LLM-powered analysis (NVIDIA LLaMA 3.1 70B)
- ✅ Risk assessment
- ✅ Clean terminal UI
- ✅ Automatic fallbacks on API failures

---

### 📊 Stock Network Analyzer

#### Option 1: Interactive Web UI (Recommended)

```bash
cd stock_network
streamlit run app.py

# Opens: http://localhost:8501
```

**Features:**
- Sidebar config (tickers, period, parameters)
- Tab 1: Interactive network visualization
- Tab 2: Correlation heatmap
- Tab 3: Lagged correlation summary
- Tab 4: Time series comparison tool
- Tab 5: Statistics with CSV export

#### Option 2: Standalone Script

```bash
cd stock_network
python demo.py AAPL,MSFT,GOOGL,NVDA,TSLA

# Or with defaults
python demo.py
```

**Output:**
```
================================================================================
                         STOCK NETWORK RELATIONSHIP ANALYZER
================================================================================

Analyzing: AAPL, MSFT, GOOGL, NVDA, TSLA
Period: 6mo | Max Lag: 5 days

================================================================================
                              STEP 1: FETCHING STOCK DATA
================================================================================
✓ Fetched prices: 125 trading days × 5 stocks

... [Full analysis output] ...

================================================================================
                                ANALYSIS COMPLETE
================================================================================
✓ Stock network analysis finished successfully!
```

#### Configuration (Web UI)

**Sidebar:**
- **Tickers**: Comma-separated list (AAPL,MSFT,GOOGL)
- **Period**: 1mo, 3mo, 6mo, 1y, 2y (default: 6mo)
- **Max Lag**: 1-10 days (default: 5) - how far back to check for delayed correlations
- **Min Correlation**: 0.0-1.0 (default: 0.5) - filter weak relationships
- **Button**: "Analyze Relationships" to run

**Output Interpretation:**
- **Green edges**: Positive correlation (stocks move together)
- **Red edges**: Negative correlation (opposite movements)
- **Thicker edges**: Stronger correlation
- **Larger nodes**: More connected stocks (hubs)

---

## Advanced Usage

### Integration: Both Systems Together

```bash
# Terminal 1: Start trading agent
python main.py

# Terminal 2: Start stock network visualization  
cd stock_network && streamlit run app.py

# Terminal 3: Optional - run analysis script
cd stock_network && python demo.py AAPL,MSFT
```

### Programmatic Access

#### Trading Agent
```python
from src.trading_agent.graph import create_graph

graph = create_graph()
state = graph.invoke({
    "query": "Analyze tech stocks",
    "symbols": ["AAPL", "MSFT", "GOOGL"]
})
print(state["final_decision"])
```

#### Stock Network
```python
import sys
sys.path.insert(0, "stock_network")

from data_fetch import fetch_stock_data, align_data, get_close_prices
from analysis import compute_lagged_correlation

# Fetch and analyze
data = fetch_stock_data(['AAPL', 'MSFT'], period='6mo')
prices = get_close_prices({t: data[t] for t in data})
lagged = compute_lagged_correlation(prices)
print(lagged)
```

---

## Configuration Files

### `.env.example` → `.env` (for Trading Agent)

```bash
# REQUIRED
NVIDIA_API_KEY=your_build_nvidia_com_key

# OPTIONAL (falls back to mock news)
TAVILY_API_KEY=your_tavily_key

# Optional overrides
MODEL=meta-llama/Llama-3.1-70b-Instruct  
TEMP=0.7
```

### API Key Setup

**NVIDIA LLaMA Access:**
1. Go to https://build.nvidia.com
2. Sign up or login
3. Go to API keys section
4. Create new API key
5. Copy and set: `export NVIDIA_API_KEY=...`

**Tavily News API (Optional):**
1. Go to https://tavily.com
2. Sign up for free tier
3. Copy API key
4. Set: `export TAVILY_API_KEY=...`

---

## Troubleshooting

### See [QUICKSTART.md](QUICKSTART.md#troubleshooting) for:
- Module import errors
- Port conflicts
- API rate limits
- Data fetch failures
- Performance optimization

---

## Dependencies

### Required for Trading Agent
```
langchain>=0.1.0
langgraph>=0.0.3
langchain-nvidia-ai-endpoints>=0.1.0
yfinance>=0.2.30
tavily-python>=0.1.0
pandas>=1.0.0
python-dotenv>=1.0.0
```

### Required for Stock Network
```
streamlit>=1.28.0
plotly>=5.17.0
pandas>=1.0.0
numpy>=1.20.0
networkx>=2.6
yfinance>=0.2.30
scipy>=1.7.0
statsmodels>=0.13.0
```

### All-in-One Installation

```bash
# Install both sets
pip install -r requirements.txt
cd stock_network && pip install -r requirements.txt && cd ..
```

---

## Validation & Testing

### Run All Tests

```bash
# Complete system validation (5-10 minutes)
python validate_system.py
```

### Test Trading Agent Only
```bash
python validate_pipeline.py
```

### Run Integration Tests
```bash
python test_pipeline.py
```

---

## Recent Changes

See [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) for:
- Phase 1: Initial audit & enhancement
- Phase 2: Logging removal & chatbot conversion
- Phase 3-5: Progressive pipeline simplification (7 nodes → 3 nodes)
- Phase 6: Stock network prototype creation

---

## Project Context

**Created**: Multi-phase evolution of trading agent architecture
**Current Phase**: Two parallel systems (trading & visualization)
**Status**: ✅ Both production-ready
**Test Results**: ✅ All validation tests passing

---

## Next Steps

1. **Run validation**: `python validate_system.py`
2. **Try trading agent**: `python main.py`
3. **Try stock network**: `streamlit run stock_network/app.py`
4. **Read documentation**: See [QUICKSTART.md](QUICKSTART.md) and [stock_network/README.md](stock_network/README.md)
5. **Customize**: Modify system prompts, visualization styles, analysis parameters

---

## Support & Documentation

- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Stock Network Details**: [stock_network/README.md](stock_network/README.md)  
- **Recent Changes**: [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)
- **Validation Help**: Run `python validate_system.py`

---

**Happy analyzing! 🚀**
