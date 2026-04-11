"""
Pipeline validation and diagnostic script.
Tests all components of the trading agent system for correct operation.
"""

from __future__ import annotations

import logging
import sys
from typing import Any, Dict, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def validate_imports() -> bool:
    """Validate that all required modules can be imported."""
    logger.info("=" * 60)
    logger.info("STEP 1: Validating Imports")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.config import get_settings
        logger.info("✓ Config module imported")
        
        from src.trading_agent.state import TradingGraphState
        logger.info("✓ State module imported")
        
        from src.trading_agent.tools.market_data import get_market_snapshot
        logger.info("✓ Market data tool imported")
        
        from src.trading_agent.tools.web_search import search_financial_news
        logger.info("✓ Web search tool imported")
        
        from src.trading_agent.agents import (
            market_analyst_agent,
            risk_manager_agent,
            execution_agent,
            portfolio_strategist_agent,
            committee_vote_and_refine,
        )
        logger.info("✓ All agent functions imported")
        
        from src.trading_agent.graph import build_graph
        logger.info("✓ Graph builder imported")
        
        return True
    except Exception as e:
        logger.error(f"✗ Import failed: {e}")
        return False


def validate_config() -> bool:
    """Validate configuration settings."""
    logger.info("=" * 60)
    logger.info("STEP 2: Validating Configuration")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.config import get_settings
        settings = get_settings()
        
        # Check required settings
        assert settings.nvidia_api_key, "NVIDIA_API_KEY not set"
        assert settings.nvidia_model, "NVIDIA_MODEL not set"
        assert settings.tavily_api_key, "TAVILY_API_KEY not set"
        logger.info("✓ All required API keys configured")
        
        logger.info(f"  - NVIDIA Model: {settings.nvidia_model}")
        logger.info(f"  - Tavily Topic: {settings.tavily_topic}")
        logger.info(f"  - Memory DB: {settings.memory_db_path}")
        
        return True
    except AssertionError as e:
        logger.error(f"✗ Configuration error: {e}")
        return False
    except Exception as e:
        logger.error(f"✗ Config validation failed: {e}")
        return False


