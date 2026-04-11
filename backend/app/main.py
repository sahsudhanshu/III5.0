"""
Interactive Trading Agent Chatbot - Simple Multi-turn Interface
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, List

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from src.trading_agent.graph import build_graph


def create_initial_state(query: str, symbols: List[str] = None) -> Dict[str, Any]:
    """Create initial state for the graph."""
    if symbols is None:
        symbols = ["SPY"]
    
    return {
        "query": query,
        "symbols": symbols,
        "market_context": {},
        "news_context": [],
        "agent_outputs": {},
        "debate_log": [],
        "votes": {},
        "final_decision": {},
        "short_term_memory": [],
        "long_term_memory": [],
        "long_term_refs": [],
    }


def format_decision(decision: Dict[str, Any]) -> str:
    """Format decision output for display."""
    output = []
    
    if "winning_thesis" in decision:
        output.append(f"\n📊 DECISION:\n{decision['winning_thesis']}\n")
    
    if "vote_breakdown" in decision:
        output.append("🗳️  AGENT VOTES:")
        for agent, vote in decision["vote_breakdown"].items():
            output.append(f"   • {agent}: {vote}")
    
    if "confidence_score" in decision:
        conf = decision["confidence_score"]
        confidence_bar = "█" * int(conf * 10) + "░" * (10 - int(conf * 10))
        output.append(f"\n💪 CONFIDENCE: {confidence_bar} {conf:.0%}")
    
    if "final_actions" in decision and decision["final_actions"]:
        output.append("\n📋 RECOMMENDED ACTIONS:")
        for action in decision["final_actions"][:3]:  # Show top 3
            output.append(f"   • {action}")
    
    if "risk_controls" in decision and decision["risk_controls"]:
        output.append("\n⚠️  RISK CONTROLS:")
        for control in decision["risk_controls"][:3]:  # Show top 3
            output.append(f"   • {control}")
    
    return "\n".join(output)


def display_header():
    """Display welcome header."""
    print("\n" + "="*70)
    print("🤖 TRADING AGENT CHATBOT")
    print("="*70)
    print("Just type your investment question and press Enter.")
    print("Type 'exit' or 'quit' to leave.\n")


def main():
    """Main interactive chatbot loop."""
    try:
        app = build_graph()
    except Exception as e:
        print(f"❌ Error initializing trading agent: {e}")
        print("   Check your .env file for API keys (NVIDIA_API_KEY, TAVILY_API_KEY)")
        return 1
    
    display_header()
    
    while True:
        try:
            user_input = input("You: ").strip()
            
            if not user_input:
                continue
            
            # Check for exit commands
            if user_input.lower() in ["exit", "quit", "q"]:
                print("\n👋 Goodbye!\n")
                return 0
            
            # Run query through graph
            print("\n⏳ Analyzing your question...\n")
            
            try:
                initial_state = create_initial_state(user_input)
                result = app.invoke(initial_state)
                
                # Display decision
                final_decision = result.get("final_decision", {})
                if final_decision:
                    print(format_decision(final_decision))
                else:
                    print("❌ No decision generated")
                
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
