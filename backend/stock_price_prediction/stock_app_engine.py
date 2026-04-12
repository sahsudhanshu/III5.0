from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import yfinance as yf
from transformers import AutoModelForSequenceClassification, AutoTokenizer

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:
    # python-dotenv is optional at runtime
    pass


class StockLSTM(nn.Module):
    def __init__(self, input_dim: int = 5, hidden_dim: int = 64, n_layers: int = 2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_dim,
            hidden_dim,
            n_layers,
            batch_first=True,
            dropout=0.2,
        )
        self.fc = nn.Linear(hidden_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


@dataclass(frozen=True)
class StockPredictionResult:
    ticker: str
    headlines_used: int
    news_summary: str
    technical_base: float
    ai_adjusted_price: float
    sentiment_score: float
    confidence: float
    signal: str
    forecast_7d: list[dict[str, float]] | None = None


def _default_bundle_path() -> Path:
    return Path(__file__).with_name("unified_stock_brain.pt")


def _load_unified_bundle(bundle_path: Path, device: torch.device) -> dict[str, Any]:
    if not bundle_path.exists():
        raise FileNotFoundError(
            f"Bundle not found at: {bundle_path}. "
            "Place unified_stock_brain.pt in backend/stock_price_prediction/ (it is git-ignored)."
        )

    # This bundle includes sklearn scalers and other python objects -> requires weights_only=False.
    trusted = os.getenv("TRUSTED_CHECKPOINT", "").strip().lower() in {"1", "true", "yes"}
    if not trusted:
        raise RuntimeError(
            "Refusing to load unified_stock_brain.pt with weights_only=False unless TRUSTED_CHECKPOINT=1. "
            "Set TRUSTED_CHECKPOINT=1 only if you trust this file."
        )

    return torch.load(bundle_path, map_location=device, weights_only=False)


class StockAppEngine:
    def __init__(
        self,
        bundle_file: str | Path | None = None,
        gemini_model_name: str = "models/gemini-2.0-flash",
        use_gemini: bool = True,
    ):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        bundle_path = Path(bundle_file) if bundle_file else _default_bundle_path()
        print("🧠 Loading Unified Brain into App Memory...")
        bundle = _load_unified_bundle(bundle_path, self.device)

        self.tech_weights = bundle["technical"]
        self.scalers = bundle["scalers"]
        self.sent_weights = bundle["sentiment"]

        # Setup Sentiment Model
        self.tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self.news_model = AutoModelForSequenceClassification.from_pretrained(
            "ProsusAI/finbert",
            num_labels=3,
        )
        missing, unexpected = self.news_model.load_state_dict(self.sent_weights, strict=False)
        if unexpected or missing:
            # Not fatal; finetunes sometimes store slightly different key sets.
            print(f"[warn] sentiment state_dict missing={len(missing)} unexpected={len(unexpected)}")

        self.news_model.to(self.device)
        self.news_model.eval()

        self.use_gemini = use_gemini
        self._gemini_model = None
        if use_gemini:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "GEMINI_API_KEY is not set. Export GEMINI_API_KEY (or GOOGLE_API_KEY) or run with --no-gemini."
                )

            import google.generativeai as genai  # imported lazily

            genai.configure(api_key=api_key)
            self._gemini_model = genai.GenerativeModel(gemini_model_name)

    def summarize_headlines(self, ticker: str, headlines: list[str]) -> str:
        if not headlines:
            return ""

        if not self.use_gemini:
            # Fallback: just concatenate and truncate.
            text = " ".join(headlines)
            return text[:1500]

        assert self._gemini_model is not None
        prompt = (
            f"Act as a senior financial analyst. I will provide 10 recent headlines for {ticker}.\n"
            "Summarize them into a single, highly dense financial paragraph (max 3 sentences) "
            "that captures the overall market sentiment and any major catalysts.\n\n"
            "Headlines:\n"
            + "\n".join(headlines)
        )
        try:
            response = self._gemini_model.generate_content(prompt)
            return (response.text or "").strip()
        except Exception as e:
            # Common cases: quota exhausted, model not enabled, temporary errors.
            print(f"[warn] Gemini summarization failed ({type(e).__name__}). Falling back to raw headlines.")
            text = " ".join(headlines)
            return text[:1500]

    def _fetch_headlines_yfinance(self, ticker: str, limit: int = 10) -> list[str]:
        stock = yf.Ticker(ticker)
        raw_news = (stock.news or [])[:limit]
        headlines: list[str] = []
        for n in raw_news:
            title = n.get("title") if isinstance(n, dict) else None
            if title:
                headlines.append(str(title))
        return headlines

    def _fetch_headlines_gnews(self, query: str, limit: int = 10) -> list[str]:
        try:
            from gnews import GNews
        except Exception:
            return []

        client = GNews(language="en", country="US", period="24h", max_results=limit)
        items = client.get_news(query) or []
        return [str(it.get("title", "")).strip() for it in items if it.get("title")][:limit]

    def _score_sentiment(self, text: str) -> tuple[float, float]:
        inputs = self.tokenizer(text, padding=True, truncation=True, return_tensors="pt", max_length=256)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            logits = self.news_model(**inputs).logits
            probs = F.softmax(logits, dim=-1)

        # ProsusAI/finbert label order: [negative, neutral, positive]
        score = float((probs[0, 2] - probs[0, 0]).item())
        conf = float(torch.max(probs).item())
        return score, conf

    def _iterative_technical_forecast(
        self,
        *,
        ticker: str,
        base_window: np.ndarray,
        days: int,
    ) -> list[float]:
        """Iteratively forecast next N closes using the 1-step LSTM.

        The bundle model predicts next-step (scaled) close. To roll forward multiple
        days, we create synthetic OHLC for the next step based on recent average
        ratios (Open/Close, High/Close, Low/Close) and the predicted close.
        """

        scaler = self.scalers[ticker]

        lstm = StockLSTM()
        lstm.load_state_dict(self.tech_weights[ticker])
        lstm.to(self.device)
        lstm.eval()

        window = np.array(base_window, copy=True)
        forecasts: list[float] = []

        # Use recent ratio averages to synthesize OHLC for predicted days
        k = min(20, len(window))
        recent = window[-k:]
        close = recent[:, 0]
        open_r = float(np.mean(recent[:, 1] / close))
        high_r = float(np.mean(recent[:, 2] / close))
        low_r = float(np.mean(recent[:, 3] / close))

        for _ in range(int(days)):
            scaled_window = scaler.transform(window)
            with torch.no_grad():
                p_scaled = (
                    lstm(
                        torch.tensor(scaled_window, dtype=torch.float32, device=self.device).unsqueeze(0)
                    ).item()
                )

            dummy = np.zeros((1, 5), dtype=np.float32)
            dummy[0, 0] = float(p_scaled)
            p_close = float(scaler.inverse_transform(dummy)[0, 0])
            forecasts.append(p_close)

            prev_close = float(window[-1, 0])
            ret = (p_close - prev_close) / (prev_close + 1e-8)

            p_open = p_close * open_r
            p_high = max(p_close * high_r, p_open, p_close)
            p_low = min(p_close * low_r, p_open, p_close)

            next_row = np.array([[p_close, p_open, p_high, p_low, ret]], dtype=np.float32)
            window = np.concatenate([window[1:], next_row], axis=0)

        return forecasts

    def predict(
        self,
        ticker: str,
        headlines_limit: int = 10,
        history_period: str = "70d",
        window_size: int = 60,
        alpha: float = 0.05,
        news_source: str = "yfinance",
        days: int = 1,
        sentiment_decay: float = 0.85,
    ) -> StockPredictionResult:
        ticker = ticker.upper().strip()

        if ticker not in self.tech_weights or ticker not in self.scalers:
            raise KeyError(
                f"Ticker '{ticker}' not found in unified bundle. "
                f"Available (sample): {list(self.tech_weights)[:10]}"
            )

        print(f"📡 Fetching live data for {ticker}...")

        # 1) News
        if news_source == "gnews":
            headlines = self._fetch_headlines_gnews(f"{ticker} stock", limit=headlines_limit)
            if not headlines:
                headlines = self._fetch_headlines_yfinance(ticker, limit=headlines_limit)
        else:
            headlines = self._fetch_headlines_yfinance(ticker, limit=headlines_limit)
            if not headlines:
                headlines = self._fetch_headlines_gnews(f"{ticker} stock", limit=headlines_limit)

        print(f"📰 Headlines fetched: {len(headlines)}")
        if not headlines:
            headlines = [f"No recent headlines available for {ticker}."]

        print("🤖 Summarizing news...")
        summary = self.summarize_headlines(ticker, headlines)

        # 2) Price History (technical window)
        stock = yf.Ticker(ticker)
        hist = stock.history(period=history_period)
        if hist is None or hist.empty:
            raise RuntimeError(f"No price history returned for {ticker} (period={history_period}).")

        hist = hist.copy()
        hist["Returns"] = hist["Close"].pct_change()
        features = ["Close", "Open", "High", "Low", "Returns"]

        window = hist[features].dropna().tail(window_size).values.astype(np.float32)
        if len(window) < window_size:
            raise RuntimeError(
                f"Not enough history after dropna: got {len(window)} rows, need {window_size}."
            )

        # 3) Technical Forecast
        days = int(days)
        if days < 1 or days > 30:
            raise ValueError("days must be between 1 and 30")

        tech_path = self._iterative_technical_forecast(ticker=ticker, base_window=window, days=days)
        p_tech = float(tech_path[0])

        # 4) Sentiment Forecast (FinBERT on the summary)
        score, conf = self._score_sentiment(summary)

        # 5) Hybrid Fusion across horizon (decayed impact)
        forecast_rows: list[dict[str, float]] = []
        for i, p in enumerate(tech_path, start=1):
            decay = float(sentiment_decay) ** float(i - 1)
            p_final = float(p) * (1.0 + (score * conf * float(alpha) * decay))
            forecast_rows.append({"day": float(i), "tech_close": float(round(p, 2)), "ai_close": float(round(p_final, 2))})

        p_final_1 = float(forecast_rows[0]["ai_close"])
        signal = "BULLISH" if p_final_1 > p_tech else "BEARISH"

        return StockPredictionResult(
            ticker=ticker,
            headlines_used=len(headlines),
            news_summary=summary,
            technical_base=round(p_tech, 2),
            ai_adjusted_price=round(p_final_1, 2),
            sentiment_score=round(score, 3),
            confidence=conf,
            signal=signal,
            forecast_7d=forecast_rows if days == 7 else forecast_rows,
        )


