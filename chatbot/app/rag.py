"""Retrieval-augmented generation: retrieve doc chunks, then ask the LLM.

Design notes
------------
* Retrieval (embeddings + FAISS) is fully local and provider-independent.
* The system prompt is static; for the Anthropic provider it carries a
  ``cache_control`` breakpoint (handled in ``llm.py``), so its tokens are cached
  across requests. Retrieved context is volatile (changes per query) and goes in
  the *user* turn, AFTER the cached prefix — keeping the cache valid.
* The actual model call is delegated to ``llm.py``, which supports either Claude
  (production) or Groq (free dev), selected by the LLM_PROVIDER env var.
"""

from __future__ import annotations

from typing import Iterator

from . import llm
from .config import get_settings
from .vector_store import Chunk, VectorStore

_store: VectorStore | None = None


def get_store() -> VectorStore:
    global _store
    if _store is None:
        settings = get_settings()
        try:
            _store = VectorStore.load(settings.index_dir)
        except FileNotFoundError:
            # No prebuilt index (e.g. a fresh deploy where the index isn't
            # committed) — build it from the committed docs on first use.
            from . import ingest

            ingest.main()
            _store = VectorStore.load(settings.index_dir)
    return _store


def retrieve(question: str) -> list[tuple[Chunk, float]]:
    settings = get_settings()
    results = get_store().search(question, settings.top_k)
    return [(c, s) for c, s in results if s >= settings.min_score]


def _build_context(results: list[tuple[Chunk, float]]) -> str:
    blocks = []
    for i, (chunk, _score) in enumerate(results, 1):
        blocks.append(f"[Source {i}: {chunk.source} — {chunk.title}]\n{chunk.text}")
    return "\n\n".join(blocks)


def _build_messages(history: list[dict], question: str, context: str) -> list[dict]:
    if context:
        user_content = (
            "Context from the portfolio documentation:\n\n"
            f"{context}\n\n"
            "---\n\n"
            f"Visitor question: {question}"
        )
    else:
        user_content = (
            "No relevant portfolio documentation was found for this question.\n\n"
            f"Visitor question: {question}"
        )
    return [*history, {"role": "user", "content": user_content}]


def _sources(results: list[tuple[Chunk, float]]) -> list[dict]:
    return [
        {"source": c.source, "title": c.title, "score": round(s, 3)}
        for c, s in results
    ]


def answer(question: str, history: list[dict] | None = None):
    """Return (answer_text, sources, usage_dict)."""
    history = history or []
    results = retrieve(question)
    messages = _build_messages(history, question, _build_context(results))
    text, usage = llm.complete(messages)
    return text, _sources(results), usage


def stream_answer(
    question: str, history: list[dict] | None = None
) -> Iterator[dict]:
    """Yield SSE-friendly dicts: {"type": "delta", "text": ...} then
    {"type": "done", "sources": [...]}."""
    history = history or []
    results = retrieve(question)
    messages = _build_messages(history, question, _build_context(results))

    for delta in llm.stream(messages):
        yield {"type": "delta", "text": delta}

    yield {"type": "done", "sources": _sources(results)}
