# Stock Network Analyzer — Neo4j Edition

A graph-based stock relationship analyzer using **Neo4j** to model connections between **Companies**, **Products**, and **News**.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  yfinance   │────▶│  stock_data   │────▶│               │
│ (real data) │     │              │     │               │
└─────────────┘     └──────────────┘     │               │
                                         │ graph_manager  │──▶ Neo4j
┌─────────────┐     ┌──────────────┐     │               │    (Docker)
│ DuckDuckGo  │────▶│ news_fetcher │────▶│               │
│   (news)    │     │              │     │               │
└─────────────┘     └──────────────┘     └───────────────┘
                                               │
                    ┌──────────────┐            │
                    │stock_analysis│────────────┘
                    │ (metrics)    │
                    └──────────────┘
```

## Quick Start

### 1. Start Neo4j (Docker)

```bash
cd backend/stock_network
docker compose up -d
```

Neo4j Browser: [http://localhost:7474](http://localhost:7474)  
Credentials: `neo4j` / `stocknetwork123`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the app

```bash
streamlit run app.py
```

### 4. Build the graph

1. Enter tickers (e.g. `AAPL,MSFT,GOOGL,NVDA,TSLA,AMZN`)
2. Click **Build Graph**
3. Explore the tabs: Network Graph, Companies, Correlations, News, Products

## Graph Schema

### Nodes

| Node | Key Properties |
|------|---------------|
| **Company** | ticker, name, sector, industry, current_price, volatility, beta, momentum |
| **Product** | name, sector, industry |
| **News** | title, url, date, source, snippet |

### Relationships

| Relationship | From → To | Based On |
|-------------|-----------|----------|
| `CORRELATED_WITH` | Company ↔ Company | Pearson/Spearman correlation of returns |
| `SAME_SECTOR` | Company ↔ Company | Shared sector classification |
| `PRODUCES` | Company → Product | Company's industry category |
| `MENTIONED_IN` | Company → News | DuckDuckGo news search results |
| `RELATED_PRODUCT` | Product ↔ Product | Products in same sector |
| `RELATED_NEWS` | News ↔ News | News sharing company connections |

## Modules

| File | Purpose |
|------|---------|
| `neo4j_connection.py` | Neo4j driver manager (connection, queries, indexes) |
| `stock_data.py` | yfinance data fetching + company metadata |
| `news_fetcher.py` | DuckDuckGo news search per company |
| `stock_analysis.py` | Correlation, volatility, beta, momentum |
| `graph_manager.py` | Full pipeline: fetch → analyze → build Neo4j graph |
| `app.py` | Streamlit web UI with interactive visualization |

## Cypher Examples

```cypher
-- All companies and their correlations
MATCH (a:Company)-[r:CORRELATED_WITH]-(b:Company)
RETURN a.ticker, b.ticker, r.pearson, r.strength

-- Company with its products and news
MATCH (c:Company)-[:PRODUCES]->(p:Product)
OPTIONAL MATCH (c)-[:MENTIONED_IN]->(n:News)
RETURN c.name, p.name, collect(n.title)

-- Most connected companies
MATCH (c:Company)-[r]-()
RETURN c.ticker, count(r) AS connections
ORDER BY connections DESC
```
