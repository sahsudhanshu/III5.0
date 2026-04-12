from __future__ import annotations

from pathlib import Path
from typing import Any, Sequence

import numpy as np
from stable_baselines3 import PPO


class AILivePortfolioManager:
    def __init__(self, model_path: str | Path | None = None):
        print("🤖 Waking up RL Agent...")
        base_dir = Path(__file__).resolve().parent
        requested = Path(model_path) if model_path else base_dir / "portfolio_agent_1M"
        self.model_path = self._resolve_model_path(requested)

        # Load the trained model
        self.model = PPO.load(str(self.model_path))
        self.tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "BRK-B", "V", "WMT"]
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
