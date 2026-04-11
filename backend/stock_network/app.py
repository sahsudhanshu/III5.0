"""
Stock Network Analyzer — Neo4j Edition
Streamlit app that visualises the stock relationship graph in Neo4j.
Run `python populate_graph.py` first to build the graph.
"""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import logging, os, sys

sys.path.insert(0, os.path.dirname(__file__))
from neo4j_connection import Neo4jConnection

logging.basicConfig(level=logging.INFO)

# ── Page config ─────────────────────────────────────────────────────────
st.set_page_config(page_title="Stock Network — Neo4j", page_icon="🕸️", layout="wide")

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
* { font-family: 'Inter', sans-serif; }
.company-card { background:#f0f4ff; border-left:4px solid #667eea; padding:12px 16px; border-radius:8px; margin:6px 0; }
.news-card   { background:#fff8e1; border-left:4px solid #ff9800; padding:10px 14px; border-radius:8px; margin:5px 0; }
.product-badge { display:inline-block; background:#e8f5e9; color:#2e7d32; padding:3px 10px;
                 border-radius:12px; margin:2px 4px; font-size:0.85em; font-weight:600; }
</style>
""", unsafe_allow_html=True)


# ── Neo4j helpers ───────────────────────────────────────────────────────

@st.cache_resource
def get_conn():
    c = Neo4jConnection(); c.connect(); return c

def q(cypher, **kw):
    return get_conn().run_query(cypher, kw)


# ── Graph visualisation with pyvis ──────────────────────────────────────

def render_graph():
    """Build a pyvis interactive graph from everything in Neo4j."""
    try:
        from pyvis.network import Network
    except ImportError:
        st.error("pyvis not installed. Run `pip install pyvis`.")
        return

    nodes = q("MATCH (n) RETURN id(n) AS id, labels(n)[0] AS label, properties(n) AS p")
    rels  = q("MATCH (a)-[r]->(b) RETURN id(a) AS src, id(b) AS tgt, type(r) AS t, properties(r) AS p")

    if not nodes:
        st.warning("Graph is empty — run `python populate_graph.py` first.")
        return

    net = Network(height="700px", width="100%", bgcolor="#0f0f1a", font_color="#e0e0e0")
    net.barnes_hut(gravity=-8000, central_gravity=0.35, spring_length=250, spring_strength=0.01)
    net.set_options("""
    {
      "nodes": {"borderWidth": 2, "shadow": true},
      "edges": {"smooth": {"type": "continuous"}, "shadow": true},
      "interaction": {"hover": true, "tooltipDelay": 100},
      "physics": {"stabilization": {"iterations": 150}}
    }
    """)

    COLORS = {"Company": "#667eea", "Product": "#43a047", "News": "#ff9800"}
    SHAPES = {"Company": "dot", "Product": "diamond", "News": "square"}

    ids = set()
    for n in nodes:
        nid, label, p = n["id"], n["label"], n["p"]
        if label == "Company":
            tl = f"<b>{p.get('name','')}</b> ({p.get('ticker','')})<br>" \
                 f"Price: ${p.get('current_price',0):,.2f}<br>" \
                 f"5d Chg: {p.get('pct_change_5d',0):+.2f}%<br>" \
                 f"Vol: {p.get('volatility',0):.4f}<br>" \
                 f"Mom 20d: {p.get('momentum_20d',0):+.2f}%"
            nlabel = p.get("ticker", "?")
            size = 40
        elif label == "Product":
            tl = f"<b>{p.get('name','')}</b>"
            nlabel = p.get("name", "?")[:22]
            size = 20
        elif label == "News":
            tl = f"<b>{(p.get('title',''))[:90]}</b><br>Source: {p.get('source','')}<br>{p.get('date','')}"
            nlabel = (p.get("title", "") or "")[:28] + "…"
            size = 15
        else:
            tl = str(p); nlabel = "?"; size = 12

        net.add_node(nid, label=nlabel, title=tl,
                     color=COLORS.get(label, "#777"),
                     shape=SHAPES.get(label, "dot"), size=size)
        ids.add(nid)

    EDGE_COLORS = {
        "CORRELATED_WITH": "#7986cb",
        "SAME_SECTOR":     "#66bb6a",
        "PRODUCES":        "#43a047",
        "MENTIONED_IN":    "#ffa726",
        "SUPPLIES_TO":     "#ef5350",
        "COMPETES_WITH":   "#ab47bc",
        "RELATED_NEWS":    "#ffcc80",
    }

    for r in rels:
        if r["src"] not in ids or r["tgt"] not in ids:
            continue
        t = r["t"]; p = r.get("p") or {}
        if t == "CORRELATED_WITH":
            title = f"{t}<br>Pearson: {p.get('pearson',0):.3f} ({p.get('strength','')})"
            width = 1 + abs(p.get("pearson", 0)) * 4
        elif t == "SUPPLIES_TO":
            title = f"{t}<br>{p.get('description','')}"
            width = 2.5
        elif t == "COMPETES_WITH":
            title = f"{t}<br>Category: {p.get('category','')}"
            width = 2
        else:
            title = t
            width = 1.5
        net.add_edge(r["src"], r["tgt"], title=title,
                     color=EDGE_COLORS.get(t, "#555"), width=width)

    html = net.generate_html()
    st.components.v1.html(html, height=720, scrolling=False)


# ── Correlation heatmap ─────────────────────────────────────────────────

def render_heatmap():
    rows = q("""
        MATCH (a:Company)-[r:CORRELATED_WITH]-(b:Company)
        WHERE id(a) < id(b)
        RETURN a.ticker AS a, b.ticker AS b, r.pearson AS corr
    """)
    if not rows:
        st.info("No correlations yet.")
        return
    tickers = sorted({r["a"] for r in rows} | {r["b"] for r in rows})
    mat = pd.DataFrame(1.0, index=tickers, columns=tickers)
    for r in rows:
        mat.loc[r["a"], r["b"]] = r["corr"]
        mat.loc[r["b"], r["a"]] = r["corr"]
    fig = go.Figure(go.Heatmap(
        z=mat.values, x=mat.columns.tolist(), y=mat.index.tolist(),
        colorscale="RdBu", zmid=0,
        text=mat.values.round(3), texttemplate="%{text}", textfont={"size": 10},
    ))
    fig.update_layout(title="Return Correlation (Pearson)", height=650, margin=dict(l=60,r=20,t=50,b=60))
    st.plotly_chart(fig, use_container_width=True)


# ── Main ────────────────────────────────────────────────────────────────

def main():
    st.title("🕸️ Stock Network Graph — Neo4j")
    st.caption("Company • Product • News — powered by real stock data & DuckDuckGo news")

    # Sidebar
    st.sidebar.header("⚙️ Controls")
    if st.sidebar.button("🔄 Refresh data from Neo4j", use_container_width=True):
        st.cache_resource.clear()
    st.sidebar.divider()
    st.sidebar.markdown("**Neo4j Browser:** [localhost:7474](http://localhost:7474)")
    st.sidebar.markdown("User: `neo4j` / Pass: `stocknetwork123`")
    st.sidebar.divider()
    st.sidebar.markdown("""
    ### Legend
    🔵 **Company** — stock data from yfinance  
    💎 **Product** — flagship products  
    🟠 **News** — DuckDuckGo live search  
    ─ 🟣 COMPETES_WITH  
    ─ 🔴 SUPPLIES_TO  
    ─ 🔵 CORRELATED_WITH  
    ─ 🟢 SAME_SECTOR / PRODUCES  
    ─ 🟠 MENTIONED_IN  
    """)

    # Stats bar
    stats = get_conn().get_stats()
    nc = stats.get("nodes", {})
    rc = stats.get("relationships", {})
    cols = st.columns(6)
    cols[0].metric("🏢 Companies", nc.get("Company", 0))
    cols[1].metric("📦 Products", nc.get("Product", 0))
    cols[2].metric("📰 News", nc.get("News", 0))
    cols[3].metric("📈 Correlations", rc.get("CORRELATED_WITH", 0))
    cols[4].metric("🔗 Supply Chain", rc.get("SUPPLIES_TO", 0))
    cols[5].metric("⚔️ Competitions", rc.get("COMPETES_WITH", 0))

    st.divider()

    # Tabs
    tab_g, tab_c, tab_corr, tab_n, tab_p, tab_q = st.tabs(
        ["🕸️ Network Graph", "🏢 Companies", "📈 Correlations", "📰 News", "📦 Products", "🔍 Cypher"]
    )

    with tab_g:
        st.subheader("Interactive Stock Network")
        st.caption("🔵 Company · 💎 Product · 🟠 News — hover for details, drag to rearrange")
        render_graph()

    with tab_c:
        st.subheader("Company Details")
        companies = q("""
            MATCH (c:Company)
            OPTIONAL MATCH (c)-[:PRODUCES]->(p:Product)
            RETURN c.ticker AS ticker, c.name AS name, c.sector AS sector,
                   c.current_price AS price, c.pct_change_5d AS change_5d,
                   c.volatility AS vol, c.momentum_20d AS mom,
                   collect(DISTINCT p.name) AS products
            ORDER BY c.ticker
        """)
        for co in companies:
            prods = " ".join(f'<span class="product-badge">{p}</span>' for p in (co.get("products") or []))
            chg = co.get("change_5d", 0) or 0
            emoji = "📈" if chg >= 0 else "📉"
            st.markdown(f"""<div class="company-card">
                <b>{co['ticker']}</b> — {co.get('name','')}<br>
                💰 ${co.get('price',0):,.2f} &nbsp; {emoji} {chg:+.2f}% (5d) &nbsp;
                Vol: {co.get('vol',0):.4f} &nbsp; Mom: {co.get('mom',0):+.2f}%<br>
                {prods}
            </div>""", unsafe_allow_html=True)

    with tab_corr:
        render_heatmap()
        st.divider()
        st.subheader("Top Correlations")
        corrs = q("""
            MATCH (a:Company)-[r:CORRELATED_WITH]-(b:Company)
            WHERE id(a) < id(b)
            RETURN a.ticker AS A, b.ticker AS B, r.pearson AS pearson,
                   r.strength AS strength, r.direction AS dir
            ORDER BY abs(r.pearson) DESC
        """)
        if corrs:
            st.dataframe(pd.DataFrame(corrs), use_container_width=True)

    with tab_n:
        st.subheader("Recent News")
        news = q("""
            MATCH (c:Company)-[:MENTIONED_IN]->(n:News)
            RETURN c.ticker AS ticker, n.title AS title, n.source AS source,
                   n.date AS date, n.url AS url, n.snippet AS snippet
            ORDER BY n.date DESC
        """)
        for item in news:
            st.markdown(f"""<div class="news-card">
                <b>{item.get('ticker','')}</b> —
                <a href="{item.get('url','#')}" target="_blank">{item.get('title','')}</a><br>
                <small>🗞️ {item.get('source','')} · 📅 {item.get('date','')}</small><br>
                <span style="color:#555">{(item.get('snippet',''))[:250]}</span>
            </div>""", unsafe_allow_html=True)

    with tab_p:
        st.subheader("Products & Competition")
        prods = q("""
            MATCH (c:Company)-[:PRODUCES]->(p:Product)
            OPTIONAL MATCH (p)-[r:COMPETES_WITH]-(q:Product)
            RETURN c.ticker AS company, p.name AS product,
                   collect(DISTINCT q.name) AS competes_with
            ORDER BY c.ticker, p.name
        """)
        if prods:
            st.dataframe(pd.DataFrame(prods), use_container_width=True)

    with tab_q:
        st.subheader("Custom Cypher Query")
        cypher = st.text_area("Cypher", "MATCH (n)-[r]->(m) RETURN n, type(r), m LIMIT 25", height=100)
        if st.button("▶️ Run"):
            try:
                st.json(q(cypher))
            except Exception as e:
                st.error(str(e))


if __name__ == "__main__":
    main()
