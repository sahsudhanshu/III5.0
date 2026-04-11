"""
LangGraph agent graph with tool execution for trading analysis.

Graph flow:
  ┌─────────────────┐
  │   agent_node    │◄────────────┐
  └────────┬────────┘             │
           │                      │
    has_tool_calls?              │
      yes │    no                │
  ┌───────▼──────────┐           │
  │ tool_executor_node├───────────┘
  └──────────────────┘
         │ (no more tool calls)
        END
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Literal

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .config import get_settings
from .state import AgentState
from .tools.market_data import get_market_snapshot
from .tools.news_fetch import search_financial_news
from .tools.web_search import web_search

logger = logging.getLogger(__name__)

# All tools available to the agent
TOOLS = [get_market_snapshot, search_financial_news, web_search]

# Tool map for executor
TOOL_MAP = {t.name: t for t in TOOLS}


def _get_agent_llm() -> ChatOpenAI:
    """Get LLM with tools bound."""
    settings = get_settings()
    llm = ChatOpenAI(
        model=settings.nvidia_model,
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
        temperature=0.2,
        max_tokens=2048,
    )
    # Bind tools to LLM
    return llm.bind_tools(TOOLS)


def _build_system_prompt() -> str:
    """Build system prompt with comprehensive tool information."""
    return """You are a professional trading analysis agent with access to multiple financial tools.

YOUR AVAILABLE TOOLS:

1. **get_market_snapshot** - Market data with historical time series
   Purpose: Analyze price trends, technical patterns, volatility, and market statistics
   Parameters:
     - symbols (list): Stock tickers (e.g., ['AAPL', 'MSFT'])
     - period (str): Historical period ('1y', '2y', '3y', '5y', 'max')
   Returns:
     - Formatted summary plus JSON with arrays of dates and OHLCV data
   Use When:
     ✓ Performing technical analysis
     ✓ Identifying trends and support/resistance
     ✓ Calculating volatility metrics
     ✓ Comparing multiple stocks visually
     ✓ Preparing visualization data

2. **search_financial_news** - Financial news using gnews with fallback
   Purpose: Research corporate events, market sentiment, and news-driven catalysts
   Parameters:
     - query (str): Financial news search query (e.g., "Apple earnings", "Fed rate decision")
    - max_results (int): Max results (default 5, max 20)
   Returns:
     - List of articles with title, summary, source, URL, published date, relevance score
   Use When:
     ✓ Analyzing earnings announcements
     ✓ Assessing geopolitical impacts
     ✓ Tracking regulatory news
     ✓ Evaluating CEO/leadership changes
     ✓ Monitoring industry trends

3. **web_search** - General web search for financial information
   Purpose: Find supporting data, analyst reports, and broader context
   Parameters:
    - query (str): General search query
    - max_results (int): Max results (default 5)
   Returns:
     - List of search results with relevance scoring
   Use When:
     ✓ Finding analyst reports
     ✓ Researching company fundamentals
     ✓ Gathering industry context
     ✓ Fact-checking information
     ✓ Deep-diving into specific topics

YOUR ANALYSIS FRAMEWORK:

1. Data Collection: Use tools to gather relevant market and news data
2. Technical Analysis: Analyze price patterns, trends, support/resistance from get_market_snapshot
3. Sentiment Analysis: Assess news sentiment and potential market catalysts
4. Risk Assessment: Evaluate volatility, news risk, and market conditions
5. Recommendation: Synthesize all data into actionable trading insights

RESPONSE FORMAT:

Structure your analysis with:
- Market Overview: Current prices, trends, volatility from snapshot
- Technical Analysis: Support/resistance, trend direction, chart patterns
- News Analysis: Recent events, sentiment, potential catalysts
- Risk Assessment: Downside risks, volatility considerations
- Trading Recommendation: Entry/exit prices with clear rationale
- Data Citation: Always cite specific sources and data points

IMPORTANT GUIDELINES:

