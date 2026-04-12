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
from typing import Any, Dict, Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .config import get_settings
from .state import AgentState
from .tools.market_data import get_market_snapshot
from .tools.news_fetch import search_financial_news
from .tools.web_search import web_search

logger = logging.getLogger(__name__)

MAX_SHORT_TERM_MESSAGES = 20
MAX_LONG_TERM_CHARS = 4000
MAX_TOOL_OUTPUTS = 6
MAX_TOOL_CONTENT_CHARS = 1200

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
        max_tokens=768,
    )
    # Bind tools to LLM
    return llm.bind_tools(TOOLS)


def _get_planner_llm() -> ChatOpenAI:
    """Get LLM for planner output (no tools)."""
    settings = get_settings()
    return ChatOpenAI(
        model=settings.nvidia_model,
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
        temperature=0.2,
        max_tokens=512,
    )


def _build_system_prompt() -> str:
    """Build system prompt with comprehensive tool information."""
    return """You are a trading analysis agent. Use tools for current data.

TOOLS:

1) get_market_snapshot: symbols (list), period ('1y','2y','3y','5y','max'). Returns OHLCV arrays + summary.

2) search_financial_news: query, max_results (<=20). Returns articles list.

3) web_search: query, max_results (<=10). Returns web results.

Reply with a concise recommendation and cite tool data. If unsure, say HOLD.
"""


def _get_last_ai_text(messages: list) -> Optional[str]:
    """Extract the most recent assistant text response from messages."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            content = msg.content
            if isinstance(content, list):
                parts = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                return "\n".join(parts).strip()
            return str(content).strip()
    return None


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

        if tool_name == "get_market_snapshot":
            symbols = tool_args.get("symbols")
            if isinstance(symbols, str):
                stripped = symbols.strip()
                if stripped.startswith("[") and stripped.endswith("]"):
                    try:
                        import json
                        parsed = json.loads(stripped)
                        if isinstance(parsed, list):
                            symbols = parsed
                    except Exception:
                        pass
                else:
                    symbols = [s.strip() for s in symbols.split(",") if s.strip()]
                tool_args["symbols"] = symbols
        
        if tool_name not in TOOL_MAP:
            return {
                "call": call,
                "tool": tool_name,
                "result": f"⚠️ Unknown tool: {tool_name}",
            }
        
        try:
            tool_func = TOOL_MAP[tool_name]
            # Prefer the tool interface; it handles sync/async correctly.
            if hasattr(tool_func, "ainvoke"):
                result = await tool_func.ainvoke(tool_args)
            else:
                result = tool_func.invoke(tool_args)

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
    
    tool_outputs = list(state.get("tool_outputs", []))

    # Add tool results as ToolMessages
    for tr in tool_results:
        if isinstance(tr, Exception):
            logger.error(f"Tool execution exception: {tr}")
            continue
        
        content = tr["result"]
        if isinstance(content, str) and len(content) > MAX_TOOL_CONTENT_CHARS:
            content = content[:MAX_TOOL_CONTENT_CHARS] + "..."
        messages.append(ToolMessage(
            content=content,
            tool_call_id=tr["call"]["id"]
        ))
        tool_outputs.append({
            "tool": tr["tool"],
            "args": tr["args"],
            "result": tr["result"][:500],
        })

    if len(tool_outputs) > MAX_TOOL_OUTPUTS:
        tool_outputs = tool_outputs[-MAX_TOOL_OUTPUTS:]
    
    return {"messages": messages, "tool_outputs": tool_outputs}


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
    return "memory_update"


async def memory_update_node(state: AgentState) -> Dict[str, Any]:
    """Update short- and long-term memory in state only (no persistence)."""
    messages = list(state.get("messages", []))

    # Short-term memory: keep recent messages in state.messages
    if len(messages) > MAX_SHORT_TERM_MESSAGES:
        messages = messages[-MAX_SHORT_TERM_MESSAGES:]

    # Long-term memory: append a rolling summary string in state.long_term_memory
    human_input = (state.get("human_input") or "").strip()
    ai_text = _get_last_ai_text(messages) or ""

    if human_input or ai_text:
        entry_parts = []
        if human_input:
            entry_parts.append(f"User: {human_input}")
        if ai_text:
            entry_parts.append(f"Assistant: {ai_text}")
        new_entry = "\n".join(entry_parts)

        existing = (state.get("long_term_memory") or "").strip()
        combined = f"{existing}\n\n{new_entry}".strip() if existing else new_entry

        # Trim to most recent chars to avoid unbounded growth
        if len(combined) > MAX_LONG_TERM_CHARS:
            combined = combined[-MAX_LONG_TERM_CHARS:]

        return {
            "messages": messages,
            "long_term_memory": combined,
        }

    return {"messages": messages}


async def planner_node(state: AgentState) -> Dict[str, Any]:
    """Generate a buy/sell/hold suggestion based on tool outputs and context."""
    tool_outputs = state.get("tool_outputs", [])
    user_input = (state.get("human_input") or "").strip()
    last_ai = _get_last_ai_text(state.get("messages", [])) or ""

    if not tool_outputs and not last_ai:
        return {}

    planner_prompt = """You are a trading planner. Use the provided tool outputs and context to suggest a clear action: BUY, SELL, or HOLD.

Rules:
- If data is missing or low confidence, recommend HOLD and say why.
- Provide 2-4 bullet points with rationale.
- Be concise and avoid speculation beyond the data.
"""

    payload = {
        "user_query": user_input,
        "tool_outputs": tool_outputs,
        "assistant_response": last_ai,
    }

    llm = _get_planner_llm()
    response = await llm.ainvoke(
        [
            SystemMessage(content=planner_prompt),
            HumanMessage(content=str(payload)),
        ]
    )

    messages = list(state.get("messages", []))
    messages.append(AIMessage(content=response.content))
    return {"messages": messages}


def build_graph() -> StateGraph:
    """Build and compile the trading agent graph."""
    builder = StateGraph(AgentState)
    
    # Add nodes
    builder.add_node("agent_node", agent_node)
    builder.add_node("tool_executor_node", tool_executor_node)
    builder.add_node("memory_update", memory_update_node)
    builder.add_node("planner", planner_node)
    
    # Set entry point
    builder.set_entry_point("agent_node")
    
    # Add conditional edge after agent
    builder.add_conditional_edges(
        "agent_node",
        route_after_agent,
        {
            "tool_executor_node": "tool_executor_node",
            "memory_update": "memory_update",
        }
    )
    
    # Loop back: tool executor -> agent for follow-up
    builder.add_edge("tool_executor_node", "agent_node")

    # Final memory update -> end
    builder.add_edge("memory_update", "planner")
    builder.add_edge("planner", END)
    
    return builder.compile()


# Build the graph
graph = build_graph()
