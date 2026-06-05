"""Application settings, loaded from environment / .env file."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # LLM provider: "anthropic" (production) or "groq" (free for dev)
    llm_provider: str = "anthropic"
    max_tokens: int = 1024

    # Anthropic
    anthropic_api_key: str = ""
    chatbot_model: str = "claude-haiku-4-5"

    # Groq (OpenAI-compatible, free tier)
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"

    # Documents / index
    docs_dir: str = "data/docs"
    index_dir: str = "data/index"

    # Retrieval
    top_k: int = 4
    min_score: float = 0.3

    # Chunking (characters)
    chunk_size: int = 800
    chunk_overlap: int = 150

    # Server
    allowed_origins: str = "*"
    rate_limit: str = "20/minute"

    @property
    def cors_origins(self) -> list[str]:
        raw = self.allowed_origins.strip()
        if raw == "*" or not raw:
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
