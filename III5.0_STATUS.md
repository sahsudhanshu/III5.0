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

## 🕸️ Smart Knowledge Graph System
- **Backend**: Python FastAPI server at `backend/stock_network/api.py` (Port 8001).
- **Core Engine**: Neo4j graph database storing Company, Product, and News nodes.
- **Analytics**: Real-time calculation of SMA, EMA, RSI, MACD, and Bollinger Bands via `ta`.
- **Sentiment**: News sentiment analysis using `vaderSentiment`.
- **Frontend**: Cytoscape-based interactive graph at `/smart-graph`.
- **Status**: ✅ Component built; Integration in-progress.

## 🛠️ Execution Context
- **Website Root**: `c:\Users\Sudhanshu\Desktop\Projects\III5.0\website` (Next.js)
- **Agent Root**: `c:\Users\Sudhanshu\Desktop\Projects\III5.0\trading_agent` (Python - Port 8000)
- **Graph Root**: `c:\Users\Sudhanshu\Desktop\Projects\III5.0\backend\stock_network` (Python - Port 8001)
- **Database**: 
    - MongoDB: Primary user data, auth, and portfolio.
    - Neo4j: Relationship modeling and technical indicators.

## 🚀 How to Resume
1. **Start Neo4j (Docker)**:
   ```powershell
   docker start neo4j
   ```
2. **Start Backend API (Graph Engine)**:
   ```powershell
   cd c:\Users\Sudhanshu\Desktop\Projects\III5.0\backend\stock_network
   # (Ensure venv is active)
   python api.py
   ```
3. **Start Next.js Frontend**:
   ```powershell
   cd c:\Users\Sudhanshu\Desktop\Projects\III5.0\website
   npm run dev
   ```

## ⚠️ Known Issues
- **Port Conflict**: Graph API moved to 8001 to avoid clashing with Trading Agent on 8000.
- **Environment**: Ensure `.env.local` has a secure `AUTH_SECRET` (fixed) for NextAuth compatibility.

---
*Updated on 2026-04-12*
