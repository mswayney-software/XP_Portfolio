"""Request / response models for the chat API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    # Prior turns in this session, oldest first. The current message is sent
    # separately in `message` and should NOT be duplicated here.
    history: list[Message] = Field(default_factory=list)


class Source(BaseModel):
    source: str  # relative path of the source document
    title: str  # section heading the chunk came from
    score: float  # cosine similarity (0-1)


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
