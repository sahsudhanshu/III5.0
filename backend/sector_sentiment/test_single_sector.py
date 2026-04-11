#!/usr/bin/env python3
"""
Quick test script for analyzing a single sector
Usage: python test_single_sector.py [sector_name]
"""

import sys
from sector_sentiment_engine import SectorSentimentEngine

if __name__ == "__main__":
    sector = sys.argv[1] if len(sys.argv) > 1 else "Semiconductors"
    
    print(f"Starting analysis for: {sector}\n")
    analyzer = SectorSentimentEngine()
    result = analyzer.run_analysis(sector)
    
    if result:
        print("\n📊 Analysis Complete!")
        print(f"Signal: {result['signal']}")
        print(f"Confidence: {result['confidence']}")
