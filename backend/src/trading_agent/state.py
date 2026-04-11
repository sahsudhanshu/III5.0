from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class TradingGraphState(TypedDict):
    query: str
    symbols: List[str]
    market_context: Dict[str, Any]
    news_context: List[Dict[str, Any]]
    agent_outputs: Dict[str, Dict[str, Any]]
    debate_log: List[Dict[str, Any]]
    votes: Dict[str, str]
    final_decision: Dict[str, Any]
    short_term_memory: List[Dict[str, Any]]
    long_term_memory: List[Dict[str, Any]]
    long_term_refs: List[int]
