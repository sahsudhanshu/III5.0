#!/usr/bin/env python3
"""
Stock Network Analyzer - Standalone Script
Demonstrates the full pipeline without Streamlit.
Run: python demo.py
"""

import sys
import pandas as pd
from typing import List

# Import local modules
from data_fetch import fetch_stock_data, align_data, get_close_prices
from processing import compute_returns, normalize_data, get_summary_stats
from analysis import (
    compute_correlation_matrix,
    compute_lagged_correlation,
    filter_edges,
)
from graph_builder import (
    build_graph,
    get_graph_metrics,
    identify_clusters,
    get_node_properties,
)


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(f"{title:^80}")
    print("=" * 80)


def demonstrate_analysis(tickers: List[str], period: str = "2y", max_lag: int = 5):
    """Run a complete analysis demonstration."""
    
    print_section("STOCK NETWORK RELATIONSHIP ANALYZER")
    print(f"\nAnalyzing: {', '.join(tickers)}")
    print(f"Period: {period} | Max Lag: {max_lag} days")
    
    # Step 1: Fetch data
    print_section("STEP 1: FETCHING STOCK DATA")
    try:
        raw_data = fetch_stock_data(tickers, period=period)
        data = align_data(raw_data)
        prices = get_close_prices(data)
        print(f"✓ Fetched prices: {prices.shape[0]} trading days × {prices.shape[1]} stocks")
    except Exception as e:
        print(f"✗ Error fetching data: {e}")
        return
    
    # Step 2: Compute returns
    print_section("STEP 2: COMPUTING RETURNS")
    try:
        returns = compute_returns(prices, method="log")
        print(f"✓ Computed returns: {returns.shape}")
        print("\nReturn statistics:")
        print(get_summary_stats(returns).round(4))
    except Exception as e:
        print(f"✗ Error computing returns: {e}")
        return
    
    # Step 3: Correlation analysis
    print_section("STEP 3: CORRELATION ANALYSIS")
    try:
        correlation_matrix = compute_correlation_matrix(returns)
        print("\nCorrelation Matrix:")
        print(correlation_matrix.round(3))
    except Exception as e:
        print(f"✗ Error computing correlations: {e}")
        return
    
    # Step 4: Lagged correlation
    print_section("STEP 4: LAGGED CORRELATION ANALYSIS")
    try:
        lagged_corr = compute_lagged_correlation(returns, max_lag=max_lag)
        lagged_corr_filtered = filter_edges(lagged_corr, min_correlation=0.2)
        
        print(f"\nTotal pairs studied: {len(lagged_corr)}")
        print(f"Strong correlations (|r| > 0.5): {len(lagged_corr_filtered)}")
        
        if lagged_corr_filtered:
            print("\nTop relationships (by correlation strength):")
            sorted_pairs = sorted(
                lagged_corr_filtered.items(),
                key=lambda x: abs(x[1]['correlation']),
                reverse=True
            )[:5]
            
            for (ticker_a, ticker_b), info in sorted_pairs:
                print(f"\n  {ticker_a} ↔ {ticker_b}")
                print(f"    Correlation: {info['correlation']:+.3f}")
                print(f"    Lag: {info['lag']:+d} days")
                print(f"    Direction: {info['direction']}")
        else:
            print("\n  ⚠ No strong correlations found in this data period")
    except Exception as e:
        print(f"✗ Error in lagged correlation: {e}")
        return
    
    # Step 5: Graph Analysis
    print_section("STEP 5: NETWORK GRAPH ANALYSIS")
    try:
        G = build_graph(tickers, lagged_corr_filtered)
        metrics = get_graph_metrics(G)
        
        print(f"\nNetwork Metrics:")
        print(f"  • Nodes (stocks): {metrics['num_nodes']}")
        print(f"  • Edges (relationships): {metrics['num_edges']}")
        print(f"  • Density: {metrics['density']:.3f}")
        print(f"  • Components: {metrics['num_connected_components']}")
        
        # Node centrality
        node_props = get_node_properties(G)
        print(f"\nNode Centrality (by degree):")
        sorted_nodes = sorted(node_props.items(), key=lambda x: x[1]['degree'], reverse=True)
        for ticker, props in sorted_nodes:
            print(f"  • {ticker}: degree={props['degree']}, avg_corr={props['avg_correlation']:+.3f}")
        
        # Clusters
        clusters = identify_clusters(G)
        if clusters:
            print(f"\nDetected {len(clusters)} cluster(s):")
            for cluster_name, nodes in clusters.items():
                print(f"  • {cluster_name}: {', '.join(nodes)}")
        else:
            print("\nNo distinct clusters detected")
    except Exception as e:
        print(f"✗ Error in graph analysis: {e}")
        return
    
    # Step 6: Summary
    print_section("ANALYSIS COMPLETE")
    print("\n✓ Stock network analysis finished successfully!")
    print("\nNext steps:")
    print("  1. Run 'streamlit run app.py' for interactive visualization")
    print("  2. Use the Python API for programmatic access")
    print("  3. Export results to CSV for further analysis")


def main():
    """Main entry point."""
    
    # Default tickers
    tickers = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA']
    
    # Custom tickers from command line
    if len(sys.argv) > 1:
        tickers = [t.strip().upper() for t in sys.argv[1].split(",")]
    
    # Run analysis
    try:
        demonstrate_analysis(tickers, period="2y", max_lag=5)
    except KeyboardInterrupt:
        print("\n\n✗ Analysis cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
