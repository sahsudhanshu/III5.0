"""
Stock Network Analyzer - Streamlit Web App
Async parallel processing for fast stock relationship analysis
Shows companies as nodes with connections based on recent stock data
"""

import streamlit as st
import pandas as pd
import numpy as np
from typing import Dict, Tuple
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import plotly.graph_objects as go
import plotly.express as px

# Import local modules
from data_fetch import fetch_stock_data, align_data, get_close_prices
from processing import compute_returns, get_summary_stats
from analysis import compute_correlation_matrix, compute_lagged_correlation, filter_edges
from graph_builder import build_graph, get_graph_metrics, get_node_properties, identify_clusters
from visualization import plot_correlation_heatmap, plot_network_graph, plot_time_series_comparison

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

st.set_page_config(
    page_title="Stock Network Analyzer",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.markdown("""
<style>
.connection-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 20px;
    border-radius: 10px;
    color: white;
    margin: 10px 0;
}
.positive-corr {
    background-color: #e8f5e9;
    padding: 15px;
    border-left: 4px solid #4caf50;
    border-radius: 5px;
}
.negative-corr {
    background-color: #ffebee;
    padding: 15px;
    border-left: 4px solid #f44336;
    border-radius: 5px;
}
.node-company {
    background-color: #f5f5f5;
    padding: 10px;
    border-radius: 5px;
    margin: 5px 0;
    border-left: 3px solid #2196F3;
}
</style>
""", unsafe_allow_html=True)


# === CACHING & PARALLEL FUNCTIONS ===

@st.cache_data
def load_stock_data_parallel(tickers_tuple: Tuple, period: str):
    """Fetch stock data in parallel."""
    tickers = list(tickers_tuple)
    logger.info(f"🔄 Fetching {len(tickers)} stocks in parallel...")
    
    try:
        # Fetch data
        raw_data = fetch_stock_data(tickers, period=period)
        aligned = align_data(raw_data)
        prices = get_close_prices(aligned)
        
        logger.info(f"✅ Fetched all {len(tickers)} stocks successfully")
        return prices
    except Exception as e:
        logger.error(f"❌ Error fetching data: {e}")
        st.error(f"❌ Failed to fetch data: {e}")
        return None


@st.cache_data
def compute_correlations_parallel(prices_str_key: str, max_lag: int, min_corr: float, _prices: pd.DataFrame):
    """Compute all correlations in parallel."""
    logger.info("🔄 Computing correlations in parallel...")
    
    try:
        # Compute returns
        returns = compute_returns(_prices, method="log")
        
        # Parallel computation
        with ThreadPoolExecutor(max_workers=2) as executor:
            corr_future = executor.submit(compute_correlation_matrix, returns)
            lagged_future = executor.submit(compute_lagged_correlation, returns, max_lag)
            
            corr_matrix = corr_future.result(timeout=30)
            lagged_corr = lagged_future.result(timeout=30)
        
        # Filter edges
        lagged_filtered = filter_edges(lagged_corr, min_correlation=min_corr)
        
        logger.info(f"✅ Found {len(lagged_filtered)} strong connections")
        return {
            "returns": returns,
            "correlation_matrix": corr_matrix,
            "lagged_correlations": lagged_filtered
        }
    except Exception as e:
        logger.error(f"❌ Correlation error: {e}")
        st.error(f"❌ Analysis failed: {e}")
        return None


def get_recent_price_change(prices: pd.DataFrame, ticker: str) -> Dict:
    """Get recent price change for a ticker."""
    if ticker not in prices.columns:
        return {"error": f"Ticker {ticker} not found"}
    
    recent_prices = prices[ticker]
    current_price = recent_prices.iloc[-1]
    prev_price = recent_prices.iloc[-5] if len(recent_prices) >= 5 else recent_prices.iloc[0]
    price_change = ((current_price - prev_price) / prev_price) * 100
    
    return {
        "ticker": ticker,
        "current_price": float(current_price),
        "price_change_pct": float(price_change),
        "min_price": float(recent_prices.min()),
        "max_price": float(recent_prices.max()),
        "avg_price": float(recent_prices.mean())
    }


def analyze_connection(ticker_a: str, ticker_b: str, lagged_corr: Dict, prices: pd.DataFrame) -> Dict:
    """Analyze connection between two companies based on recent data."""
    
    key = tuple(sorted([ticker_a, ticker_b]))
    
    if key not in lagged_corr:
        correlation = 0.0
        lag = 0
        direction = "No significant correlation"
    else:
        info = lagged_corr[key]
        correlation = info['correlation']
        lag = info['lag']
        direction = info['direction']
    
    # Get price changes
    price_a = get_recent_price_change(prices, ticker_a)
    price_b = get_recent_price_change(prices, ticker_b)
    
    if "error" in price_a or "error" in price_b:
        return {"error": "Could not fetch price data"}
    
    # Interpret correlation
    if abs(correlation) < 0.3:
        strength = "Very Weak"
        color = "gray"
    elif abs(correlation) < 0.5:
        strength = "Weak"
        color = "orange"
    elif abs(correlation) < 0.7:
        strength = "Moderate"
        color = "yellow"
    else:
        strength = "Strong"
        color = "green" if correlation > 0 else "red"
    
    # Movement interpretation
    if correlation > 0:
        movement = "🟢 Move Together (Positive Correlation)"
        movement_type = "sync"
    else:
        movement = "🔴 Move Opposite (Negative Correlation)"
        movement_type = "inverse"
    
    # Lag interpretation
    if lag > 0:
        lag_text = f"⏱️ {ticker_a} leads by {abs(lag)} days"
    elif lag < 0:
        lag_text = f"⏱️ {ticker_b} leads by {abs(lag)} days"
    else:
        lag_text = "⏱️ Move simultaneously"
    
    return {
        "ticker_a": ticker_a,
        "ticker_b": ticker_b,
        "correlation": round(correlation, 4),
        "strength": strength,
        "color": color,
        "movement": movement,
        "movement_type": movement_type,
        "lag": lag,
        "lag_text": lag_text,
        "direction": direction,
        "price_a": price_a,
        "price_b": price_b,
        "recent_sync": "YES" if abs(price_a["price_change_pct"] - price_b["price_change_pct"]) < 5 else "NO"
    }


def main():
    
    st.title("📊 Stock Network Analyzer")
    st.markdown("**Analyze stock relationships and company connections based on real-time price movements**")
    
    # Mode selection
    st.sidebar.header("⚙️ Settings")
    mode = st.sidebar.radio(
        "Select Analysis Mode",
        ["🌐 Full Network Graph", "🔗 Compare Two Companies"],
        help="Network: See all companies and their connections | Compare: Deep dive into two companies"
    )
    
    # Common parameters
    period = st.sidebar.selectbox(
        "Data Period",
        ["1mo", "3mo", "6mo", "1y", "2y"],
        index=2,
        help="Historical period for analysis"
    )
    
    max_lag = st.sidebar.slider("Max Lag (days)", 1, 10, 5)
    min_corr = st.sidebar.slider("Min Correlation", 0.0, 1.0, 0.2, 0.05)
    
    st.sidebar.divider()
    
    # === MODE 1: FULL NETWORK ===
    if mode == "🌐 Full Network Graph":
        
        st.sidebar.subheader("📈 Network Configuration")
        
        ticker_input = st.sidebar.text_input(
            "Enter Company Tickers",
            value="AAPL,MSFT,GOOGL,NVDA,TSLA,AMZN",
            help="Comma-separated list: AAPL,MSFT,GOOGL"
        )
        
        tickers = [t.strip().upper() for t in ticker_input.split(",") if t.strip()]
        
        if len(tickers) < 2:
            st.error("❌ Enter at least 2 company tickers")
            return
        
        if st.sidebar.button("🔍 Build Network", key="build_net", use_container_width=True):
            
            # Progress tracking
            prog = st.progress(0, text="Initializing...")
            
            # Fetch data
            prog.progress(20, text="📊 Fetching stock prices...")
            prices = load_stock_data_parallel(tuple(sorted(tickers)), period)
            
            if prices is None:
                st.error("❌ Could not fetch data")
                return
            
            # Compute correlations
            prog.progress(50, text="🔄 Analyzing relationships...")
            analysis_result = compute_correlations_parallel(
                prices_str_key=str(sorted(tickers)),
                max_lag=max_lag,
                min_corr=min_corr,
                _prices=prices
            )
            
            if analysis_result is None:
                return
            
            prog.progress(80, text="🎨 Building network...")
            
            # Store in session
            st.session_state.prices = prices
            st.session_state.returns = analysis_result["returns"]
            st.session_state.correlation_matrix = analysis_result["correlation_matrix"]
            st.session_state.lagged_corr = analysis_result["lagged_correlations"]
            st.session_state.tickers = tickers
            
            prog.progress(100, text="✅ Complete!")
            prog.empty()
        
        # Display network results
        if "tickers" in st.session_state:
            st.divider()
            st.success("✅ Network Analysis Ready")
            
            # Build graph
            G = build_graph(st.session_state.tickers, st.session_state.lagged_corr)
            metrics = get_graph_metrics(G)
            
            # Metrics row
            col1, col2, col3, col4, col5 = st.columns(5)
            with col1:
                st.metric("🏢 Companies", metrics['num_nodes'])
            with col2:
                st.metric("🔗 Connections", metrics['num_edges'])
            with col3:
                st.metric("📊 Density", f"{metrics['density']:.2%}")
            with col4:
                st.metric("🎯 Components", metrics['num_connected_components'])
            with col5:
                st.metric("📈 Avg Degree", f"{2*metrics['num_edges']/metrics['num_nodes']:.1f}")
            
            st.divider()
            
            # Network graph
            st.subheader("📈 Company Network Graph")
            st.markdown("**Nodes** = Companies | **Green edges** = Positive correlation | **Red edges** = Negative correlation | **Node size** = Connectivity")
            
            try:
                fig_net = plot_network_graph(G, st.session_state.lagged_corr)
                st.plotly_chart(fig_net, use_container_width=True)
            except Exception as e:
                st.error(f"❌ Graph error: {e}")
            
            st.divider()
            
            # Most connected companies
            st.subheader("🏆 Most Connected Companies")
            node_props = get_node_properties(G)
            sorted_nodes = sorted(node_props.items(), key=lambda x: x[1]['degree'], reverse=True)
            
            for i, (ticker, props) in enumerate(sorted_nodes[:10], 1):
                price_info = get_recent_price_change(st.session_state.prices, ticker)
                change_emoji = "📈" if price_info["price_change_pct"] > 0 else "📉"
                
                st.markdown(f"""
                <div class="node-company">
                <b>{i}. {ticker}</b> {change_emoji} {price_info['price_change_pct']:+.2f}% | 
                <b>Connections:</b> {props['degree']} | 
                <b>Avg Correlation:</b> {props['avg_correlation']:+.3f}
                </div>
                """, unsafe_allow_html=True)
            
            st.divider()
            
            # Tabs
            tab1, tab2, tab3, tab4 = st.tabs([
                "🔥 Correlation Matrix",
                "⏱️ Lagged Correlations",
                "📊 Price Comparison",
                "📋 Statistics"
            ])
            
            with tab1:
                fig_hm = plot_correlation_heatmap(st.session_state.correlation_matrix)
                st.plotly_chart(fig_hm, use_container_width=True)
            
            with tab2:
                st.subheader("Lagged Correlation Details")
                lagged_list = []
                for (a, b), info in st.session_state.lagged_corr.items():
                    lagged_list.append({
                        "Company 1": a,
                        "Company 2": b,
                        "Correlation": f"{info['correlation']:+.3f}",
                        "Lag (days)": info['lag'],
                        "Direction": info['direction']
                    })
                
                if lagged_list:
                    df_lagged = pd.DataFrame(lagged_list)
                    st.dataframe(df_lagged, use_container_width=True)
            
            with tab3:
                col1, col2 = st.columns(2)
                with col1:
                    tick_a = st.selectbox("Company 1", st.session_state.tickers, key="comp1")
                with col2:
                    tick_b = st.selectbox("Company 2", st.session_state.tickers, index=1 if len(st.session_state.tickers) > 1 else 0, key="comp2")
                
                if tick_a != tick_b and tick_a in st.session_state.returns.columns and tick_b in st.session_state.returns.columns:
                    fig_ts = plot_time_series_comparison(st.session_state.returns, tick_a, tick_b)
                    st.plotly_chart(fig_ts, use_container_width=True)
            
            with tab4:
                st.subheader("Summary Statistics")
                stats = get_summary_stats(st.session_state.returns)
                st.dataframe(stats.T, use_container_width=True)
                
                csv = stats.T.to_csv()
                st.download_button(
                    "📥 Download Stats CSV",
                    data=csv,
                    file_name="stats.csv",
                    mime="text/csv"
                )
    
    # === MODE 2: TWO COMPANY COMPARISON ===
    else:
        
        st.sidebar.subheader("🔗 Compare Two Companies")
        
        col1, col2 = st.sidebar.columns(2)
        with col1:
            tick_a = st.text_input("Company 1", value="AAPL", max_chars=5).upper()
        with col2:
            tick_b = st.text_input("Company 2", value="MSFT", max_chars=5).upper()
        
        if st.sidebar.button("📊 Compare", key="compare_btn", use_container_width=True):
            
            if not tick_a or not tick_b:
                st.error("❌ Enter both tickers")
                return
            
            if tick_a == tick_b:
                st.error("❌ Enter different tickers")
                return
            
            tickers = [tick_a, tick_b]
            
            # Fetch
            prog = st.progress(0, text="📊 Fetching prices...")
            prices = load_stock_data_parallel(tuple(tickers), period)
            
            if prices is None:
                return
            
            # Analyze
            prog.progress(50, text="🔄 Analyzing connection...")
            analysis = compute_correlations_parallel(
                prices_str_key=str(tickers),
                max_lag=max_lag,
                min_corr=0.0,  # Show all correlations
                _prices=prices
            )
            
            if analysis is None:
                return
            
            prog.progress(100, text="✅ Ready")
            prog.empty()
            
            # Get connection
            connection = analyze_connection(tick_a, tick_b, analysis["lagged_correlations"], prices)
            
            if "error" in connection:
                st.error(f"❌ {connection['error']}")
                return
            
            st.divider()
            st.success("✅ Comparison Complete")
            
            # Display connection
            st.title(f"🔗 {tick_a} ↔ {tick_b}")
            
            # Connection strength card
            color_class = "positive-corr" if connection["movement_type"] == "sync" else "negative-corr"
            
            st.markdown(f"""
            <div class="{color_class}">
            <h3 style="margin-top: 0;">{connection['strength']} Connection: {connection['correlation']:+.3f}</h3>
            
            {connection['movement']}<br>
            {connection['lag_text']}<br>
            <b>Direction:</b> {connection['direction']}<br>
            <b>Recent Sync:</b> {connection['recent_sync']}
            </div>
            """, unsafe_allow_html=True)
            
            st.divider()
            
            # Price comparison
            st.subheader("💰 Recent Price Information")
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.markdown(f"**{tick_a}**")
                st.metric("Current Price", f"${connection['price_a']['current_price']:.2f}", f"{connection['price_a']['price_change_pct']:+.2f}%")
                st.write(f"Range: ${connection['price_a']['min_price']:.2f} - ${connection['price_a']['max_price']:.2f}")
                st.write(f"Average: ${connection['price_a']['avg_price']:.2f}")
            
            with col2:
                st.markdown(f"**{tick_b}**")
                st.metric("Current Price", f"${connection['price_b']['current_price']:.2f}", f"{connection['price_b']['price_change_pct']:+.2f}%")
                st.write(f"Range: ${connection['price_b']['min_price']:.2f} - ${connection['price_b']['max_price']:.2f}")
                st.write(f"Average: ${connection['price_b']['avg_price']:.2f}")
            
            st.divider()
            
            # Time series
            st.subheader("📈 Price Movement Comparison")
            fig_ts = plot_time_series_comparison(analysis["returns"], tick_a, tick_b)
            st.plotly_chart(fig_ts, use_container_width=True)
            
            # Data export
            st.subheader("📊 Price Data")
            export_data = prices[[tick_a, tick_b]].tail(20)
            st.dataframe(export_data, use_container_width=True)
            
            csv = export_data.to_csv()
            st.download_button(
                "📥 Download Prices",
                data=csv,
                file_name=f"{tick_a}_{tick_b}.csv",
                mime="text/csv"
            )
    
    # Footer
    st.sidebar.divider()
    st.sidebar.markdown("""
    ### 📚 About
    
    **Network Graph:** Shows all companies as nodes, connections based on recent price correlations
    
    **Two Company:** Deep analysis of relationship between two specific companies
    
    **Correlation:** How synchronized stock movements are
    
    **Lag:** If one stock leads/lags the other
    """)


if __name__ == "__main__":
    main()
