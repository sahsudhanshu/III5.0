"""
Stock analysis — computes metrics that drive Neo4j graph relationships.

Pearson / Spearman correlation, beta, volatility, momentum, sector similarity.
"""

import logging
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from scipy.stats import pearsonr, spearmanr

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Returns
# ---------------------------------------------------------------------------

def compute_log_returns(prices: pd.DataFrame) -> pd.DataFrame:
    """Daily log-returns from close prices."""
    returns = np.log(prices / prices.shift(1)).dropna()
    logger.info(f"Computed log returns: {returns.shape}")
    return returns


# ---------------------------------------------------------------------------
# Pair-wise correlation
# ---------------------------------------------------------------------------

def compute_correlation_pairs(
    returns: pd.DataFrame,
    min_abs_corr: float = 0.25,
) -> List[dict]:
    """Compute Pearson + Spearman correlation for every pair of tickers.

    Returns list of dicts with keys:
        ticker_a, ticker_b, pearson, spearman, abs_avg, strength, direction
    Only pairs with |average| >= min_abs_corr are returned.
    """
    tickers = returns.columns.tolist()
    pairs: List[dict] = []

    for i, a in enumerate(tickers):
        for b in tickers[i + 1:]:
            sa = returns[a].dropna()
            sb = returns[b].dropna()
            common = sa.index.intersection(sb.index)
            if len(common) < 20:
                continue
            sa, sb = sa.loc[common], sb.loc[common]

            try:
                p_corr, _ = pearsonr(sa, sb)
            except Exception:
                p_corr = 0.0
            try:
                s_corr, _ = spearmanr(sa, sb)
            except Exception:
                s_corr = 0.0

            abs_avg = (abs(p_corr) + abs(s_corr)) / 2
            if abs_avg < min_abs_corr:
                continue

            # strength label
            if abs_avg >= 0.7:
                strength = "Strong"
            elif abs_avg >= 0.5:
                strength = "Moderate"
            elif abs_avg >= 0.35:
                strength = "Weak"
            else:
                strength = "Very Weak"

            direction = "positive" if p_corr > 0 else "negative"

            pairs.append({
                "ticker_a": a,
                "ticker_b": b,
                "pearson": round(float(p_corr), 4),
                "spearman": round(float(s_corr), 4),
                "abs_avg": round(float(abs_avg), 4),
                "strength": strength,
                "direction": direction,
            })

    logger.info(f"Correlation pairs (|avg|>={min_abs_corr}): {len(pairs)}")
    return pairs


# ---------------------------------------------------------------------------
# Rolling correlation for co-movement score
# ---------------------------------------------------------------------------

def compute_rolling_comovement(
    returns: pd.DataFrame,
    window: int = 30,
) -> Dict[Tuple[str, str], float]:
    """30-day rolling correlation average for each pair."""
    tickers = returns.columns.tolist()
    scores: Dict[Tuple[str, str], float] = {}
    for i, a in enumerate(tickers):
        for b in tickers[i + 1:]:
            try:
                roll = returns[a].rolling(window).corr(returns[b]).dropna()
                if len(roll) > 0:
                    scores[(a, b)] = round(float(roll.mean()), 4)
            except Exception:
                pass
    return scores


# ---------------------------------------------------------------------------
# Per-company metrics
# ---------------------------------------------------------------------------

def compute_volatility(returns: pd.DataFrame) -> Dict[str, float]:
    """Annualised volatility (std * sqrt(252))."""
    vol = (returns.std() * np.sqrt(252)).to_dict()
    return {k: round(v, 4) for k, v in vol.items()}


def compute_beta(
    returns: pd.DataFrame, benchmark: str = "SPY"
) -> Dict[str, float]:
    """Beta to benchmark.  If benchmark isn't in returns, return 1.0."""
    betas: Dict[str, float] = {}
    if benchmark not in returns.columns:
        return {t: 1.0 for t in returns.columns}
    bench = returns[benchmark].dropna()
    var_bench = bench.var()
    if var_bench == 0:
        return {t: 1.0 for t in returns.columns}
    for t in returns.columns:
        if t == benchmark:
            betas[t] = 1.0
            continue
        common = returns[[t, benchmark]].dropna()
        cov = common[t].cov(common[benchmark])
        betas[t] = round(float(cov / var_bench), 4)
    return betas


def compute_momentum(prices: pd.DataFrame, days: int = 20) -> Dict[str, float]:
    """Price momentum = % change over last N trading days."""
    mom: Dict[str, float] = {}
    for t in prices.columns:
        s = prices[t].dropna()
        if len(s) >= days:
            pct = float((s.iloc[-1] - s.iloc[-days]) / s.iloc[-days] * 100)
            mom[t] = round(pct, 2)
        else:
            mom[t] = 0.0
    return mom


def compute_current_prices(prices: pd.DataFrame) -> Dict[str, float]:
    """Latest closing price per ticker."""
    return {t: round(float(prices[t].dropna().iloc[-1]), 2) for t in prices.columns}


def compute_price_change_pct(prices: pd.DataFrame, days: int = 5) -> Dict[str, float]:
    """% price change over last N days."""
    changes: Dict[str, float] = {}
    for t in prices.columns:
        s = prices[t].dropna()
        if len(s) >= days:
            changes[t] = round(float((s.iloc[-1] - s.iloc[-days]) / s.iloc[-days] * 100), 2)
        else:
            changes[t] = 0.0
    return changes