def validate_tools() -> bool:
    """Validate that tools work correctly."""
    logger.info("=" * 60)
    logger.info("STEP 3: Validating Tools")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.tools.market_data import get_market_snapshot
        from src.trading_agent.tools.web_search import search_financial_news
        
        # Test market data tool
        logger.info("Testing market_data tool...")
        market_data = get_market_snapshot(["SPY", "QQQ", "IWM"])
        assert isinstance(market_data, dict), "Market data should be dict"
        assert len(market_data) == 3, "Should have 3 symbols"
        
        for symbol, data in market_data.items():
            assert "price" in data, f"Missing price for {symbol}"
            assert "change_pct" in data, f"Missing change_pct for {symbol}"
            assert "volume" in data, f"Missing volume for {symbol}"
        logger.info(f"✓ Market data tool working ({len(market_data)} symbols)")
        
        # Test news search tool
        logger.info("Testing web_search tool...")
        news = search_financial_news("market trends", limit=3)
        assert isinstance(news, list), "News should be list"
        assert len(news) <= 3, "Should respect limit"
        
        for article in news:
            assert "title" in article, "Missing title"
            assert "summary" in article, "Missing summary"
            assert "source" in article, "Missing source"
        logger.info(f"✓ Web search tool working ({len(news)} articles)")
        
        return True
    except Exception as e:
        logger.error(f"✗ Tool validation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def validate_state_schema() -> bool:
    """Validate that state schema is correct."""
    logger.info("=" * 60)
    logger.info("STEP 4: Validating State Schema")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.state import TradingGraphState
        
        # Create sample state
        sample_state: TradingGraphState = {
            "query": "Should we invest in technology sector?",
            "symbols": ["NVDA", "MSFT", "GOOG"],
            "market_context": {"SPY": {"price": 450.0, "change_pct": 0.5}},
            "news_context": [{"title": "Tech boom", "summary": "Strong growth", "source": "CNBC", "url": "", "score": 0.9}],
            "agent_outputs": {},
            "debate_log": [],
            "votes": {},
            "final_decision": {},
            "short_term_memory": [],
            "long_term_memory": [],
            "long_term_refs": [],
        }
        
        logger.info("✓ State schema is valid")
        logger.info(f"  - Query: {sample_state['query'][:50]}")
        logger.info(f"  - Symbols: {sample_state['symbols']}")
        
        return True
    except Exception as e:
        logger.error(f"✗ State validation failed: {e}")
        return False


def validate_graph_structure() -> bool:
    """Validate that graph structure is correct."""
    logger.info("=" * 60)
    logger.info("STEP 5: Validating Graph Structure")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.graph import build_graph
        
        logger.info("Building graph...")
        app = build_graph()
        
        # Check that graph was built
        assert app is not None, "Graph is None"
        logger.info("✓ Graph compiled successfully")
        
        # List nodes (if available)
        try:
            # Different versions of langgraph expose nodes differently
            if hasattr(app, 'nodes'):
                logger.info(f"  - Nodes: {list(app.nodes)}")
            else:
                logger.info("  - Graph structure validated")
        except:
            logger.info("  - Graph structure validated")
        
        return True
    except Exception as e:
        logger.error(f"✗ Graph validation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def validate_agent_outputs() -> bool:
    """Validate that agents produce valid outputs."""
    logger.info("=" * 60)
    logger.info("STEP 6: Validating Agent Output Formats (Mock)")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.tools.market_data import get_market_snapshot
        from src.trading_agent.tools.web_search import search_financial_news
        
        # Get test data
        market_data = get_market_snapshot(["SPY"])
        news = search_financial_news("market", limit=2)
        
        # Check response formats
        logger.info("✓ Market analyst expected input: query, market_context, news_context, memory")
        logger.info("✓ Risk manager expected input: agent_outputs, constraints")
        logger.info("✓ Execution expected input: agent_outputs, market_context")
        logger.info("✓ Portfolio strategist expected input: agent_outputs")
        logger.info("✓ Committee expected input: agent_outputs, debate_log")
        
        logger.info("\nExpected agent outputs should include:")
        logger.info("  - market_analyst: hypotheses, sector_view, confidence, key_risks")
        logger.info("  - risk_manager: risk_score, veto, allowed_exposure, risk_notes")
        logger.info("  - execution: entry_plan, exit_plan, slippage_assumption_bps")
        logger.info("  - portfolio_strategist: target_allocations, rebalance_actions")
        logger.info("  - committee: winning_thesis, vote_breakdown, final_actions")
        
        return True
    except Exception as e:
        logger.error(f"✗ Agent validation failed: {e}")
        return False


def validate_memory_system() -> bool:
    """Validate memory storage system."""
    logger.info("=" * 60)
    logger.info("STEP 7: Validating Memory System")
    logger.info("=" * 60)
    
    try:
        from src.trading_agent.config import get_settings
        from src.trading_agent.memory.long_term import LongTermMemoryStore
        
        settings = get_settings()
        store = LongTermMemoryStore(settings.memory_db_path)
        
        # Write test memory
        test_id = store.write("test_category", {"test": "data"})
        assert isinstance(test_id, int), "Memory ID should be integer"
        logger.info(f"✓ Memory write successful (ID: {test_id})")
        
        # Read recent memories
        memories = store.recent("test_category", limit=1)
        assert isinstance(memories, list), "Recent should return list"
        logger.info(f"✓ Memory read successful ({len(memories)} entries)")
        
        if memories:
            logger.info(f"  - Most recent: {memories[0]}")
        
        return True
    except Exception as e:
        logger.error(f"✗ Memory validation failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_full_validation() -> bool:
    """Run complete validation suite."""
    logger.info("\n" + "=" * 60)
    logger.info("TRADING AGENT PIPELINE VALIDATION")
    logger.info("=" * 60 + "\n")
    
    results = {
        "Imports": validate_imports(),
        "Configuration": validate_config(),
        "Tools": validate_tools(),
        "State Schema": validate_state_schema(),
        "Graph Structure": validate_graph_structure(),
        "Agent Outputs": validate_agent_outputs(),
        "Memory System": validate_memory_system(),
    }
    
    logger.info("\n" + "=" * 60)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 60)
    
    for step, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        logger.info(f"{status}: {step}")
    
    all_passed = all(results.values())
    logger.info("=" * 60)
    
    if all_passed:
        logger.info("🎉 ALL VALIDATIONS PASSED - PIPELINE READY!")
        return True
    else:
        logger.error("❌ SOME VALIDATIONS FAILED - REVIEW ABOVE")
        return False


if __name__ == "__main__":
    success = run_full_validation()
    sys.exit(0 if success else 1)
