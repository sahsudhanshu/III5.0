#!/usr/bin/env python3
"""
Quick Start Guide for Trading Agent Pipeline
Run this to test everything in under 30 seconds
"""

import subprocess
import sys

def run_command(cmd, description):
    """Run a command and report results."""
    print(f"\n{'='*60}")
    print(f"▶ {description}")
    print('='*60)
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=False, timeout=30)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"⏱ Command timed out after 30 seconds")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("\n" + "🚀 " * 20)
    print("TRADING AGENT PIPELINE - QUICK START")
    print("🚀 " * 20)
    
    # Step 1: Validate
    print("\n📋 STEP 1: Validating entire system...")
    validate_ok = run_command(
        "python validate_pipeline.py",
        "Running comprehensive validation"
    )
    
    if not validate_ok:
        print("\n⚠️  Validation had issues. Check .env file for API keys.")
        print("   NVIDIA_API_KEY and TAVILY_API_KEY are required.")
        return 1
    
    print("\n✅ System validation passed!")
    
    # Step 2: Run sample analysis
    print("\n📊 STEP 2: Running sample market analysis...")
    run_ok = run_command(
        'python main.py --query "Should we invest in technology?" --symbols NVDA MSFT GOOG --output sample_output.json --verbose',
        "Running trading agent pipeline with sample query"
    )
    
    if not run_ok:
        print("\n⚠️  Pipeline had issues. This is typically due to LLM API issues.")
        print("   Check NVIDIA and Tavily API keys and rate limits.")
        return 1
    
    print("\n✅ Pipeline executed successfully!")
    
    # Step 3: Summary
    print("\n" + "="*60)
    print("✨ QUICK START COMPLETE!")
    print("="*60)
    
    print("""
Next steps:
1. Review the output in 'sample_output.json'
2. Check 'CHANGES_SUMMARY.md' for what was added
3. Read 'README.md' for full documentation
4. Run your own analysis:
   
   python main.py --query "Your question?" --symbols SYM1 SYM2
   
5. Monitor the database:
   
   sqlite3 trading_memory.db "SELECT COUNT(*) FROM memories;"
   
Tips:
• Use --verbose flag for detailed logging
• Customize risk constraints in src/trading_agent/agents.py  
• Add real market data APIs to src/trading_agent/tools/market_data.py
• Query memory for past decisions using src/trading_agent/memory/long_term.py
""")
    
    print("="*60)
    print("🎉 Your trading agent is ready to use!")
    print("="*60)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
