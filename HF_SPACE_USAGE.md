# III5 Backend Space Usage

This guide explains how to use the deployed Hugging Face Space backend:

- Base URL: `https://SaqlainSQX-iii5-backend.hf.space`
- Health endpoint: `GET /health`
- APIs:
  - `POST /sector-sentiment`
  - `POST /stock-forecast`

---

## 1) Quick health check

```bash
curl https://SaqlainSQX-iii5-backend.hf.space/health
```

Expected:

```json
{"status":"ok"}
```

---

## 2) Sector sentiment API

Request:

```bash
curl -X POST https://SaqlainSQX-iii5-backend.hf.space/sector-sentiment \
  -H "Content-Type: application/json" \
  -d '{"sector":"Energy"}'
```

Example response shape:

```json
{
  "sector": "Energy",
  "total_headlines": 50,
  "positive": 17,
  "negative": 8,
  "neutral": 25,
  "positive_pct": 34.0,
  "negative_pct": 16.0,
  "neutral_pct": 50.0,
  "sentiment_score": 0.36,
  "signal": "BUY / BULLISH ⬆️",
  "confidence": "MEDIUM",
  "timestamp": "2026-04-12T..."
}
```

---

## 3) Stock forecast API (7-day)

Request:

```bash
curl -X POST https://SaqlainSQX-iii5-backend.hf.space/stock-forecast \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","days":7,"news_source":"gnews","use_gemini":false}'
```

Example response shape:

```json
{
  "ticker": "AAPL",
  "headlines_used": 10,
  "news_summary": "...",
  "day1_technical_base": 257.57,
  "day1_ai_forecast": 260.86,
  "sentiment_score": 0.432,
  "confidence": 0.591,
  "signal": "BULLISH",
  "forecast": [
    {"day": 1.0, "tech_close": 257.57, "ai_close": 260.86},
    {"day": 2.0, "tech_close": 257.85, "ai_close": 260.65}
  ]
}
```

---

## 4) Required Space variables/secrets

In Hugging Face Space **Settings → Variables and secrets**, set:

### Variables

- `SECTOR_MODEL_REPO_ID=SaqlainSQX/iii`
- `BUNDLE_REPO_ID=SaqlainSQX/iii`
- `BUNDLE_FILENAME=unified_stock_brain.pt`
- `TRUSTED_CHECKPOINT=1`

### Secrets

- `HF_TOKEN=<your_hf_token>` (required if `SaqlainSQX/iii` is private)
- `GEMINI_API_KEY=<optional>` (needed only when `use_gemini=true`)

---

## 5) Fixing `Internal Server Error`

If `/health` works but POST endpoints return 500:

1. Open Space **Logs** and check startup/runtime errors.
2. Verify the variables/secrets above are set exactly.
3. Confirm model repo `SaqlainSQX/iii` contains:
   - `final_trading_model/config.json`
   - `final_trading_model/model.safetensors`
   - `unified_stock_brain.pt`
4. If repo is private, verify `HF_TOKEN` has read access.
5. Restart the Space after changing Variables/Secrets.

---

## 6) Notes

- `curl: ... libcurl.so.4 ...` shown in your local terminal is a local conda warning, not a Space failure.
- `news_source: "gnews"` uses latest news; `"yfinance"` uses ticker news feed.
- `use_gemini: true` requires a valid Gemini key/quota.
