from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging

from graph_manager import build_full_graph

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart Knowledge Graph API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BuildRequest(BaseModel):
    tickers: List[str]


class GraphChatRequest(BaseModel):
    query: str
    history: Optional[List[dict]] = None
    selected_ticker: Optional[str] = None


@app.post("/api/build-graph")
def api_build_graph(req: BuildRequest):
    if not req.tickers:
        raise HTTPException(status_code=400, detail="Must provide at least one ticker.")
    try:
        clean_tickers = [t.strip().upper() for t in req.tickers if t.strip()]
        logger.info(f"Received request to build graph for: {clean_tickers}")
        stats = build_full_graph(tickers=clean_tickers, period="6mo")
        return {"status": "success", "stats": stats}
    except Exception as e:
        logger.error(f"Failed to build graph: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/graph-chat")
async def api_graph_chat(req: GraphChatRequest):
    """Chatbot endpoint — takes user query, fetches graph context, returns LLM analysis."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    try:
        from graph_chat import chat_with_graph
        result = await chat_with_graph(
            user_query=req.query,
            history=req.history,
            selected_ticker=req.selected_ticker,
        )
        return result
    except Exception as e:
        logger.exception(f"Graph chat error: {e}")
        return {"response": f"⚠️ Error: {str(e)}", "tickers": [], "related": [], "edges": []}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

