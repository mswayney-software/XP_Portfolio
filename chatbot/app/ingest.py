"""Ingest portfolio docs -> chunk -> embed -> build & save a FAISS index.

Run with:  python -m app.ingest
Reads every .md / .txt file under DOCS_DIR, splits each into heading-aware
chunks, embeds them locally, and writes the index to INDEX_DIR.
"""

from __future__ import annotations

import glob
import os
import re

from .config import get_settings
from .vector_store import Chunk, VectorStore

_HEADING_RE = re.compile(r"^#{1,6}\s+(.*)$")


def _window(text: str, size: int, overlap: int) -> list[str]:
    """Split long text into overlapping character windows."""
    text = text.strip()
    if len(text) <= size:
        return [text] if text else []
    pieces: list[str] = []
    start = 0
    step = max(size - overlap, 1)
    while start < len(text):
        piece = text[start : start + size].strip()
        if piece:
            pieces.append(piece)
        if start + size >= len(text):
            break
        start += step
    return pieces


def chunk_document(path: str, text: str, size: int, overlap: int) -> list[tuple[str, str]]:
    """Split a markdown/text doc into (heading, chunk_text) pairs.

    Paragraphs are grouped under their most recent heading; each section is then
    windowed to `size` characters so no single chunk is too large to retrieve.
    """
    default_title = os.path.splitext(os.path.basename(path))[0]
    sections: list[tuple[str, list[str]]] = []
    current_heading = default_title
    current_parts: list[str] = []

    for para in re.split(r"\n\s*\n", text):
        p = para.strip()
        if not p:
            continue
        m = _HEADING_RE.match(p)
        if m:
            if current_parts:
                sections.append((current_heading, current_parts))
                current_parts = []
            current_heading = m.group(1).strip()
            continue
        current_parts.append(p)
    if current_parts:
        sections.append((current_heading, current_parts))

    results: list[tuple[str, str]] = []
    for heading, parts in sections:
        body = "\n\n".join(parts)
        for piece in _window(body, size, overlap):
            results.append((heading, piece))
    return results


def collect_files(docs_dir: str) -> list[str]:
    patterns = ("**/*.md", "**/*.txt")
    paths: list[str] = []
    for pat in patterns:
        paths.extend(glob.glob(os.path.join(docs_dir, pat), recursive=True))
    return sorted(set(paths))


def main() -> None:
    settings = get_settings()
    paths = collect_files(settings.docs_dir)
    if not paths:
        raise SystemExit(
            f"No .md or .txt files found in '{settings.docs_dir}'. "
            "Add your portfolio documentation there and re-run."
        )

    chunks: list[Chunk] = []
    cid = 0
    for path in paths:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        rel = os.path.relpath(path, settings.docs_dir).replace(os.sep, "/")
        for heading, piece in chunk_document(
            path, text, settings.chunk_size, settings.chunk_overlap
        ):
            chunks.append(Chunk(id=cid, text=piece, source=rel, title=heading))
            cid += 1

    print(f"Read {len(paths)} file(s) -> {len(chunks)} chunk(s). Embedding...")
    store = VectorStore.build(chunks)
    store.save(settings.index_dir)
    print(f"Saved index to '{settings.index_dir}/'.")


if __name__ == "__main__":
    main()
