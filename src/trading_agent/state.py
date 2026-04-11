"""Agent state schema for LangGraph."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """Accumulated state passed through the LangGraph graph."""

    # Identifiers
    user_id: str
    conversation_id: str

    # Language
    selected_language: str
    language_accepted: bool
    language_rejection: Optional[str]

    # Messages
    messages: List[BaseMessage]
    human_input: str

    # User location (GPS from browser)
    latitude: Optional[float]
    longitude: Optional[float]

    # Context (injected before agent)
    summary: Optional[str]
    long_term_memory: Optional[str]
    region_context: Optional[str]
    catch_context: Optional[str]

    # RAG knowledge base context
    rag_context: Optional[str]
    rag_query: Optional[str]
    rag_documents_count: int
    rag_query_type: Optional[str]
    detected_species: Optional[str]
    rag_error: Optional[str]

    # UI action hints (set by intent_classifier node)
    ui_map: bool
    ui_history: bool
    ui_upload: bool
    map_lat: Optional[float]
    map_lon: Optional[float]

    # Tool outputs
    tool_outputs: List[Dict[str, Any]]

    # Control flow
    next_action: Literal["continue", "end"]
