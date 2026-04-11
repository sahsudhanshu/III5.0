from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .agents import market_agent, news_agent, risk_agent
from .tools.market_data import get_market_snapshot
from .tools.web_search import search_financial_news


def fetch_data_node(state) -> dict:
    """Fetch market data and news."""
    try:
        market_context = get_market_snapshot(state["symbols"])
        news_context = search_financial_news(state["query"], limit=5)
        state["market_context"] = market_context
        state["news_context"] = news_context
    except Exception as e:
        print(f"Error fetching data: {e}")
        state["market_context"] = {}
        state["news_context"] = []
    
    return state


def market_node(state) -> dict:
    """Analyze market prices and trends."""
    output = market_agent(state["query"], state["market_context"])
    state["agent_outputs"]["market"] = output
    return state


def news_node(state) -> dict:
    """Analyze news and current events."""
    output = news_agent(state["query"], state["news_context"])
    state["agent_outputs"]["news"] = output
    return state


def risk_node(state) -> dict:
    """Assess risks and provide recommendation."""
    market_analysis = state["agent_outputs"].get("market", {})
    news_analysis = state["agent_outputs"].get("news", {})
    
    output = risk_agent(
        state["query"],
        state["market_context"],
        state["news_context"],
        market_analysis,
        news_analysis,
    )
    state["agent_outputs"]["risk"] = output
    state["final_decision"] = output  # Risk agent makes final call
    
    return state


def build_graph():
    builder = StateGraph(dict)
    
    # Add nodes
    builder.add_node("fetch_data", fetch_data_node)
    builder.add_node("market", market_node)
    builder.add_node("news", news_node)
    builder.add_node("risk", risk_node)
    
    # Build sequential pipeline
    builder.add_edge(START, "fetch_data")
    builder.add_edge("fetch_data", "market")
    builder.add_edge("market", "news")
    builder.add_edge("news", "risk")
    builder.add_edge("risk", END)
    
    return builder.compile()
