# Portfolio RAG Chatbot

A retrieval-augmented generation (RAG) chatbot that helps visitors navigate and
learn about the Windows XP-themed portfolio site. It retrieves relevant chunks
from your portfolio documentation and answers with **Claude**, staying grounded
in those docs and declining out-of-scope questions.

- **Backend:** FastAPI (Python)
- **Embeddings:** local [`fastembed`](https://github.com/qdrant/fastembed) (free, no API key, runs offline)
- **Vector DB:** FAISS (local file)
- **LLM:** Anthropic Claude (`claude-haiku-4-5` by default — fast & cheap)
- **Frontend:** vanilla-JS chat widget, styled to match the XP desktop

```
chatbot/
├── app/
│   ├── config.py        # settings from env / .env
│   ├── embeddings.py    # local fastembed wrapper
│   ├── vector_store.py  # FAISS build / load / search
│   ├── ingest.py        # chunk docs + build the index  (python -m app.ingest)
│   ├── prompts.py       # static, cacheable system prompt
│   ├── rag.py           # retrieve -> Claude (answer + streaming)
│   ├── schemas.py       # API request/response models
│   └── main.py          # FastAPI app: /health /chat /chat/stream
├── data/
│   ├── docs/            # YOUR portfolio docs (.md / .txt) go here
│   └── index/           # generated FAISS index (gitignored)
├── frontend/
│   ├── chatbot-widget.js
│   ├── chatbot-widget.css
│   └── demo.html        # standalone demo page
├── requirements.txt
├── .env.example
└── Procfile             # for Railway / Render / Heroku-style hosts
```

## 1. Setup

Use **Python 3.12** — the pinned versions in `requirements.txt` are verified to
install as wheels (no source builds) on 3.12. Native deps (`faiss-cpu`,
`fastembed`) may lack wheels for very new versions like 3.14.

```bash
cd chatbot
# Windows (PowerShell):
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
# macOS / Linux:
# python3.12 -m venv .venv && source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env        # then edit .env and add an LLM provider key
```

**Choose an LLM provider** in `.env` via `LLM_PROVIDER`:

- `groq` — **free for development**, no credit card. Get a key at
  <https://console.groq.com/keys> and set `GROQ_API_KEY`.
- `anthropic` — Claude (production target, paid). Get a key at
  <https://console.anthropic.com/> → Settings → API Keys and set `ANTHROPIC_API_KEY`.

Retrieval/embeddings are local and free regardless of provider — only the
answer-generation step uses the chosen provider.

## 2. Add your documents

Drop Markdown or text files describing your projects, tech stack, experience,
and a site-usage guide into `data/docs/`. A `sample-portfolio.md` is included so
things work immediately — replace or augment it with your real content.

## 3. Build the index

```bash
python -m app.ingest
```

This chunks every `.md` / `.txt` under `data/docs/`, embeds them locally, and
writes the FAISS index to `data/index/`. Re-run it whenever your docs change.
(First run downloads the embedding model — a few seconds.)

## 4. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

- Health check: <http://localhost:8000/health>
- Interactive API docs: <http://localhost:8000/docs>

Quick test:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What can I do on this site?"}'
```

## 5. Try the widget

Open `frontend/demo.html` in a browser (the backend must be running). Click
**"Ask about this site"** in the bottom-right corner.

### Embed on your portfolio

Add to your site's HTML (copy `chatbot-widget.js` / `.css` to where your site
serves static assets):

```html
<link rel="stylesheet" href="chatbot-widget.css" />
<script>
  window.PORTFOLIO_CHATBOT = { apiUrl: "https://your-backend-url" };
</script>
<script src="chatbot-widget.js" defer></script>
```

## API

| Method | Path           | Description                                            |
| ------ | -------------- | ------------------------------------------------------ |
| GET    | `/health`      | `{ "status": "ok", "model": "..." }`                   |
| POST   | `/chat`        | `{ message, history? }` → `{ answer, sources[] }`      |
| POST   | `/chat/stream` | same body; streams SSE `delta` events then `done`      |

`history` is an array of prior turns: `[{ "role": "user"|"assistant", "content": "..." }]`
(don't include the current message — it goes in `message`).

The `/chat/stream` SSE events look like:

```
data: {"type": "delta", "text": "Hello"}
data: {"type": "delta", "text": " there"}
data: {"type": "done", "sources": [{"source": "...", "title": "...", "score": 0.62}]}
```

## Configuration

All settings come from environment variables (see `.env.example`):

| Variable            | Default                     | Notes                                            |
| ------------------- | --------------------------- | ------------------------------------------------ |
| `LLM_PROVIDER`      | `anthropic`                 | `groq` (free dev) or `anthropic` (paid, prod)    |
| `MAX_TOKENS`        | `1024`                      | max answer length                                |
| `GROQ_API_KEY`      | —                           | required when `LLM_PROVIDER=groq`                |
| `GROQ_MODEL`        | `llama-3.3-70b-versatile`   | any Groq-hosted model                            |
| `ANTHROPIC_API_KEY` | —                           | required when `LLM_PROVIDER=anthropic`           |
| `CHATBOT_MODEL`     | `claude-haiku-4-5`          | `claude-sonnet-4-6` / `claude-opus-4-8` for more quality |
| `EMBEDDING_MODEL`   | `BAAI/bge-small-en-v1.5` | any fastembed-supported model                    |
| `TOP_K`             | `4`                      | chunks retrieved per query                       |
| `MIN_SCORE`         | `0.3`                    | drop chunks below this cosine similarity         |
| `CHUNK_SIZE`        | `800`                    | chunk size in characters                         |
| `CHUNK_OVERLAP`     | `150`                    | overlap between chunks                           |
| `ALLOWED_ORIGINS`   | `*`                      | set to your site's origin in production          |
| `RATE_LIMIT`        | `20/minute`              | per-IP limit                                     |

## How grounding works

1. The visitor's question is embedded locally and matched against the FAISS index.
2. The top chunks (above `MIN_SCORE`) are formatted as context and placed in the
   **user** turn.
3. A static, cacheable **system prompt** instructs Claude to answer only from that
   context, decline out-of-scope questions, and keep the friendly XP tone.
4. The answer is returned with the source sections it drew from.

**Prompt caching:** the system prompt carries a `cache_control` breakpoint, so once
it's large enough (~4096 tokens for Haiku 4.5) its tokens are cached across requests.
Check `usage.cache_read_input_tokens` in the server logs to confirm cache hits — a
short system prompt simply won't cache (a harmless no-op).

## Deploy

The app is a standard ASGI server. On **Railway** / **Render** / Heroku-style hosts
the included `Procfile` works:

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Steps:

1. Set env vars (`ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS=https://your-site.com`, etc.).
2. Commit the built index (`data/index/`) **or** run `python -m app.ingest` as part
   of your build/release step. (The index is gitignored by default — easiest is to
   add an ingest step to your deploy.)
3. Point the widget's `apiUrl` at the deployed backend.

> For higher-volume production you can swap FAISS for a managed vector DB
> (e.g. Pinecone) by reimplementing `vector_store.py`'s `build` / `load` / `search`.
