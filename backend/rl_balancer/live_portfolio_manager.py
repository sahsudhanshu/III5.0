from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

import numpy as np
import torch
import torch.nn.functional as F
import yfinance as yf
from gnews import GNews
from stable_baselines3 import PPO
from transformers import AutoModelForSequenceClassification, AutoTokenizer


class AILivePortfolioManager:
    def __init__(self, model_path: str | Path | None = None):
        print("🤖 Waking up RL Agent...")
        base_dir = Path(__file__).resolve().parent
        requested = Path(model_path) if model_path else base_dir / "portfolio_agent_1M"
        self.model_path = self._resolve_model_path(requested)

        # Load the trained model
        self.model = PPO.load(str(self.model_path))
        self.tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "BRK-B", "V", "WMT"]

        # Sentiment model for real-time news scoring
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.sent_tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
        self.sent_model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
        self.sent_model.to(self.device)
        self.sent_model.eval()
        self.gnews_client = GNews(language="en", country="US", period="24h", max_results=10)
        print("✅ Agent ready for live market execution.")

    @staticmethod
    def _resolve_model_path(path: Path) -> Path:
        """
        Resolve the actual PPO archive path.
        Supports either:
        - direct .zip file path
        - basename path where `<name>.zip` exists
        """
        if path.is_file():
            return path

        # When caller passes ".../portfolio_agent_1M", PPO usually expects ".../portfolio_agent_1M.zip"
        zip_candidate = path.with_suffix(".zip")
        if zip_candidate.is_file():
            return zip_candidate

        raise FileNotFoundError(
            f"Could not locate PPO model archive. Tried: {path} and {zip_candidate}"
        )

    def _validate_inputs(
        self,
        current_prices: Sequence[float],
        current_quantities: Sequence[float],
        current_sentiments: Sequence[float],
    ) -> None:
        expected = len(self.tickers)
        if len(current_prices) != expected:
            raise ValueError(f"current_prices must have {expected} values")
        if len(current_quantities) != expected:
            raise ValueError(f"current_quantities must have {expected} values")
        if len(current_sentiments) != expected:
            raise ValueError(f"current_sentiments must have {expected} values")
        if any(float(p) <= 0 for p in current_prices):
            raise ValueError("All prices must be > 0")

    def _score_headlines(self, headlines: Sequence[str]) -> float:
        if not headlines:
            return 0.0
        inputs = self.sent_tokenizer(
            list(headlines),
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=128,
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        with torch.no_grad():
            probs = F.softmax(self.sent_model(**inputs).logits, dim=-1)
        # FinBERT order: [negative, neutral, positive]
        per_headline = (probs[:, 2] - probs[:, 0]).detach().cpu().numpy()
        return float(np.mean(per_headline))

    def fetch_live_prices(self) -> list[float]:
        prices: list[float] = []
        for ticker in self.tickers:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="2d", interval="1d")
            price: float | None = None
            if hist is not None and not hist.empty:
                last_close = float(hist["Close"].dropna().iloc[-1])
                if np.isfinite(last_close) and last_close > 0:
                    price = last_close
            if price is None:
                info = stock.fast_info or {}
                candidate = info.get("last_price")
                if candidate is not None and np.isfinite(candidate) and float(candidate) > 0:
                    price = float(candidate)
            if price is None:
                raise RuntimeError(f"Could not fetch live price for {ticker}")
            prices.append(round(price, 4))
        return prices

    def fetch_live_sentiments(self, source: str = "gnews", headlines_per_ticker: int = 5) -> list[float]:
        sentiments: list[float] = []
        for ticker in self.tickers:
            headlines: list[str] = []
            if source == "yfinance":
                items = (yf.Ticker(ticker).news or [])[:headlines_per_ticker]
                headlines = [str(i.get("title", "")).strip() for i in items if i.get("title")]
            else:
                items = self.gnews_client.get_news(f"{ticker} stock") or []
                headlines = [
                    str(i.get("title", "")).strip()
                    for i in items[:headlines_per_ticker]
                    if i.get("title")
                ]

            sentiments.append(round(self._score_headlines(headlines), 4) if headlines else 0.0)
        return sentiments

    def calculate_trades_from_live_data(
        self,
        current_cash: float,
        current_quantities: Sequence[float],
        sentiment_source: str = "gnews",
        headlines_per_ticker: int = 5,
    ) -> tuple[dict[str, dict[str, Any]], float, list[float], list[float]]:
        if len(current_quantities) != len(self.tickers):
            raise ValueError(f"current_quantities must have {len(self.tickers)} values")

        current_prices = self.fetch_live_prices()
        current_sentiments = self.fetch_live_sentiments(
            source=sentiment_source,
            headlines_per_ticker=headlines_per_ticker,
        )
        trade_plan, net_worth = self.calculate_trades(
            current_cash,
            current_prices,
            current_quantities,
            current_sentiments,
        )
        return trade_plan, net_worth, current_prices, current_sentiments

    def calculate_trades(
        self,
        current_cash: float,
        current_prices: Sequence[float],
        current_quantities: Sequence[float],
        current_sentiments: Sequence[float],
    ) -> tuple[dict[str, dict[str, Any]], float]:
        """
        Feed live state to the RL policy and generate actionable buy/sell orders.
        """
        self._validate_inputs(current_prices, current_quantities, current_sentiments)

        # 1) Construct state vector (31 features)
        obs = [float(current_cash)] + [float(x) for x in current_prices] + [float(x) for x in current_quantities] + [float(x) for x in current_sentiments]
        obs_arr = np.array(obs, dtype=np.float32)
        if obs_arr.shape[0] != 31:
            raise ValueError(f"State vector must have 31 values, got {obs_arr.shape[0]}")

        # 2) Ask the AI what to do
        action, _states = self.model.predict(obs_arr, deterministic=True)

        # 3) Convert raw AI output to target percentages (stable softmax)
        action_arr = np.array(action, dtype=np.float32).reshape(-1)
        shifted = action_arr - np.max(action_arr)
        exp_action = np.exp(shifted)
        target_weights = exp_action / np.sum(exp_action)

        # 4) Calculate total net worth
        prices_arr = np.array(current_prices, dtype=np.float32)
        qty_arr = np.array(current_quantities, dtype=np.float32)
        portfolio_value = float(np.sum(prices_arr * qty_arr))
        net_worth = float(current_cash) + portfolio_value

        # 5) Generate specific trade orders
        trade_plan: dict[str, dict[str, Any]] = {}
        for i, ticker in enumerate(self.tickers):
            target_cash_in_stock = float(target_weights[i]) * net_worth
            target_quantity = target_cash_in_stock / float(current_prices[i])
            shares_to_trade = target_quantity - float(current_quantities[i])

            if shares_to_trade > 0.01:
                action_type = "BUY"
            elif shares_to_trade < -0.01:
                action_type = "SELL"
            else:
                action_type = "HOLD"

            trade_plan[ticker] = {
                "action": action_type,
                "shares_to_trade": round(float(shares_to_trade), 4),
                "target_weight_pct": round(float(target_weights[i] * 100.0), 2),
                "target_quantity": round(float(target_quantity), 4),
            }

        return trade_plan, round(net_worth, 2)
