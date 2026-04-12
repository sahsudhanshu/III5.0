"""
Seed script — pre-populates Neo4j with the top-10 mega-cap stocks.

Run once from the stock_network directory:
    python seed_graph.py

This will CLEAR the existing graph and rebuild it from scratch
with real yfinance data, correlations, products, and news.
"""

import sys
import os
import logging

# Ensure correct path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load .env if it exists (for NEO4J credentials)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(name)s  %(message)s"
)
logger = logging.getLogger(__name__)

SEED_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
    "META", "NVDA", "BRK-B", "V", "WMT",
]


def main():
    from neo4j_connection import Neo4jConnection
    from graph_manager import build_full_graph

    logger.info("=" * 60)
    logger.info("🌱  SEED GRAPH — Pre-populating Neo4j with top-10 stocks")
    logger.info(f"   Tickers: {SEED_TICKERS}")
    logger.info("=" * 60)

    conn = Neo4jConnection()
    conn.connect()

    try:
        # Clear everything first — this is the INITIAL seed
        logger.info("🗑️  Clearing existing graph for fresh seed …")
        conn.clear_graph()

        # Build the full graph (will create indexes, nodes, edges)
        stats = build_full_graph(
            tickers=SEED_TICKERS,
            period="6mo",
            min_correlation=0.20,       # lower threshold to get more edges
            max_news_per_company=5,
            conn=conn,
        )

        logger.info("=" * 60)
        logger.info("✅  SEED COMPLETE!")
        logger.info(f"   Stats: {stats}")
        logger.info("=" * 60)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
