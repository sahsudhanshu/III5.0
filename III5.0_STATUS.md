# III 5.0 - Project Progress & Architecture Summary

This document summarizes the current state of the platform to facilitate continued development.

## 🤖 AI Trading Agent (Aria)
- **Backend**: FastAPI server running in `trading_agent/server.py`.
- **Logic**: LangGraph-based state machine using NVIDIA foundation models.
- **Tools**: Includes market snapshot (yfinance), news search, and web search.
- **Frontend**: Connected via `chat-store.ts` to `http://localhost:8000/api/chat`.
- **Status**: ✅ Fully functional.

## 💰 Portfolio & Database System
- **Database**: MongoDB (via Mongoose).
- **Core Model**: `lib/models/portfolio.ts` tracking cash, holdings, and transactions.
- **API Routes**:
  - `GET /api/portfolio`: Fetch or initialize user portfolio.
  - `POST /api/portfolio/order`: Handle BUY/SELL with balance validation and 0.1% fees.
  - `POST /api/portfolio/funds`: Handle simulated DEPOSIT/WITHDRAW.
- **Frontend Store**: `store/portfolio-store.ts` manages all persistent finance state.
- **UI Integration**:
  - `/portfolio`: Real-time P&L tracking and fund management.
  - `/explore/[symbol]`: Real order panel showing available cash/shares.
  - `/transactions`: Persistent history of all user actions.
- **Status**: ✅ Fully functional.

## 🛠️ Execution Context
- **Website Root**: `d:\III5.0\website` (Next.js)
- **Agent Root**: `d:\III5.0\trading_agent` (Python)
- **Environment**: `.env` files in both directories contain API keys for Finnhub, NVIDIA, and MongoDB.

## 🚀 How to Resume
1. **Start Python Agent**:
   ```powershell
   cd d:\III5.0\trading_agent
   .\myenv\Scripts\activate
   python server.py
   ```
2. **Start Next.js Frontend**:
   ```powershell
   cd d:\III5.0\website
   npm run dev
   ```

## ⚠️ Known Issues
- **Disk Space**: The host system reported `WinError 112` (Disk Full) during some operations. Ensure at least 1-2GB of free space on `C:` for temporary caches.
- **Finnhub Limits**: Some candle endpoints may fallback to simulation if API limits are reached.

---
*Created on 2026-04-12*
