"""FAISS-backed vector store with cosine similarity over normalized embeddings."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass

import faiss
import numpy as np

from .embeddings import embed_query, embed_texts

INDEX_FILE = "index.faiss"
META_FILE = "chunks.json"


@dataclass
class Chunk:
    id: int
    text: str
    source: str  # relative path of source doc
    title: str  # section heading


class VectorStore:
    def __init__(self, index: "faiss.Index", chunks: list[Chunk]):
        self.index = index
        self.chunks = chunks

    @classmethod
    def build(cls, chunks: list[Chunk]) -> "VectorStore":
        if not chunks:
            raise ValueError("Cannot build an index from zero chunks.")
        vecs = embed_texts([c.text for c in chunks])
        faiss.normalize_L2(vecs)  # cosine similarity via inner product
        index = faiss.IndexFlatIP(vecs.shape[1])
        index.add(vecs)
        return cls(index, chunks)

    def save(self, index_dir: str) -> None:
        os.makedirs(index_dir, exist_ok=True)
        faiss.write_index(self.index, os.path.join(index_dir, INDEX_FILE))
        with open(os.path.join(index_dir, META_FILE), "w", encoding="utf-8") as f:
            json.dump([asdict(c) for c in self.chunks], f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, index_dir: str) -> "VectorStore":
        index_path = os.path.join(index_dir, INDEX_FILE)
        meta_path = os.path.join(index_dir, META_FILE)
        if not (os.path.exists(index_path) and os.path.exists(meta_path)):
            raise FileNotFoundError(
                f"No index found in '{index_dir}'. Run `python -m app.ingest` first."
            )
        index = faiss.read_index(index_path)
        with open(meta_path, "r", encoding="utf-8") as f:
            chunks = [Chunk(**c) for c in json.load(f)]
        return cls(index, chunks)

    def search(self, query: str, top_k: int) -> list[tuple[Chunk, float]]:
        q = embed_query(query).reshape(1, -1)
        faiss.normalize_L2(q)
        k = min(top_k, len(self.chunks))
        scores, idxs = self.index.search(q, k)
        results: list[tuple[Chunk, float]] = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx == -1:
                continue
            results.append((self.chunks[idx], float(score)))
        return results
