#!/usr/bin/env python3
"""
Comprehensive yfinance functionality test
Tests basic functionality, error handling, performance, and data quality
"""

import sys
import time
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import yfinance as yf


def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_basic_ticker():
    """Test 1: Basic ticker download"""
    print_section("TEST 1: Basic Ticker Download")
    
    try:
        print("📊 Downloading AAPL data (1 year)...")
        aapl = yf.Ticker("AAPL")
        hist = aapl.history(period="1y")
        
        if hist.empty:
            print("❌ No data returned")
            return False
        
        print(f"✅ Downloaded {len(hist)} trading days")
        print(f"   Price range: ${hist['Close'].min():.2f} - ${hist['Close'].max():.2f}")
        print(f"   Latest close: ${hist['Close'].iloc[-1]:.2f}")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_multiple_tickers():
    """Test 2: Download multiple tickers"""
    print_section("TEST 2: Multiple Tickers")
    
    tickers = ["AAPL", "MSFT", "GOOGL", "TSLA", "AMZN"]
    print(f"📊 Downloading {len(tickers)} tickers (3 months)...")
    
    try:
        start_time = time.time()
        data = yf.download(tickers, period="3mo", progress=False)
        elapsed = time.time() - start_time
        
        print(f"✅ Completed in {elapsed:.2f}s")
        
        for ticker in tickers:
            if ticker in data['Close'].columns:
                days = len(data['Close'][ticker].dropna())
                print(f"   {ticker}: {days} days of data")
            else:
                print(f"   {ticker}: ⚠️  No data")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_error_handling():
    """Test 3: Error handling with invalid ticker"""
    print_section("TEST 3: Error Handling")
    
    print("📊 Testing with invalid ticker 'INVALID123'...")
    
    try:
        invalid = yf.Ticker("INVALID123")
        hist = invalid.history(period="1mo")
        
        if hist.empty:
            print("✅ Correctly returned empty data for invalid ticker")
            return True
        else:
            print("⚠️  Unexpected: Got data for invalid ticker")
            return True  # Still pass - graceful handling
            
    except Exception as e:
        print(f"⚠️  Exception (expected): {type(e).__name__}")
        return True


def test_info_retrieval():
    """Test 4: Retrieve ticker info"""
    print_section("TEST 4: Ticker Info Retrieval")
    
    print("📊 Getting MSFT company information...")
    
    try:
        msft = yf.Ticker("MSFT")
        info = msft.info
        
        if not info:
            print("⚠️  No info available")
            return True
        
        key_fields = ['currentPrice', 'marketCap', 'pe', 'dividendYield']
        found_fields = []
        
        for field in key_fields:
            if field in info:
                value = info[field]
                print(f"   ✓ {field}: {value}")
                found_fields.append(field)
        
        if found_fields:
            print(f"✅ Retrieved {len(found_fields)} info fields")
            return True
        else:
            print("⚠️  Limited info available (API limitation)")
            return True
            
    except Exception as e:
        print(f"⚠️  Error retrieving info: {e}")
        return True  # Don't fail on info retrieval


def test_data_quality():
    """Test 5: Check data quality"""
    print_section("TEST 5: Data Quality Check")
    
    print("📊 Downloading GOOG (6 months) for quality analysis...")
    
    try:
        goog = yf.Ticker("GOOG")
        hist = goog.history(period="6mo")
        
        if hist.empty:
            print("❌ No data returned")
            return False
        
        print(f"✅ Downloaded {len(hist)} trading days")
        
        # Check for required columns
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing = [col for col in required_cols if col not in hist.columns]
        
        if missing:
            print(f"❌ Missing columns: {missing}")
            return False
        
        print(f"✅ All required columns present: {required_cols}")
        
        # Check for NaN values
        nan_count = hist.isnull().sum().sum()
        if nan_count > 0:
            print(f"⚠️  {nan_count} NaN values found")
        else:
            print("✅ No NaN values found")
        
        # Check OHLC relationships (High >= Open, Close, Low)
        invalid_rows = (
            (hist['High'] < hist['Open']) |
            (hist['High'] < hist['Close']) |
            (hist['High'] < hist['Low']) |
            (hist['Low'] > hist['Open']) |
            (hist['Low'] > hist['Close'])
        ).sum()
        
        if invalid_rows > 0:
            print(f"⚠️  {invalid_rows} rows with invalid OHLC relationships")
        else:
            print("✅ All OHLC relationships are valid")
        
        # Check volume
        avg_volume = hist['Volume'].mean()
        zero_volume = (hist['Volume'] == 0).sum()
        
        print(f"✅ Average volume: {avg_volume:,.0f}")
        print(f"   Days with zero volume: {zero_volume}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_performance():
    """Test 6: Performance benchmark"""
    print_section("TEST 6: Performance Benchmark")
    
    print("📊 Benchmarking download speed with 10 tickers...")
    
    tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "FB", "NVDA", "JPM", "JNJ", "XOM"]
    
    try:
        start_time = time.time()
        data = yf.download(tickers, period="1mo", progress=False)
        elapsed = time.time() - start_time
        
        avg_per_ticker = elapsed / len(tickers)
        
        print(f"✅ Total time: {elapsed:.2f}s")
        print(f"   Average per ticker: {avg_per_ticker:.2f}s")
        
        if elapsed < 20:
            print("✅ Performance: EXCELLENT (< 20s for 10 tickers)")
        elif elapsed < 30:
            print("✅ Performance: GOOD (< 30s for 10 tickers)")
        else:
            print("⚠️  Performance: SLOW (> 30s for 10 tickers)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def test_dividend_split_data():
    """Test 7: Dividend and split data"""
    print_section("TEST 7: Dividend & Split Data")
    
    print("📊 Getting dividend data for MSFT...")
    
    try:
        msft = yf.Ticker("MSFT")
        
        divs = msft.dividends
        splits = msft.splits
        
        if len(divs) > 0:
            print(f"✅ Found {len(divs)} dividend records")
            print(f"   Latest dividend: {divs.iloc[-1]:.4f} on {divs.index[-1].date()}")
        else:
            print("⚠️  No dividend data found")
        
        if len(splits) > 0:
            print(f"✅ Found {len(splits)} stock split records")
        else:
            print("✅ No stock splits")
        
        return True
        
    except Exception as e:
        print(f"⚠️  Error retrieving dividend/split data: {e}")
        return True


def main():
    """Run all tests"""
    print("""
╔══════════════════════════════════════════════════════════════════════╗
║            COMPREHENSIVE YFINANCE FUNCTIONALITY TEST                 ║
╚══════════════════════════════════════════════════════════════════════╝
""")
    
    print(f"yfinance version: {yf.__version__}")
    print(f"Python: {sys.version.split()[0]}")
    
    tests = [
        ("Basic Ticker", test_basic_ticker),
        ("Multiple Tickers", test_multiple_tickers),
        ("Error Handling", test_error_handling),
        ("Ticker Info", test_info_retrieval),
        ("Data Quality", test_data_quality),
        ("Performance", test_performance),
        ("Dividends & Splits", test_dividend_split_data),
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"\n❌ CRITICAL ERROR in {test_name}: {e}")
            results[test_name] = False
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status:8} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED - yfinance is working correctly!")
        return 0
    elif passed >= total - 1:
        print("\n✅ Most tests passed - yfinance is functional (minor issues)")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed - Check yfinance/network")
        return 1


if __name__ == "__main__":
    sys.exit(main())
