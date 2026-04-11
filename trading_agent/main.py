"""Interactive trading agent chatbot (state-only memory)."""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage


def _ensure_import_path() -> None:
    """Allow running this file directly without package context."""
    pkg_root = Path(__file__).resolve().parents[1]
    if str(pkg_root) not in sys.path:
        sys.path.insert(0, str(pkg_root))


def _extract_last_ai_text(messages: List[BaseMessage]) -> Optional[str]:
    """Return the most recent assistant message content (non-tool call)."""
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            content = msg.content
            if isinstance(content, list):
                parts: List[str] = []
                for block in content:
                    if isinstance(block, str):
                        parts.append(block)
                    elif isinstance(block, dict) and block.get("type") == "text":
                        parts.append(block.get("text", ""))
                return "\n".join(parts).strip()
            return str(content).strip()
    return None


def _display_header() -> None:
    print("\n" + "=" * 70)
    print("🤖 TRADING AGENT CHATBOT")
    print("=" * 70)
    print("Just type your investment question and press Enter.")
    print("Type 'exit' or 'quit' to leave.\n")


def main() -> int:
    """Main interactive chatbot loop."""
    _ensure_import_path()

    try:
        from trading_agent.graph import build_graph
    except Exception as exc:
        print(f"❌ Error importing agent graph: {exc}")
        return 1

    try:
        app = build_graph()
    except Exception as exc:
        print(f"❌ Error initializing trading agent: {exc}")
        print("   Check your .env file for API keys (NVIDIA_API_KEY, TAVILY_API_KEY)")
        return 1

    _display_header()

    messages: List[BaseMessage] = []
    long_term_memory: str | None = None

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in {"exit", "quit", "q"}:
                print("\n👋 Goodbye!\n")
                return 0

            print("\n⏳ Analyzing your question...\n")

            try:
                if not messages:
                    messages = [HumanMessage(content=user_input)]
                else:
                    messages = messages + [HumanMessage(content=user_input)]

                state: Dict[str, Any] = {
                    "messages": messages,
                    "human_input": user_input,
                    "long_term_memory": long_term_memory,
                }

                result = asyncio.run(app.ainvoke(state))
                messages = result.get("messages", messages)
                long_term_memory = result.get("long_term_memory", long_term_memory)

                ai_text = _extract_last_ai_text(messages)
                if ai_text:
                    print(ai_text)
                else:
                    print("❌ No assistant response generated")

                print()
            except Exception as exc:
                print(f"❌ Error during analysis: {exc}\n")
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            return 0
        except Exception as exc:
            print(f"❌ Error: {exc}\n")


if __name__ == "__main__":
    sys.exit(main())
