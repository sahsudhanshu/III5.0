#!/usr/bin/env python3
"""Upload sector + stock model assets to a Hugging Face model repo.

This script stages only:
1) backend/sector_sentiment/final_trading_model/
2) backend/stock_price_prediction/unified_stock_brain.pt

and uploads them to a single HF model repository.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from huggingface_hub import HfApi, login, upload_folder


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload local model assets to Hugging Face model repo")
    parser.add_argument(
        "--repo-id",
        default="SaqlainSQX/iii",
        help="Target Hugging Face model repo id (default: SaqlainSQX/iii)",
    )
    parser.add_argument(
        "--repo-root",
        default=".",
        help="Local repository root (default: current directory)",
    )
    parser.add_argument(
        "--skip-login",
        action="store_true",
        help="Skip interactive login (use if HF_TOKEN is already configured)",
    )
    parser.add_argument(
        "--private",
        action="store_true",
        help="Create repo as private if it does not exist",
    )
    return parser.parse_args()


def _ensure_exists(path: Path, label: str) -> None:
    if not path.exists():
        raise FileNotFoundError(f"{label} not found: {path}")


def main() -> int:
    args = _parse_args()
    repo_root = Path(args.repo_root).resolve()

    src_sector = repo_root / "backend" / "sector_sentiment" / "final_trading_model"
    src_bundle = repo_root / "backend" / "stock_price_prediction" / "unified_stock_brain.pt"
    tmp_dir = repo_root / ".hf_upload_tmp"

    _ensure_exists(src_sector, "Sector model directory")
    _ensure_exists(src_bundle, "Unified stock bundle")

    if not args.skip_login:
        login()

    api = HfApi()
    api.create_repo(repo_id=args.repo_id, repo_type="model", private=args.private, exist_ok=True)

    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    try:
        shutil.copytree(src_sector, tmp_dir / "final_trading_model")
        shutil.copy2(src_bundle, tmp_dir / "unified_stock_brain.pt")

        upload_folder(
            folder_path=str(tmp_dir),
            repo_id=args.repo_id,
            repo_type="model",
        )
        print(f"✅ Upload complete: {args.repo_id}")
    finally:
        if tmp_dir.exists():
            shutil.rmtree(tmp_dir)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
