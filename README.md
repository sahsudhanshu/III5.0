# Trading Agent Pipeline (v5.0)

A sophisticated multi-agent financial trading system built with **LangGraph** and powered by **NVIDIA's LLaMA 3.1** and **Tavily** financial data.

## Overview

This system implements an investment committee approach where specialized AI agents debate market decisions:

- **Market Analyst** - Analyzes trends, news, and historical patterns
- **Risk Manager** - Validates safety constraints and vetos risky positions  
- **Execution Agent** - Optimizes entry/exit prices and order logic
- **Portfolio Strategist** - Manages allocation and rebalancing at portfolio level
- **Investment Committee Chair** - Synthesizes debate and makes final decision

## Architecture

```
Initial Query + Symbols
    ↓
[Ingest Context] - Fetch market data & news
    ↓
[Market Analyst] → [Risk Manager] → [Execution] → [Portfolio Strategist]
    ↓
[Committee Vote & Finalize]
    ↓
[Persist to Memory]
    ↓
Final Investment Decision
```

### Key Features

✅ **Structured Debates** - Agents provide reasoned positions that are synthesized  
✅ **Memory System** - Stores historical decisions in SQLite for learning  
✅ **Composable Agents** - Each agent has specialized prompts and constraints  
✅ **Error Resilience** - Fallback to mock data if APIs fail  
✅ **Production-Ready** - Comprehensive logging, validation, and error handling  

## Setup

### Prerequisites

- Python 3.10+
- NVIDIA API Key (for LLaMA 3.1 70B access)
- Tavily API Key (for financial news)

### Installation

```bash
# Clone and navigate
cd III5.0

# Install dependencies
pip install -r requirements.txt

# Create .env file with API keys
cat > .env << EOF
NVIDIA_API_KEY=your_nvidia_key_here
NVIDIA_MODEL=meta/llama-3.1-70b-instruct
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1

TAVILY_API_KEY=your_tavily_key_here
TAVILY_TOPIC=finance
TAVILY_SEARCH_DEPTH=advanced

MEMORY_DB_PATH=trading_memory.db
EOF
```

## Usage

### Basic Usage

```bash
# Simple query
python main.py --query "Should we buy tech stocks?" --symbols SPY QQQ

# Multiple symbols
python main.py \
  --query "Analyze market conditions for growth stocks" \
  --symbols NVDA MSFT GOOG TSLA \
  --output analysis.json

# Verbose output
python main.py --query "Market analysis" --symbols SPY --verbose
```

### Running Validation

Test all components before running:

```bash
python validate_pipeline.py
```

This validates:
- ✓ All imports and dependencies
- ✓ Configuration and API keys
- ✓ Market data tool functionality
- ✓ News retrieval system
- ✓ Graph structure compilation
- ✓ Memory database operations

## Output Format

The final JSON output includes:

```json
{
  "query": "user's market question",
  "symbols": ["SPY", "QQQ"],
  "agent_outputs": {
    "market_analyst": { "hypotheses": [...], "confidence": 0.8 },
    "risk_manager": { "risk_score": 0.3, "veto": false },
    "execution": { "entry_plan": {...}, "exit_plan": {...} },
    "portfolio_strategist": { "target_allocations": {...} },
    "committee": { "vote_breakdown": {...} }
  },
  "debate_log": [...],
  "final_decision": {
    "winning_thesis": "recommendation",
    "vote_breakdown": {...},
    "confidence_score": 0.75,
    "final_actions": [...],
    "risk_controls": [...]
  },
  "long_term_refs": [1, 2, 3]
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NVIDIA_API_KEY` | Required | NVIDIA API key for LLaMA access |
| `NVIDIA_MODEL` | `meta/llama-3.1-70b-instruct` | Model to use |
| `NVIDIA_BASE_URL` | `https://integrate.api.nvidia.com/v1` | API endpoint |
| `TAVILY_API_KEY` | Required | Tavily API key for news |
| `TAVILY_TOPIC` | `finance` | Search topic |
| `TAVILY_SEARCH_DEPTH` | `advanced` | Search depth level |
| `MEMORY_DB_PATH` | `trading_memory.db` | Path to memory database |

### Agent Configuration

Modify constraints in `src/trading_agent/agents.py`:

```python
# Risk Manager constraints
"max_portfolio_risk": 0.02          # 2% max portfolio risk
"max_single_position": 0.15         # 15% max single position
"max_loss_per_trade": 0.02          # 2% max loss per trade
"liquidity_requirement_hours": 2    # Exit within 2 hours
```

