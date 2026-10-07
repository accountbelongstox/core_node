---
name: project-phrase-extraction-model-selection
description: 2026-10-08 phrase extraction got dynamic OpenRouter free-model selection, model health cooldown, failure policy, status endpoint; what was left for the server
metadata:
  type: project
---

Phrase pipeline (docs_fix/DESIGN_PHRASE_PIPELINE.md) was already fully built on 2026-10-05; the 2026-10-08 pass only hardened the OpenRouter part: `AppQyV1PhraseModelSelector` (pinned ids filtered by the live free catalog + top-up, strikes/cooldown in file cache), contract `extraction.model_selection` / `failure_policy`, parser salvage of cut-off JSON, `served_model`/`finish_reason`/`reasoning_only` from `OpenAiCompatClient` (Laravel) and `openai_compat_client` (pycore), pycore handler now sends the payload `request_options`, `GET phrases/extraction_status`.

**Why:** pinned model ids vanish, free models return reasoning text / guard answers, and every such failure used to charge 3 attempts to up to 20 sentences, parking them as `failed`.
**How to apply:** if extraction stalls, read `phrases/extraction_status` (model_health, backoff_seconds) before touching code. Local `php artisan` boots and `127.0.0.1` Postgres exists but has no phrase tables: run read-only harnesses (selector/parser) via a scratch bootstrap script, never sys:init. Clock skew on this PC blocks laravel_signed_cli (client_key_timestamp_invalid) so server verification needs the clock fixed or a gitsync --notice-laravel by the parent.