- Always use available tools for current data - do NOT use training data for prices
- Provide specific price targets with supporting analysis
- Include risk/reward ratios in recommendations
- Acknowledge uncertainty in your analysis
- Prioritize data accuracy over speculation
- Use tool data as primary evidence, not opinions
"""


async def agent_node(state: AgentState) -> Dict[str, Any]:
    """
    Main agent node: Invoke LLM with tool support.
    LLM will return either a response with tool calls or a final message.
    """
    llm = _get_agent_llm()
    
    # Build messages
    messages = list(state.get("messages", []))
    
    # Add system prompt if not already present
    if not messages or not isinstance(messages[0], SystemMessage):
        system_prompt = _build_system_prompt()
        messages.insert(0, SystemMessage(content=system_prompt))
    
    # Add current human input if not in messages
    if not any(isinstance(m, HumanMessage) for m in messages):
        messages.append(HumanMessage(content=state.get("human_input", "")))
    
    # Invoke LLM (will return AIMessage with tool_calls if tools needed)
    logger.info("Invoking agent LLM with tool bindings...")
    response = await llm.ainvoke(messages)
    
    logger.debug(f"LLM response: tool_calls={len(response.tool_calls) if response.tool_calls else 0}")
    
    return {"messages": messages + [response]}


async def tool_executor_node(state: AgentState) -> Dict[str, Any]:
    """
    Execute tool calls from the LLM.
    Processes all tool calls and returns ToolMessages to continue the loop.
    """
    messages = list(state.get("messages", []))
    last_msg = messages[-1] if messages else None
    
    # Only process if last message is AI with tool calls
    if not isinstance(last_msg, AIMessage) or not last_msg.tool_calls:
        logger.debug("No tool calls in last message, skipping executor")
        return {"messages": messages}
    
    logger.info(f"Executing {len(last_msg.tool_calls)} tool calls...")
    
    async def _run_tool(call: Dict[str, Any]) -> Dict[str, Any]:
        """Run a single tool call."""
        tool_name = call["name"]
        tool_args = dict(call["args"])
        
        if tool_name not in TOOL_MAP:
            return {
                "call": call,
                "tool": tool_name,
                "result": f"⚠️ Unknown tool: {tool_name}",
            }
        
        try:
            tool_func = TOOL_MAP[tool_name]
            # Check if tool's underlying function is async
            if asyncio.iscoroutinefunction(tool_func.func):
                result = await tool_func.func(**tool_args)
            else:
                # Fallback for sync tools
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, lambda: tool_func.func(**tool_args))
            
            result_str = str(result) if not isinstance(result, (list, dict)) else str(result)[:2000]
            logger.info(f"✓ Tool {tool_name} executed successfully")
            
        except Exception as e:
            logger.error(f"Tool {tool_name} execution failed: {e}")
            result_str = f"⚠️ Tool error: {str(e)}"
        
        return {
            "call": call,
            "tool": tool_name,
            "result": result_str,
        }
    
    # Execute all tools concurrently
    tool_results = await asyncio.gather(
        *[_run_tool(call) for call in last_msg.tool_calls],
        return_exceptions=True
    )
    
    # Add tool results as ToolMessages
    for tr in tool_results:
        if isinstance(tr, Exception):
            logger.error(f"Tool execution exception: {tr}")
            continue
        
        messages.append(ToolMessage(
            content=tr["result"],
            tool_call_id=tr["call"]["id"]
        ))
    
    return {"messages": messages}


def route_after_agent(state: AgentState) -> Literal["tool_executor_node", "end"]:
    """
    Route after agent node:
    - if tool calls exist, go to executor
    - else, end
    """
    messages = state.get("messages", [])
    if messages and isinstance(messages[-1], AIMessage):
        last_msg = messages[-1]
        if last_msg.tool_calls:
            logger.info(f"Tool calls detected ({len(last_msg.tool_calls)}), routing to executor")
            return "tool_executor_node"
    
    logger.info("No tool calls, ending conversation")
    return "end"


def build_graph() -> StateGraph:
    """Build and compile the trading agent graph."""
    builder = StateGraph(AgentState)
    
    # Add nodes
    builder.add_node("agent_node", agent_node)
    builder.add_node("tool_executor_node", tool_executor_node)
    
    # Set entry point
    builder.set_entry_point("agent_node")
    
    # Add conditional edge after agent
    builder.add_conditional_edges(
        "agent_node",
        route_after_agent,
        {
            "tool_executor_node": "tool_executor_node",
            "end": END,
        }
    )
    
    # Loop back: tool executor -> agent for follow-up
    builder.add_edge("tool_executor_node", "agent_node")
    
    return builder.compile()


# Build the graph
graph = build_graph()
