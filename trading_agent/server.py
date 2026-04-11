"""
FastAPI server that wraps the LangGraph trading agent.
Run from the trading_agent directory with myenv activated:
    myenv\\Scripts\\python.exe server.py
"""
import sys
import os
import logging
from pathlib import Path

# Force UTF-8 output on Windows to avoid charmap errors with emoji
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Add parent dir to sys.path so 'trading_agent' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
# Also load the .env from this directory
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Now import the graph as a package
from trading_agent.graph import graph

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(name)s  %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Aria – Trading Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    logger.info(f"Received query: {request.message[:120]}")

    # If a stock context is attached (e.g. user is viewing AAPL page), prepend it
    human_input = request.message
    if request.context:
        human_input = f"[Stock context: {request.context}]\n{request.message}"

    initial_state = {
        "human_input": human_input,
        "messages": [],
    }

    try:
        result = await graph.ainvoke(initial_state)
        messages = result.get("messages", [])
        
        logger.info(f"Agent finished with {len(messages)} messages total.")
        
        # Extract the last AI text response (non-tool-call message)
        response_text = None
        for i, msg in enumerate(reversed(messages)):
            # Log exact details of each message encountered
            m_type = getattr(msg, "type", "UNKNOWN_TYPE")
            m_class = msg.__class__.__name__
            content = getattr(msg, "content", None)
            tool_calls = getattr(msg, "tool_calls", None)
            
            logger.info(f"Msg {i} from end: Class={m_class}, Type={m_type}, HasContent={bool(content)}, ToolCalls={len(tool_calls) if tool_calls else 0}")
            
            # More lenient AI check
            is_ai = m_type == "ai" or m_class == "AIMessage" or "AI" in m_class
            has_tools = bool(tool_calls)
            
            if is_ai and content and not has_tools:
                # Handle potential list of content blocks
                if isinstance(content, list):
                    parts = []
                    for block in content:
                        if isinstance(block, str):
                            parts.append(block)
                        elif isinstance(block, dict) and block.get("type") == "text":
                            parts.append(block.get("text", ""))
                    response_text = "\n".join(parts).strip()
                else:
                    response_text = str(content).strip()
                
                if response_text and response_text.lower() != "none" and response_text != "":
                    logger.info(f"Found valid AI response in message {i} from end.")
                    break

        if not response_text or response_text.lower() == "none" or response_text == "":
            logger.warning("Extraction loop failed to find a content-heavy AI message. Trying total fallback.")
            
            # Last ditch: Find ANY message with content that isn't a tool message
            for msg in reversed(messages):
                m_type = getattr(msg, "type", "")
                content = getattr(msg, "content", "")
                if content and m_type != "tool" and m_type != "system":
                    response_text = str(content).strip()
                    if response_text and response_text.lower() != "none":
                        break
            
            if not response_text or response_text.lower() == "none" or response_text == "":
                response_text = "I'm here! I understood your message but couldn't format a text response. Try asking me for a stock analysis or market update."

        logger.info(f"Sending response to frontend (len: {len(response_text)})")
        return {"response": response_text}

    except Exception as e:
        logger.exception("Error during agent graph execution")
        return {
            "error": str(e),
            "response": f"⚠️ Analysis error: {e}\n\nPlease check the server logs for details.",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
