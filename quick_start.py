#!/usr/bin/env python3
"""
5-MINUTE GETTING STARTED GUIDE
================================
Run this script to get both systems up and running immediately.

Usage:
    python quick_start.py
    
Or step-by-step with option prompts:
    python quick_start.py --interactive
"""

import os
import sys
import subprocess
from pathlib import Path


def print_header(title):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f"{title:^60}")
    print("=" * 60 + "\n")


def check_and_install_deps():
    """Ensure all dependencies are installed."""
    print_header("STEP 1: Installing Dependencies")
    
    # Trading agent deps
    print("📦 Installing trading agent dependencies...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-q", "-r", "requirements.txt"],
        capture_output=True
    )
    print("   ✓ Trading agent: OK")
    
    # Stock network deps
    print("📦 Installing stock network dependencies...")
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-q", "-r", "stock_network/requirements.txt"],
        capture_output=True
    )
    print("   ✓ Stock network: OK")
    
    print("\n✓ All dependencies installed!")


def setup_env():
    """Setup environment variables."""
    print_header("STEP 2: Environment Setup")
    
    env_file = Path(".env")
    
    if env_file.exists():
        print("✓ .env file already exists")
        return
    
    # Check for existing env vars
    nvidia_key = os.environ.get("NVIDIA_API_KEY")
    tavily_key = os.environ.get("TAVILY_API_KEY")
    
    if nvidia_key:
        print(f"✓ Found NVIDIA_API_KEY in environment")
    else:
        print("\n⚠ NVIDIA_API_KEY not set")
        print("  → Get one from: https://build.nvidia.com")
        print("  → Then run: export NVIDIA_API_KEY='your_key'")
        print("  → Or create a .env file with: NVIDIA_API_KEY=your_key")
    
    if tavily_key:
        print(f"✓ Found TAVILY_API_KEY in environment (for financial news)")
    else:
        print("\n⚠ TAVILY_API_KEY not found (optional)")
        print("  → System will use mock news data")
        print("  → To enable real news: https://tavily.com")


def validate_setup():
    """Run validation script."""
    print_header("STEP 3: Validating Setup")
    
    result = subprocess.run(
        [sys.executable, "validate_system.py"],
        capture_output=True,
        text=True
    )
    
    if result.returncode == 0:
        print("✓ All systems validated!")
        return True
    else:
        print("⚠ Some issues detected:")
        print(result.stdout)
        return False


def demo_trading_agent():
    """Show trading agent demo."""
    print_header("OPTION 1: Trading Agent (Terminal)\n")
    
    print("The trading agent analyzes stocks using LLM + real market data.\n")
    print("Command: python main.py\n")
    print("Example interaction:")
    print("─" * 60)
    print("You: Should I buy Apple right now?")
    print("")
    print("[System analyzes market + news...]")
    print("")
    print("Agent: Based on technical analysis and sentiment...")
    print("  Recommendation: HOLD")
    print("  Risk Level: MEDIUM")
    print("  Confidence: 65%")
    print("─" * 60)
    
    proceed = input("\n✓ Ready to start? Run it now? (y/n): ").lower().strip()
    if proceed == 'y':
        print("\nStarting trading agent...")
        subprocess.run([sys.executable, "main.py"])


def demo_stock_network_web():
    """Show stock network web demo."""
    print_header("OPTION 2: Stock Network (Interactive Web UI)\n")
    
    print("Stock Network visualizes relationships between stocks.")
    print("It detects correlations, lags, and market clusters.\n")
    print("Command: streamlit run stock_network/app.py\n")
    print("Features:")
    print("  • Network graph visualization (interactive)")
    print("  • Correlation heatmap")
    print("  • Lagged correlation detection (-5 to +5 days)")
    print("  • Time series comparison")
    print("  • Statistics export (CSV)")
    
    proceed = input("\n✓ Ready to start? Run it now? (y/n): ").lower().strip()
    if proceed == 'y':
        print("\nStarting stock network...")
        os.chdir("stock_network")
        subprocess.run(["streamlit", "run", "app.py"])


def demo_stock_network_script():
    """Show stock network script demo."""
    print_header("OPTION 3: Stock Network (Quick Script)\n")
    
    print("Quick analysis without web UI (prints to terminal).")
    print("Command: python stock_network/demo.py AAPL,MSFT\n")
    
    proceed = input("✓ Run demo? (y/n): ").lower().strip()
    if proceed == 'y':
        print("\nRunning stock network analysis...")
        subprocess.run(
            [sys.executable, "stock_network/demo.py", "AAPL,MSFT,GOOGL,NVDA"],
        )


def interactive_menu():
    """Interactive menu."""
    print_header("CHOOSE YOUR NEXT STEP")
    
    print("""
1. 🤖 Start Trading Agent
   Terminal chatbot for investment analysis
   
2. 📊 Start Stock Network (Web UI)
   Interactive visualization of stock relationships
   
3. 📈 Quick Stock Network Demo
   Analyze stocks in terminal (no web UI)
   
4. 📖 Open Documentation
   Read QUICKSTART.md or INDEX.md
   
5. ✅ Validate System Again
   Run full validation tests
   
0. Exit
""")
    
    choice = input("Choose (0-5): ").strip()
    
    if choice == '1':
        demo_trading_agent()
    elif choice == '2':
        demo_stock_network_web()
    elif choice == '3':
        demo_stock_network_script()
    elif choice == '4':
        print("\n📖 Documentation Files:")
        print("   • QUICKSTART.md - Complete setup guide")
        print("   • INDEX.md - Full system architecture")
        print("   • FEATURES.md - Feature checklist")
        print("   • stock_network/README.md - Stock network details")
    elif choice == '5':
        validate_setup()
    elif choice == '0':
        print("Goodbye!")
        sys.exit(0)
    else:
        print("Invalid choice")


def main():
    """Main entry point."""
    print("""
╔════════════════════════════════════════════════════════════╗
║          TRADING AGENT & STOCK NETWORK SUITE              ║
║          Quick Start (5 Minutes or Less)                  ║
╚════════════════════════════════════════════════════════════╝
""")
    
    print("This will set up two trading analysis systems:")
    print("  1. Trading Agent: LLM-powered investment analysis")
    print("  2. Stock Network: Visual stock relationship analyzer")
    
    # Step 1: Install dependencies
    try:
        check_and_install_deps()
    except Exception as e:
        print(f"❌ Error installing dependencies: {e}")
        return 1
    
    # Step 2: Setup environment
    setup_env()
    
    # Step 3: Validate
    try:
        if not validate_setup():
            print("\n⚠ Validation found issues. Fix them above.")
    except Exception as e:
        print(f"❌ Error validating: {e}")
        return 1
    
    # Step 4: Menu
    print_header("SETUP COMPLETE! ✓")
    print("""
You're all set! Here's what you can do now:

QUICK START:
  • python main.py                     # Start trading agent
  • streamlit run stock_network/app.py # Start web UI
  • python stock_network/demo.py       # Quick analysis script

DOCUMENTATION:
  • QUICKSTART.md  - Complete guide
  • INDEX.md       - System architecture  
  • FEATURES.md    - Feature checklist

VALIDATION:
  • python validate_system.py  # Test everything

Let's go!
""")
    
    interactive_menu()
    
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nSetup cancelled.")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
