from __future__ import annotations

import json
from typing import Any, Dict, List

from langchain_openai import ChatOpenAI

from .config import get_settings


def _build_llm() -> ChatOpenAI:
    settings = get_settings()
    return ChatOpenAI(
        model=settings.nvidia_model,
        api_key=settings.nvidia_api_key,
        base_url=settings.nvidia_base_url,
        temperature=0.2,
    )


def _invoke_json_agent(system_role: str, task: Dict[str, Any], system_prompt: str = "") -> Dict[str, Any]:
    llm = _build_llm()
    base_system = f"You are {system_role}. Return only valid JSON with concise, actionable fields."
    full_system = f"{base_system}\n\n{system_prompt}" if system_prompt else base_system
    
    messages = [
        {"role": "system", "content": full_system},
        {"role": "user", "content": json.dumps(task)},
    ]
    response = llm.invoke(messages)
    content = response.content if isinstance(response.content, str) else str(response.content)
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"raw_response": content, "error": "JSON parsing failed"}


def market_agent(query: str, market_context: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze market data and price trends."""
    system_prompt = """Analyze current market prices and trends.
Focus on: price levels, trading volume, market momentum, technical signals.
Provide concise market analysis."""
    
    return _invoke_json_agent(
        "Market Analyst",
        {
            "query": query,
            "market_data": market_context,
            "instructions": "Return JSON with: price_analysis, trend, momentum, recommendation",
        },
        system_prompt,
    )


def news_agent(query: str, news_context: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze news and current events."""
    system_prompt = """Analyze financial news and events.
Focus on: recent news impact, sentiment, market catalysts, Risk factors.
Provide concise news analysis."""
    
    return _invoke_json_agent(
        "News Analyst",
        {
            "query": query,
            "news_articles": news_context[:5],  # Top 5
            "instructions": "Return JSON with: key_news, sentiment, catalysts, risks",
        },
        system_prompt,
    )


def risk_agent(
    query: str,
    market_data: Dict[str, Any],
    news: List[Dict[str, Any]],
    market_analysis: Dict[str, Any],
    news_analysis: Dict[str, Any],
) -> Dict[str, Any]:
    """Assess risks and provide final recommendation."""
    system_prompt = """You are a risk assessment agent.
Evaluate market and news analysis for risks.
Provide: risk level, safety assessment, final recommendation.
Be conservative - flag any significant risks."""
    
    return _invoke_json_agent(
        "Risk Manager",
        {
            "query": query,
            "market_prices": list(market_data.keys()),
            "market_analysis": market_analysis,
            "news_analysis": news_analysis,
            "instructions": "Return JSON with: risk_level (low/medium/high), concerns (list), recommendation (buy/hold/sell), confidence (0-1)",
        },
        system_prompt,
    )
