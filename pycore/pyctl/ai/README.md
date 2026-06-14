# pyctl/ai — Unified AI provider probe

Orchestrates the pyutils AI clients and exposes a single health/availability
probe for the desktop UI.

## Providers

| name         | client (pyutils)                         | key names (secret store)                        | endpoint |
|--------------|------------------------------------------|--------------------------------------------------|----------|
| `openrouter` | `pyutils/openrouter_sdk`                 | `OPENROUTER_API_KEY_1` / `_2`                    | `https://openrouter.ai/api/v1` |
| `gemini`     | `pyutils/gemini` (`google-genai` SDK)    | `GOOGLE_API_KEY_1` / `_2`                        | Google Gemini API |
| `deepseek`   | `pyutils/deepseek` (`openai` SDK)        | `DEEPSEEK_API_KEY_1` / `DEEPSEEK_API_KEY`        | `https://api.deepseek.com` (OpenAI-compatible) |

**"Google AI" == Gemini.** Gemini *is* Google's generative-AI surface; the
`google-genai` SDK + `GOOGLE_API_KEY` are the single Google generative-AI entry,
so there is no separate `google-ai` provider — it is the `gemini` entry.

**DeepSeek is OpenAI-API-compatible**, so its client wraps the official `openai`
SDK with `base_url=https://api.deepseek.com`.

## Key store + reader

All keys are read through the **common** secret reader
`pycore.pyfoundations.secret_manager.get_secret_key(name)`, which loads the first
non-empty line of `.secret_keys/.secret_ignore/<NAME>` (auto-decrypting from
`already_encrypted/` when needed). Never hand-roll secret-file parsing.

## Probe API

`probe_all()` (in `ai_probe.py`) returns the exact contract below; the FastAPI
route `GET /api/local/ai/probe` wraps it (router: `callmodule/routers/local/ai_probe_router.py`).

```json
{
  "providers": [
    {
      "name": "openrouter",
      "configured": true,
      "available": true,
      "image": false,
      "key_masked": "sk-o…9d5e",
      "models": ["..."],
      "error": null,
      "latency_ms": 696.2
    }
  ]
}
```

- `configured` — a key is present in the store.
- `available` — the live list-models call succeeded.
- `image` — the provider can GENERATE images (static registry flag from
  `ai_keys.PROVIDERS`; gateway `POST /api/local/ai/image` dispatches over these).
- `key_masked` — **first 4 + `…` + last 4 chars only**; `null` when no key. The
  full secret is NEVER returned.
- `models` — up to 5 model ids from the live call.
- `latency_ms` — probe round-trip, or `null` when not probed.

The route caches the last result ~30s (cheap repeat UI loads); pass `?refresh=1`
to force a fresh probe. The route adds `cached` (bool) and `age_ms` to the
response.

## Masked-key policy

Masking is centralized in `ai_probe.mask_key()`: `first4 + "…" + last4`, and keys
of length ≤ 8 are fully ellipsized (`"…"`). No endpoint or log ever emits a full
key.
