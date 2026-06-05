"""LLM provider abstraction.

Supports two backends, selected by the LLM_PROVIDER env var:

* "anthropic" (default, production target) — Claude, with prompt caching on the
  static system prompt.
* "groq"      (free for development)        — OpenAI-compatible Groq API.

Both expose the same interface to the rest of the app:
    model_name() -> str
    complete(messages) -> (text, usage_dict)
    stream(messages)   -> Iterator[str]   # yields text deltas

`messages` is a provider-neutral list of {"role": "user"|"assistant", "content": str}.
The system prompt is injected here, the way each provider expects.
"""

from __future__ import annotations

from typing import Iterator

from .config import get_settings
from .prompts import SYSTEM_PROMPT

_anthropic_client = None
_groq_client = None


def _provider() -> str:
    return get_settings().llm_provider.strip().lower()


def model_name() -> str:
    s = get_settings()
    return s.groq_model if _provider() == "groq" else s.chatbot_model


def _normalize_usage(input_tokens=None, output_tokens=None, cache_read=None) -> dict:
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cache_read_input_tokens": cache_read,
    }


# --- Anthropic ------------------------------------------------------------
def _get_anthropic():
    global _anthropic_client
    if _anthropic_client is None:
        import anthropic

        key = get_settings().anthropic_api_key or None
        _anthropic_client = anthropic.Anthropic(api_key=key)
    return _anthropic_client


def _anthropic_system() -> list[dict]:
    # Static prompt with a cache breakpoint (see rag.py design notes).
    return [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}]


# --- Groq (OpenAI-compatible) ---------------------------------------------
def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq

        key = get_settings().groq_api_key or None
        _groq_client = Groq(api_key=key)
    return _groq_client


def _groq_messages(messages: list[dict]) -> list[dict]:
    return [{"role": "system", "content": SYSTEM_PROMPT}, *messages]


# --- Public interface -----------------------------------------------------
def complete(messages: list[dict]) -> tuple[str, dict]:
    s = get_settings()
    if _provider() == "groq":
        resp = _get_groq().chat.completions.create(
            model=s.groq_model,
            max_tokens=s.max_tokens,
            messages=_groq_messages(messages),
        )
        text = resp.choices[0].message.content or ""
        u = resp.usage
        usage = _normalize_usage(
            getattr(u, "prompt_tokens", None),
            getattr(u, "completion_tokens", None),
            None,
        )
        return text, usage

    resp = _get_anthropic().messages.create(
        model=s.chatbot_model,
        max_tokens=s.max_tokens,
        system=_anthropic_system(),
        messages=messages,
    )
    text = "".join(b.text for b in resp.content if b.type == "text")
    u = resp.usage
    usage = _normalize_usage(
        getattr(u, "input_tokens", None),
        getattr(u, "output_tokens", None),
        getattr(u, "cache_read_input_tokens", None),
    )
    return text, usage


def stream(messages: list[dict]) -> Iterator[str]:
    s = get_settings()
    if _provider() == "groq":
        completion = _get_groq().chat.completions.create(
            model=s.groq_model,
            max_tokens=s.max_tokens,
            messages=_groq_messages(messages),
            stream=True,
        )
        for chunk in completion:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
        return

    with _get_anthropic().messages.stream(
        model=s.chatbot_model,
        max_tokens=s.max_tokens,
        system=_anthropic_system(),
        messages=messages,
    ) as st:
        for text in st.text_stream:
            yield text
