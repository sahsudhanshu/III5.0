"""
Neo4j Connection Manager for Stock Network Graph.
Provides a reusable connection class with context manager support.
"""

import logging
import os
from neo4j import GraphDatabase

logger = logging.getLogger(__name__)

# Bypass proxy for local Neo4j (critical on WSL / corporate networks)
_no_proxy = os.environ.get("NO_PROXY", "")
if "localhost" not in _no_proxy:
    os.environ["NO_PROXY"] = f"{_no_proxy},localhost,127.0.0.1,172.30.12.15".strip(",")
    os.environ["no_proxy"] = os.environ["NO_PROXY"]

NEO4J_URI = os.environ.get("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.environ.get("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.environ.get("NEO4J_PASSWORD", "stocknetwork123")
NEO4J_DATABASE = os.environ.get("NEO4J_DATABASE", "neo4j")


class Neo4jConnection:
    """Manages Neo4j driver lifecycle."""

    def __init__(self, uri: str = None, user: str = None, password: str = None, database: str = None):
        self._uri = uri or NEO4J_URI
        self._user = user or NEO4J_USER
        self._password = password or NEO4J_PASSWORD
        self._database = database or NEO4J_DATABASE
        self._driver = None

    # Context manager --------------------------------------------------------
    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    # Connection -------------------------------------------------------------
    def connect(self):
        """Open the driver (idempotent)."""
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                self._uri, auth=(self._user, self._password)
            )
            logger.info(f"Connected to Neo4j at {self._uri}")

    def close(self):
        """Close the driver."""
        if self._driver:
            self._driver.close()
            self._driver = None
            logger.info("Neo4j connection closed")

    @property
    def driver(self):
        if self._driver is None:
            self.connect()
        return self._driver

    # Query helpers ----------------------------------------------------------
    def run_query(self, query: str, parameters: dict = None):
        """Run a Cypher query and return list of record dicts."""
        with self.driver.session(database=self._database) as session:
            result = session.run(query, parameters or {})
            return [record.data() for record in result]

    def run_write(self, query: str, parameters: dict = None):
        """Run a write transaction."""
        with self.driver.session(database=self._database) as session:
            return session.execute_write(
                lambda tx: tx.run(query, parameters or {}).consume()
            )

    def clear_graph(self):
        """Delete everything in the database."""
        self.run_write("MATCH (n) DETACH DELETE n")
        logger.info("Graph cleared")

    def create_indexes(self):
        """Create indexes / constraints for performance."""
        indexes = [
            "CREATE INDEX company_ticker IF NOT EXISTS FOR (c:Company) ON (c.ticker)",
            "CREATE INDEX product_name IF NOT EXISTS FOR (p:Product) ON (p.name)",
            "CREATE INDEX news_title IF NOT EXISTS FOR (n:News) ON (n.title)",
        ]
        for idx in indexes:
            try:
                self.run_write(idx)
            except Exception as e:
                logger.debug(f"Index may already exist: {e}")
        logger.info("Indexes ensured")

    def get_stats(self) -> dict:
        """Return node / relationship counts."""
        rows = self.run_query(
            "MATCH (n) RETURN labels(n)[0] AS label, count(n) AS cnt"
        )
        node_counts = {r["label"]: r["cnt"] for r in rows}
        rel_rows = self.run_query(
            "MATCH ()-[r]->() RETURN type(r) AS rel, count(r) AS cnt"
        )
        rel_counts = {r["rel"]: r["cnt"] for r in rel_rows}
        return {"nodes": node_counts, "relationships": rel_counts}
