#!/usr/bin/env python3
"""
System Validation & Testing Script
Verifies both Trading Agent and Stock Network are properly configured
Run: python validate_system.py
"""

import sys
import importlib.util
from pathlib import Path


def check_module(module_name: str, import_name: str = None) -> tuple[bool, str]:
    """Check if a module is installed."""
    import_name = import_name or module_name
    try:
        importlib.import_module(import_name)
        return True, f"✓ {module_name} installed"
    except ImportError as e:
        return False, f"✗ {module_name} missing: {e}"


def check_file(filepath: str) -> tuple[bool, str]:
    """Check if a file exists."""
    if Path(filepath).exists():
        return True, f"✓ Found: {filepath}"
    else:
        return False, f"✗ Missing: {filepath}"


def test_trading_agent():
    """Validate trading agent setup."""
    print("\n" + "=" * 70)
    print("TRADING AGENT VALIDATION".center(70))
    print("=" * 70)
    
    issues = []
    
    # Check Python dependencies
    print("\n[Dependencies]")
    deps = [
        ("langchain", "langchain"),
        ("LangGraph", "langgraph"),
        ("LLaMA API", "langchain_nvidia_ai_endpoints"),
        ("yfinance", "yfinance"),
        ("pandas", "pandas"),
    ]
    
    for dep_name, import_name in deps:
        ok, msg = check_module(dep_name, import_name)
        print(msg)
        if not ok:
            issues.append(f"Install: pip install {import_name}")
    
    # Check files
    print("\n[Required Files]")
    files = [
        "main.py",
        "src/trading_agent/__init__.py",
        "src/trading_agent/agents.py",
        "src/trading_agent/graph.py",
        "src/trading_agent/state.py",
        "src/trading_agent/tools/market_data.py",
        "src/trading_agent/tools/web_search.py",
    ]
    
    for filepath in files:
        ok, msg = check_file(filepath)
        print(msg)
        if not ok:
            issues.append(f"Restore file: {filepath}")
    
    # Test imports
    print("\n[Module Imports]")
    try:
        from src.trading_agent.graph import create_graph
        print("✓ Can import: create_graph()")
    except Exception as e:
        print(f"✗ Cannot import create_graph(): {e}")
        issues.append("Check src/trading_agent/graph.py syntax")
    
    try:
        from src.trading_agent.agents import market_agent, news_agent, risk_agent
        print("✓ Can import: market_agent, news_agent, risk_agent")
    except Exception as e:
        print(f"✗ Cannot import agents: {e}")
        issues.append("Check src/trading_agent/agents.py syntax")
    
    try:
        from src.trading_agent.tools.market_data import get_market_snapshot
        print("✓ Can import: get_market_snapshot()")
    except Exception as e:
        print(f"✗ Cannot import market_data: {e}")
        issues.append("Check src/trading_agent/tools/market_data.py")
    
    # Environment check
    print("\n[Environment]")
    import os
    if "NVIDIA_API_KEY" in os.environ:
        print("✓ NVIDIA_API_KEY is set")
    else:
        print("⚠ NVIDIA_API_KEY not set (needed for LLaMA inference)")
        issues.append("Set: export NVIDIA_API_KEY='your_key_here'")
    
    if "TAVILY_API_KEY" in os.environ:
        print("✓ TAVILY_API_KEY is set")
    else:
        print("⚠ TAVILY_API_KEY not set (will use mock news)")
    
    # Results
    print("\n" + "-" * 70)
    if issues:
        print(f"⚠ {len(issues)} issue(s) found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        return False
    else:
        print("✓ Trading agent is ready to use!")
        print("  Run: python main.py")
        return True


def test_stock_network():
    """Validate stock network analyzer setup."""
    print("\n" + "=" * 70)
    print("STOCK NETWORK ANALYZER VALIDATION".center(70))
    print("=" * 70)
    
    issues = []
    
    # Check Python dependencies
    print("\n[Dependencies]")
    deps = [
        ("streamlit", "streamlit"),
        ("plotly", "plotly"),
        ("pandas", "pandas"),
        ("numpy", "numpy"),
        ("networkx", "networkx"),
        ("yfinance", "yfinance"),
        ("scipy", "scipy"),
        ("statsmodels", "statsmodels"),
    ]
    
    for dep_name, import_name in deps:
        ok, msg = check_module(dep_name, import_name)
        print(msg)
        if not ok:
            issues.append(f"Install: pip install {import_name}")
    
    # Check files
    print("\n[Stock Network Files]")
    stock_network_files = [
        "stock_network/__init__.py",
        "stock_network/app.py",
        "stock_network/demo.py",
        "stock_network/data_fetch.py",
        "stock_network/processing.py",
        "stock_network/analysis.py",
        "stock_network/graph_builder.py",
        "stock_network/visualization.py",
        "stock_network/requirements.txt",
        "stock_network/README.md",
    ]
    
    for filepath in stock_network_files:
        ok, msg = check_file(filepath)
        print(msg)
        if not ok:
            issues.append(f"Restore file: {filepath}")
    
    # Test imports
    print("\n[Module Imports]")
    
    # Add stock_network to path
    sys.path.insert(0, str(Path.cwd() / "stock_network"))
    
    try:
        from data_fetch import fetch_stock_data, align_data
        print("✓ Can import: data_fetch functions")
    except Exception as e:
        print(f"✗ Cannot import data_fetch: {e}")
        issues.append("Check stock_network/data_fetch.py syntax")
    
    try:
        from processing import compute_returns, normalize_data
        print("✓ Can import: processing functions")
    except Exception as e:
        print(f"✗ Cannot import processing: {e}")
        issues.append("Check stock_network/processing.py syntax")
    
    try:
        from analysis import compute_correlation_matrix, compute_lagged_correlation
        print("✓ Can import: analysis functions")
    except Exception as e:
        print(f"✗ Cannot import analysis: {e}")
        issues.append("Check stock_network/analysis.py syntax")
    
    try:
        from graph_builder import build_graph, get_graph_metrics
        print("✓ Can import: graph_builder functions")
    except Exception as e:
        print(f"✗ Cannot import graph_builder: {e}")
        issues.append("Check stock_network/graph_builder.py syntax")
    
    try:
        from visualization import plot_network_graph, plot_correlation_heatmap
        print("✓ Can import: visualization functions")
    except Exception as e:
        print(f"✗ Cannot import visualization: {e}")
        issues.append("Check stock_network/visualization.py syntax")
    
    # Results
    print("\n" + "-" * 70)
    if issues:
        print(f"⚠ {len(issues)} issue(s) found:")
        for i, issue in enumerate(issues, 1):
            print(f"  {i}. {issue}")
        return False
    else:
        print("✓ Stock network analyzer is ready to use!")
        print("  Run (interactive): streamlit run stock_network/app.py")
        print("  Run (script): python stock_network/demo.py AAPL,MSFT")
        return True


def test_quick_demo():
    """Run a quick demo of stock network."""
    print("\n" + "=" * 70)
    print("QUICK DEMO: Stock Network with 3 Stocks".center(70))
    print("=" * 70)
    
    try:
        sys.path.insert(0, str(Path.cwd() / "stock_network"))
        
        from data_fetch import fetch_stock_data, align_data, get_close_prices
        from processing import compute_returns
        from analysis import compute_correlation_matrix, compute_lagged_correlation, filter_edges
        
        print("\nFetching data for AAPL, MSFT, GOOGL...")
        raw = fetch_stock_data(['AAPL', 'MSFT', 'GOOGL'], period='3mo')
        data = align_data(raw)
        prices = get_close_prices(data)
        
        print(f"✓ Got {len(prices)} trading days of data")
        
        print("\nComputing returns...")
        returns = compute_returns(prices)
        
        print("✓ Computed returns")
        
        print("\nAnalyzing correlations...")
        corr_matrix = compute_correlation_matrix(returns)
        print(f"✓ Correlation matrix:\n{corr_matrix.round(3)}")
        
        print("\nTesting lagged correlation...")
        lagged = compute_lagged_correlation(returns, max_lag=3)
        lagged_filtered = filter_edges(lagged, min_correlation=0.3)
        
        if lagged_filtered:
            print(f"✓ Found {len(lagged_filtered)} relationships:")
            for (a, b), info in list(lagged_filtered.items())[:3]:
                print(f"  {a}↔{b}: corr={info['correlation']:.3f}, lag={info['lag']:+d}")
        else:
            print("✓ No strong correlations in this period")
        
        return True
        
    except Exception as e:
        print(f"✗ Quick demo failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main validation routine."""
    print("\n")
    print("╔" + "=" * 68 + "╗")
    print("║" + "SYSTEM VALIDATION & DIAGNOSTICS".center(68) + "║")
    print("╚" + "=" * 68 + "╝")
    
    # Test both systems
    trading_ok = test_trading_agent()
    network_ok = test_stock_network()
    demo_ok = test_quick_demo()
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY".center(70))
    print("=" * 70)
    
    status = {
        "Trading Agent": "✓ Ready" if trading_ok else "✗ Issues found",
        "Stock Network": "✓ Ready" if network_ok else "✗ Issues found",
        "Quick Demo": "✓ Passed" if demo_ok else "✗ Failed",
    }
    
    for system, result in status.items():
        print(f"{system:.<50} {result}")
    
    all_ok = trading_ok and network_ok and demo_ok
    
    print("\n" + "-" * 70)
    if all_ok:
        print("✓ All systems validated successfully!")
        print("\nNext steps:")
        print("  1. Terminal chatbot: python main.py")
        print("  2. Stock network (web): streamlit run stock_network/app.py")
        print("  3. Stock network (script): python stock_network/demo.py")
        return 0
    else:
        print("⚠ Some issues detected. Please fix them before running.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
