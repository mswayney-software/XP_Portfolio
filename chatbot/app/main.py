"""FastAPI app exposing the RAG chatbot.

Endpoints
---------
GET  /health        liveness + model info
POST /chat          one-shot answer with sources
POST /chat/stream   token-streamed answer (SSE), sources in the final event
"""

from __future__ import annotations

import json
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from . import llm, rag
from .config import get_settings
from .schemas import ChatRequest, ChatResponse, Source

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chatbot")

settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])

app = FastAPI(title="Portfolio RAG Chatbot", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "provider": settings.llm_provider,
        "model": llm.model_name(),
    }


@app.post("/chat", response_model=ChatResponse)
@limiter.limit(settings.rate_limit)
def chat(request: Request, body: ChatRequest) -> ChatResponse:
    history = [m.model_dump() for m in body.history]
    try:
        text, sources, usage = rag.answer(body.message, history)
        logger.info(
            "chat ok | provider=%s in=%s cache_read=%s out=%s",
            settings.llm_provider,
            usage.get("input_tokens", "?"),
            usage.get("cache_read_input_tokens", "?"),
            usage.get("output_tokens", "?"),
        )
    except FileNotFoundError as exc:
        logger.error("index missing: %s", exc)
        return ChatResponse(
            answer="The chatbot isn't initialized yet — the knowledge base "
            "hasn't been built. (Run the ingest step.)",
            sources=[],
        )
    except Exception as exc:  # noqa: BLE001 - degrade gracefully for the widget
        logger.exception("chat failed: %s", exc)
        return ChatResponse(
            answer="Sorry, I'm having trouble answering right now. "
            "Please try again in a moment.",
            sources=[],
        )
    return ChatResponse(answer=text, sources=[Source(**s) for s in sources])


@app.post("/chat/stream")
@limiter.limit(settings.rate_limit)
def chat_stream(request: Request, body: ChatRequest) -> StreamingResponse:
    history = [m.model_dump() for m in body.history]

    def event_stream():
        try:
            for event in rag.stream_answer(body.message, history):
                yield f"data: {json.dumps(event)}\n\n"
        except FileNotFoundError:
            err = {
                "type": "error",
                "text": "The chatbot isn't initialized yet — the knowledge "
                "base hasn't been built.",
            }
            yield f"data: {json.dumps(err)}\n\n"
        except Exception:  # noqa: BLE001 - degrade gracefully for the widget
            logger.exception("chat stream failed")
            err = {
                "type": "error",
                "text": "Sorry, I'm having trouble answering right now. "
                "Please try again in a moment.",
            }
            yield f"data: {json.dumps(err)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
