"""Interactive trading agent chatbot (state-only memory)."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from src.trading_agent.graph import build_graph


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


def display_header() -> None:
    """Display welcome header."""
    print("\n" + "="*70)
    print("🤖 TRADING AGENT CHATBOT")
    print("="*70)
    print("Just type your investment question and press Enter.")
    print("Type 'exit' or 'quit' to leave.\n")


def main() -> int:
    """Main interactive chatbot loop."""
    try:
        app = build_graph()
    except Exception as e:
        print(f"❌ Error initializing trading agent: {e}")
        print("   Check your .env file for API keys (NVIDIA_API_KEY, TAVILY_API_KEY)")
        return 1
    
    display_header()
    
    messages: List[BaseMessage] = []
    long_term_memory: str | None = None

    while True:
        try:
            user_input = input("You: ").strip()
            
            if not user_input:
                continue
            
            # Check for exit commands
            if user_input.lower() in ["exit", "quit", "q"]:
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

                result = app.invoke(state)
                messages = result.get("messages", messages)
                long_term_memory = result.get("long_term_memory", long_term_memory)

                ai_text = _extract_last_ai_text(messages)
                if ai_text:
                    print(ai_text)
                else:
                    print("❌ No assistant response generated")

                print()
            except Exception as e:
                print(f"❌ Error during analysis: {e}\n")
        
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            return 0
        except Exception as e:
            print(f"❌ Error: {e}\n")


if __name__ == "__main__":
    sys.exit(main())
