"""Stock price prediction module.

NOTE: The model bundle (e.g., unified_stock_brain.pt) is intentionally git-ignored
because it is too large for standard GitHub pushes.

Place the bundle next to this file:
  backend/stock_price_prediction/unified_stock_brain.pt
"""

from __future__ import annotations

from pathlib import Path

DEFAULT_BUNDLE_PATH = Path(__file__).with_name("unified_stock_brain.pt")


def get_bundle_path() -> Path:
    """Return the default local path where the model bundle is expected."""

    return DEFAULT_BUNDLE_PATH


def ensure_bundle_exists(path: Path | None = None) -> Path:
    """Validate that the model bundle exists locally and return its path."""

    path = path or DEFAULT_BUNDLE_PATH
    if not path.exists():
        raise FileNotFoundError(
            f"Model bundle not found at: {path}. "
            "Put unified_stock_brain.pt in backend/stock_price_prediction/ (it is git-ignored)."
        )
    return path
