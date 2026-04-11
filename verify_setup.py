#!/usr/bin/env python3
"""
Quick setup verification script
"""

import sys
import os
from pathlib import Path

def verify_setup():
    """Verify proxy and data fetching setup."""
    
    print("\n" + "="*70)
    print("STOCK NETWORK - SETUP VERIFICATION".center(70))
    print("="*70 + "\n")
    
    # Check .env file
    print("1️⃣  Checking .env file...")
    env_file = Path(".env")
    if env_file.exists():
        print("   ✅ .env file found")
        with open(env_file) as f:
            for line in f:
                if "PROXY" in line and not line.startswith("#"):
                    print(f"   📍 {line.strip()}")
    else:
        print("   ⚠️  .env file not found (creating default)")
        # Create default .env
        
    # Check dependencies
    print("\n2️⃣  Checking dependencies...")
    deps = {
        "streamlit": "Web UI framework",
        "pandas": "Data processing",
        "numpy": "Numerical computing",
        "plotly": "Interactive graphs",
        "yfinance": "Stock data",
        "networkx": "Graph analysis"
    }
    
    missing = []
    for pkg, desc in deps.items():
        try:
            __import__(pkg)
            print(f"   ✅ {pkg:20} - {desc}")
        except ImportError:
            print(f"   ❌ {pkg:20} - {desc} (MISSING)")
            missing.append(pkg)
    
    if missing:
        print(f"\n   ⚠️  Install missing: pip install {' '.join(missing)}")
    
    # Test proxy
    print("\n3️⃣  Testing proxy connection...")
    try:
        import requests
        proxy_addr = os.environ.get("PROXY_ADDRESS", "172.31.2.4")
        proxy_port = os.environ.get("PROXY_PORT", "8080")
        proxy_url = f"http://{proxy_addr}:{proxy_port}"
        
        response = requests.get(
            "http://httpbin.org/delay/0",
            proxies={"http": proxy_url, "https": proxy_url},
            timeout=5
        )
        
        if response.status_code == 200:
            print(f"   ✅ Proxy working: {proxy_addr}:{proxy_port}")
        else:
            print(f"   ⚠️  Proxy returned status {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  Proxy connection failed: {type(e).__name__}")
        print("      System will use direct connection or mock data")
    
    # Test data fetching
    print("\n4️⃣  Testing data fetching...")
    try:
        sys.path.insert(0, "stock_network")
        from data_fetch import fetch_stock_data
        
        print("   Fetching AAPL data (1mo)...")
        data = fetch_stock_data(["AAPL"], period="1mo")
        
        if "AAPL" in data:
            df = data["AAPL"]
            print(f"   ✅ Successfully fetched {len(df)} days of data")
            print(f"      Current price range: ${df['Close'].min():.2f} - ${df['Close'].max():.2f}")
    except Exception as e:
        print(f"   ❌ Data fetch failed: {e}")
    
    # Check app files
    print("\n5️⃣  Checking app files...")
    required_files = [
        "stock_network/app.py",
        "stock_network/data_fetch.py",
        "stock_network/processing.py",
        "stock_network/analysis.py",
        "stock_network/graph_builder.py",
        "stock_network/visualization.py"
    ]
    
    for file in required_files:
        if Path(file).exists():
            size = Path(file).stat().st_size
            print(f"   ✅ {file:40} ({size:,} bytes)")
        else:
            print(f"   ❌ {file:40} (MISSING)")
    
    # Summary
    print("\n" + "="*70)
    print("READY TO RUN!".center(70))
    print("="*70)
    
    print("\n📌 Next steps:\n")
    print("   Option 1: Web UI (Interactive)")
    print("   $ streamlit run stock_network/app.py\n")
    
    print("   Option 2: Quick Test")
    print("   $ python stock_network/demo.py AAPL,MSFT\n")
    
    print("   Option 3: Trading Agent")
    print("   $ python main.py\n")
    
    print("="*70 + "\n")


if __name__ == "__main__":
    verify_setup()