## Project Structure

```
III5.0/
├── main.py                          # Entry point with argument parsing & validation
├── validate_pipeline.py             # Comprehensive system validation
├── requirements.txt                 # Python dependencies
├── README.md                        # Documentation
│
└── src/trading_agent/
    ├── __init__.py
    ├── config.py                    # Settings management
    ├── state.py                     # LangGraph state schema
    ├── agents.py                    # Agent functions with prompts
    ├── graph.py                     # LangGraph pipeline
    │
    ├── memory/
    │   └── long_term.py             # SQLite memory storage
    │
    └── tools/
        ├── market_data.py           # Market data retrieval
        └── web_search.py            # Financial news search
```

## Agent Prompts

Each agent has specialized system prompts guiding their behavior:

### Market Analyst
- Analyzes technical signals and momentum
- Identifies sector trends and correlations  
- Considers macroeconomic factors
- Matches historical patterns
- Returns: hypotheses, sector_view, confidence, key_risks, catalyst_events

### Risk Manager  
- Evaluates concentration limits
- Calculates maximum loss potential
- Checks liquidity constraints
- Stress tests volatility scenarios
- Returns: risk_score, veto decision, allowed_exposure, risk_notes

### Execution Agent
- Optimizes entry/exit timing
- Calculates position sizing
- Estimates slippage impact
- Plans contingency strategies
- Returns: entry_plan, exit_plan, slippage_bps, execution_notes

### Portfolio Strategist
- Manages diversification
- Decides rebalancing actions
- Aligns with macro environment
- Manages cash buffers
- Returns: target_allocations, rebalance_actions, hedge_ratio, rationale

### Investment Committee Chair
- Synthesizes all viewpoints
- Identifies consensus and disagreement
- Conducts confidence-weighted voting
- Generates final investment action
- Returns: winning_thesis, vote_breakdown, confidence_score, final_actions

## Memory System

Stores all trading decisions in SQLite for future reference:

```python
from src.trading_agent.memory.long_term import LongTermMemoryStore

store = LongTermMemoryStore("trading_memory.db")
recent = store.recent("trading_decision", limit=5)

for memory in recent:
    print(f"Decision {memory['id']}: {memory['payload']}")
```

## Troubleshooting

### Missing API Keys
```
ValueError: NVIDIA_API_KEY is required in environment
```
→ Set environment variables in `.env` file

### News API Failures  
The system automatically falls back to mock data when Tavily is unavailable.

### Graph Compilation Errors
Run `python validate_pipeline.py` to diagnose issues.

## Performance Tips

1. **Reduce Symbol Count** - 2-3 symbols for faster analysis
2. **Use Shorter Queries** - Under 100 characters for better performance
3. **Batch Operations** - Run multiple queries within single session
4. **Monitor Memory** - Archive old decisions periodically

## Future Enhancements

- Real-time market data feeds
- Portfolio backtesting  
- Advanced risk models
- Multi-asset class support
- Social media sentiment
- Ensemble LLM voting
- GPU-accelerated processing

---

**Version**: 5.0 | **Status**: Production Ready ✅ | **Updated**: 2026-04-11

        ├── config.py
        ├── graph.py
        ├── state.py
        ├── memory/
        │   └── long_term.py
        └── tools/
            ├── market_data.py
            └── web_search.py
```

## 4. Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `NVIDIA_API_KEY` | LLM auth key for NVIDIA-hosted model | required |
| `NVIDIA_MODEL` | Model name | `meta/llama-3.1-70b-instruct` |
| `NVIDIA_BASE_URL` | OpenAI-compatible NVIDIA endpoint | `https://integrate.api.nvidia.com/v1` |
| `TAVILY_API_KEY` | Tavily web search API key | required |
| `TAVILY_BASE_URL` | Tavily endpoint | `https://api.tavily.com/search` |
| `TAVILY_TOPIC` | Search topic | `finance` |
| `TAVILY_SEARCH_DEPTH` | Search depth | `advanced` |
| `MEMORY_DB_PATH` | SQLite long-term memory path | `trading_memory.db` |

## 5. Agent Responsibilities

1. **Market Analyst Agent**: reads market/news context and generates directional hypotheses.
2. **Risk Manager Agent**: applies exposure controls and can veto risky trade ideas.
3. **Execution Agent**: proposes timing, slippage assumptions, and order style.
4. **Portfolio Strategist Agent**: rebalancing stance based on macro and sector positioning.

Then the graph runs a **debate/vote/refine** stage and writes decision artifacts to long-term memory.