def _cli() -> int:
    parser = argparse.ArgumentParser(description="Unified stock brain prediction runner")
    parser.add_argument("ticker", help="Ticker symbol, e.g., AAPL")
    parser.add_argument(
        "--bundle",
        default=str(_default_bundle_path()),
        help="Path to unified_stock_brain.pt (default: backend/stock_price_prediction/unified_stock_brain.pt)",
    )
    parser.add_argument("--no-gemini", action="store_true", help="Disable Gemini summarization")
    parser.add_argument(
        "--gemini-model",
        default="models/gemini-2.0-flash",
        help="Gemini model name (example: models/gemini-2.0-flash)",
    )
    parser.add_argument("--alpha", type=float, default=0.05, help="Sentiment adjustment strength")
    parser.add_argument("--days", type=int, default=1, help="Forecast horizon in trading days (default: 1)")
    parser.add_argument(
        "--sentiment-decay",
        type=float,
        default=0.85,
        help="Per-day decay for sentiment impact when forecasting multiple days",
    )
    parser.add_argument("--news-source", choices=["yfinance", "gnews"], default="yfinance")
    args = parser.parse_args()

    engine = StockAppEngine(
        bundle_file=args.bundle,
        use_gemini=not args.no_gemini,
        gemini_model_name=args.gemini_model,
    )
    r = engine.predict(
        args.ticker,
        alpha=args.alpha,
        news_source=args.news_source,
        days=args.days,
        sentiment_decay=args.sentiment_decay,
    )

    print("\n" + "=" * 60)
    print(f"📊 {r.ticker} - INTELLIGENT ANALYSIS")
    print("=" * 60)
    print(f"Headlines used: {r.headlines_used}")
    print(f"News Summary: {r.news_summary}\n")
    print(f"Day-1 LSTM Base Price:   ${r.technical_base}")
    print(f"Sentiment Score:         {r.sentiment_score} (Conf: {r.confidence:.1%})")
    print(f"Day-1 AI Forecast:       ${r.ai_adjusted_price}")
    print(f"Day-1 Call:              {r.signal}")

    if r.forecast_7d:
        print("\n7-day forecast (tech_close -> ai_close):")
        for row in r.forecast_7d[:7]:
            d = int(row["day"])
            print(f"  Day {d}: ${row['tech_close']:.2f} -> ${row['ai_close']:.2f}")

    print("=" * 60)

    return 0


if __name__ == "__main__":
    raise SystemExit(_cli())
