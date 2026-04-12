#!/usr/bin/env python3
"""
Sector Sentiment Analysis Engine
Uses fine-tuned FinBERT model to analyze financial news sentiment
"""

from datetime import datetime
from pathlib import Path

import pandas as pd
import torch
import torch.nn.functional as F
from gnews import GNews
from transformers import AutoTokenizer, AutoModelForSequenceClassification


class SectorSentimentEngine:
    def __init__(self, model_dir: str | Path | None = None):
        print("🛠️  Initializing AI Engine...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        base_dir = Path(__file__).resolve().parent
        model_path = Path(model_dir) if model_dir else base_dir / "final_trading_model"

        # Load local fine-tuned model
        # use_fast=False avoids hard failures when fast tokenizer backend isn't available
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self.model.to(self.device)
        self.model.eval()
        
        # Initialize Google News Fetcher
        # max_results=50, period='24h' for the most recent trading signals
        self.news_client = GNews(language='en', country='US', period='24h', max_results=50)
        
        # Native mapping from our training session
        self.id2label = {0: "POSITIVE", 1: "NEGATIVE", 2: "NEUTRAL"}
        print(f"✅ Model loaded on {self.device.upper()}. Target: Sector Consensus.")

    def analyze_headlines(self, headlines, sector_query: str = "CUSTOM"):
        """
        Analyze externally-fetched headlines.
        Expect caller to provide the news list (API should not fetch news inside).
        """
        if not headlines:
            return None

        print(f"📰 Received {len(headlines)} headlines. Running batch inference...")

        inputs = self.tokenizer(
            headlines,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=128
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = F.softmax(outputs.logits, dim=-1)
            preds = torch.argmax(probs, dim=-1).tolist()

        pos = preds.count(0)
        neg = preds.count(1)
        neu = preds.count(2)
        score = (pos - neg) / (pos + neg + 1e-5)

        if score > 0.2:
            signal = "STRONG BUY / BULLISH 🚀"
            confidence = "HIGH"
        elif score > 0:
            signal = "BUY / BULLISH ⬆️"
            confidence = "MEDIUM"
        elif score < -0.2:
            signal = "STRONG SELL / BEARISH 📉"
            confidence = "HIGH"
        elif score < 0:
            signal = "SELL / BEARISH ⬇️"
            confidence = "MEDIUM"
        else:
            signal = "HOLD / NEUTRAL ⚖️"
            confidence = "NEUTRAL"

        total = len(headlines)
        pos_pct = (pos / total) * 100
        neg_pct = (neg / total) * 100
        neu_pct = (neu / total) * 100

        per_news = []
        for i, headline in enumerate(headlines):
            label = self.id2label[preds[i]]
            per_news.append(
                {
                    "index": i + 1,
                    "headline": headline,
                    "sentiment": label,
                }
            )

        return {
            "sector": sector_query,
            "total_headlines": total,
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "positive_pct": pos_pct,
            "negative_pct": neg_pct,
            "neutral_pct": neu_pct,
            "sentiment_score": score,
            "signal": signal,
            "confidence": confidence,
            "per_news_sentiment": per_news,
            "timestamp": datetime.now().isoformat()
        }

    def run_analysis(self, sector_query):
        print(f"\n🔍 Fetching latest news for sector: '{sector_query}'...")
        news = self.news_client.get_news(f"{sector_query} stock market")
        
        if not news:
            print("⚠️  No news found for this sector.")
            return None

        headlines = [item['title'] for item in news]
        result = self.analyze_headlines(headlines, sector_query=sector_query)
        if not result:
            return None
        pos = result["positive"]
        neg = result["negative"]
        neu = result["neutral"]
        pos_pct = result["positive_pct"]
        neg_pct = result["negative_pct"]
        neu_pct = result["neutral_pct"]
        score = result["sentiment_score"]
        signal = result["signal"]
        confidence = result["confidence"]

        # --- Result Display ---
        print("\n" + "=" * 60)
        print(f"📊 SECTOR SENTIMENT REPORT")
        print("=" * 60)
        print(f"Sector: {sector_query.upper()}")
        print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Headlines Analyzed: {len(headlines)}")
        print("-" * 60)
        print(f"🟢 Positive Signals:  {pos:2d} ({pos_pct:5.1f}%)")
        print(f"🔴 Negative Signals:  {neg:2d} ({neg_pct:5.1f}%)")
        print(f"⚪ Neutral Signals:   {neu:2d} ({neu_pct:5.1f}%)")
        print("-" * 60)
        print(f"✨ NET SENTIMENT SCORE: {score:.3f}")
        print(f"📡 SECTOR SIGNAL: {signal}")
        print(f"💪 CONFIDENCE LEVEL: {confidence}")
        print("=" * 60)

        # Show top 3 headlines for context
        print("\n📰 TOP HEADLINES:")
        for i, headline in enumerate(headlines[:3], 1):
            print(f"{i}. {headline[:70]}...")

        print("=" * 60 + "\n")
        return result


def main():
    """Main execution function"""
    
    # Initialize the engine
    analyzer = SectorSentimentEngine()
    
    # Define sectors to analyze
    sectors = [
        "Semiconductors",
        "Technology",
        "Healthcare",
        "Energy",
        "Finance"
    ]
    
    print("\n" + "🎯 " * 15)
    print("MULTI-SECTOR SENTIMENT ANALYSIS")
    print("🎯 " * 15)
    
    results = []
    
    for sector in sectors:
        try:
            result = analyzer.run_analysis(sector)
            if result:
                results.append(result)
        except Exception as e:
            print(f"❌ Error analyzing {sector}: {str(e)}")
            continue
    
    # Create summary DataFrame
        if results:
            df = pd.DataFrame(results)
            print("\n📈 SUMMARY TABLE:")
            print(df[["sector", "sentiment_score", "positive_pct", "negative_pct", "signal"]].to_string(index=False))

            # Save results to CSV
            output_dir = Path(__file__).resolve().parent / "outputs"
            output_dir.mkdir(exist_ok=True)
            csv_filename = output_dir / f"sentiment_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df.to_csv(csv_filename, index=False)
            print(f"\n✅ Results saved to: {csv_filename}")


if __name__ == "__main__":
    main()
