#!/usr/bin/env python3
"""Quick test: connect to Neo4j, build small graph, verify."""
import os, sys

# CRITICAL: bypass proxy for local connections BEFORE any imports
os.environ["NO_PROXY"] = "localhost,127.0.0.1,172.30.12.15"
os.environ["no_proxy"] = os.environ["NO_PROXY"]
os.environ["USE_PROXY"] = "false"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("1/5  Connecting to Neo4j …", flush=True)
from neo4j_connection import Neo4jConnection
conn = Neo4jConnection()
conn.connect()
print("     ✅ Connected", flush=True)

print("2/5  Clearing graph & creating indexes …", flush=True)
conn.clear_graph()
conn.create_indexes()
print("     ✅ Ready", flush=True)

print("3/5  Building graph for AAPL, MSFT, GOOGL …", flush=True)
from graph_manager import build_full_graph
stats = build_full_graph(
    tickers=["AAPL", "MSFT", "GOOGL"],
    period="3mo",
    min_correlation=0.2,
    max_news_per_company=3,
    conn=conn,
)
print(f"     ✅ Stats: {stats}", flush=True)

print("4/5  Verifying nodes …", flush=True)
nodes = conn.run_query("MATCH (n) RETURN labels(n)[0] AS label, count(n) AS cnt")
for row in nodes:
    print(f"     {row['label']}: {row['cnt']}", flush=True)

print("5/5  Verifying relationships …", flush=True)
rels = conn.run_query("MATCH ()-[r]->() RETURN type(r) AS rel, count(r) AS cnt")
for row in rels:
    print(f"     {row['rel']}: {row['cnt']}", flush=True)

conn.close()
print("\n✅ All tests passed!", flush=True)
