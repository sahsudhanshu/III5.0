"""Local-only test for loading backend/stock_price_prediction/unified_stock_brain.pt.

Why this exists:
- PyTorch 2.6+ defaults torch.load(weights_only=True)
- This bundle contains non-tensor objects (e.g., sklearn MinMaxScaler)

Behavior:
- If the .pt is missing (it is git-ignored), we SKIP.
- First, try safe weights-only load.
- If that fails and sklearn is available, allowlist MinMaxScaler and retry.
- If you trust the checkpoint source, you can set TRUSTED_CHECKPOINT=1 to load with weights_only=False.

Run:
  python backend/tests/test_unified_stock_brain_bundle.py
  TRUSTED_CHECKPOINT=1 python backend/tests/test_unified_stock_brain_bundle.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import torch


def _bundle_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "backend" / "stock_price_prediction" / "unified_stock_brain.pt"


def _try_load_bundle(path: Path):
    # 1) Safe path (weights_only=True)
    try:
        obj = torch.load(path, map_location="cpu", weights_only=True)
        return obj, "weights_only=True"
    except Exception as e:
        print("[warn] torch.load(weights_only=True) failed:")
        print(f"       {type(e).__name__}: {e}")

    # 2) Allowlist sklearn MinMaxScaler for safe unpickling, if sklearn exists
    try:
        from sklearn.preprocessing import MinMaxScaler  # type: ignore

        try:
            from torch.serialization import add_safe_globals

            add_safe_globals([MinMaxScaler])
            obj = torch.load(path, map_location="cpu", weights_only=True)
            return obj, "weights_only=True + safe_globals(MinMaxScaler)"
        except Exception as e:
            print("[warn] safe_globals(MinMaxScaler) retry failed:")
            print(f"       {type(e).__name__}: {e}")
    except Exception as e:
        print("[warn] sklearn not available; cannot allowlist MinMaxScaler:")
        print(f"       {type(e).__name__}: {e}")

    # 3) Unsafe path (weights_only=False) only if explicitly trusted
    trusted = os.getenv("TRUSTED_CHECKPOINT", "").strip().lower() in {"1", "true", "yes"}
    if trusted:
        obj = torch.load(path, map_location="cpu", weights_only=False)
        return obj, "weights_only=False (TRUSTED_CHECKPOINT=1)"

    raise SystemExit(
        "\n[error] Could not load bundle safely.\n"
        "- If you trust the checkpoint source, rerun with: TRUSTED_CHECKPOINT=1\n"
        "- Or install sklearn so we can allowlist MinMaxScaler for weights-only loading.\n"
    )


def main() -> int:
    path = _bundle_path()

    print(f"python: {sys.executable}")
    print(f"torch:  {torch.__version__}")
    print(f"bundle: {path}")

    if not path.exists():
        print("[skip] unified_stock_brain.pt not found (it is git-ignored).")
        return 0

    size_mb = path.stat().st_size / (1024 * 1024)
    print(f"size:  {size_mb:.1f} MB")

    bundle, mode = _try_load_bundle(path)
    print(f"\n[ok] Loaded bundle via: {mode}")

    if isinstance(bundle, dict):
        keys = list(bundle.keys())
        print(f"type: dict ({len(keys)} keys)")
        print("keys:", keys)

        # Print a small preview of nested dicts
        for k in ("technical", "scalers", "sentiment"):
            v = bundle.get(k)
            if isinstance(v, dict):
                sample = list(v.keys())[:10]
                print(f"- {k}: dict ({len(v)} items), sample keys: {sample}")
            elif v is None:
                print(f"- {k}: <missing>")
            else:
                print(f"- {k}: {type(v).__name__}")
    else:
        print(f"type: {type(bundle).__name__}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
