"""Local text embeddings via fastembed (ONNX, no API key, no torch)."""

from __future__ import annotations

import numpy as np
from fastembed import TextEmbedding

from .config import get_settings

_model: TextEmbedding | None = None


def get_embedder() -> TextEmbedding:
    """Lazily load the embedding model (downloaded & cached on first use)."""
    global _model
    if _model is None:
        _model = TextEmbedding(model_name=get_settings().embedding_model)
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    """Embed a batch of texts -> (n, dim) float32 array."""
    vecs = list(get_embedder().embed(texts))
    return np.array(vecs, dtype="float32")


def embed_query(text: str) -> np.ndarray:
    """Embed a single query -> (dim,) float32 array."""
    return embed_texts([text])[0]
