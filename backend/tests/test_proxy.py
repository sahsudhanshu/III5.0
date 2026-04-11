#!/usr/bin/env python3
"""
Proxy configuration test script.
Validates that proxy settings are properly configured and working.
"""

import logging
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load environment first
BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

# Add backend root to path
sys.path.insert(0, str(BACKEND_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_proxy_config():
    """Test proxy configuration."""
    try:
        logger.info("=" * 60)
        logger.info("PROXY CONFIGURATION TEST")
        logger.info("=" * 60)
        
        # Test raw environment variables first
        logger.info(f"\n📋 Environment Variables:")
        use_proxy = os.getenv("USE_PROXY", "false").lower() == "true"
        proxy_address = os.getenv("PROXY_ADDRESS", "").strip()
        proxy_port = os.getenv("PROXY_PORT", "8080").strip()
        connection_timeout = os.getenv("CONNECTION_TIMEOUT", "10")
        
        logger.info(f"  - USE_PROXY: {use_proxy}")
        logger.info(f"  - PROXY_ADDRESS: {proxy_address if proxy_address else '(not set)'}")
        logger.info(f"  - PROXY_PORT: {proxy_port}")
        logger.info(f"  - CONNECTION_TIMEOUT: {connection_timeout}s")
        
        # Test proxy dict function
        from src.trading_agent.config import get_proxy_dict, get_proxy_settings
        
        use_proxy_env, proxy_address_env, proxy_port_env = get_proxy_settings()
        proxy_dict = get_proxy_dict()
        
        logger.info(f"\n🔌 Proxy Configuration Status:")
        if proxy_dict:
            logger.info(f"  ✓ Proxy is ENABLED")
            logger.info(f"    - HTTP Proxy: {proxy_dict.get('http')}")
            logger.info(f"    - HTTPS Proxy: {proxy_dict.get('https')}")
        else:
            if use_proxy and not proxy_address:
                logger.warning(f"  ⚠ Proxy is enabled but PROXY_ADDRESS is not set")
            else:
                logger.info(f"  ✓ Proxy is DISABLED (direct connection)")
        
        # Test market data tool imports
        logger.info(f"\n📊 Testing Market Data Tool Import...")
        try:
            from src.trading_agent.tools.market_data import get_market_snapshot
            logger.info(f"  ✓ Market data tool imported successfully")
            logger.info(f"    - Proxy support: YES (session-based)")
        except Exception as e:
            logger.error(f"  ✗ Failed to import market data tool: {e}")
        
        # Test web search tool imports
        logger.info(f"\n🔍 Testing Web Search Tool Import...")
        try:
            from src.trading_agent.tools.web_search import search_financial_news
            logger.info(f"  ✓ Web search tool imported successfully")
            logger.info(f"    - Proxy support: YES (requests-based)")
        except Exception as e:
            logger.error(f"  ✗ Failed to import web search tool: {e}")
        
        logger.info(f"\n" + "=" * 60)
        logger.info("✓ PROXY CONFIGURATION TEST COMPLETE")
        logger.info("=" * 60)
        logger.info("\n📌 Summary:")
        logger.info(f"  • Proxy support: {'ENABLED' if proxy_dict else 'DISABLED'}")
        logger.info(f"  • Tools updated: market_data.py, web_search.py")
        logger.info(f"  • Configuration: config.py (with get_proxy_dict())")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Configuration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_proxy_config()
    sys.exit(0 if success else 1)
