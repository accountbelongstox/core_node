---
name: project-model-manifest-hub
description: 2026-09-30 /pycore-manager/ai rebuild - one model manifest (pyutils/common/model_manifest), boot masking, ai_hub routes, model_live monitors; what is unverified and open
metadata:
  type: project
---

One manifest replaces per-domain engine/provider tables: `pyutils/common/model_manifest.py` (ModelEntry, registry, ids unique per category: use `entry.key` = `category:id`), `model_boot.py` (verdict signals, `is_blocked`), `model_reasons.py`, `model_checks.py`. Leaf declarations: `tts_manifest`, `stt_manifest`, `ocr_manifest`, `llm_manifest`, `translate_manifest`, `pyctl/ai/ai_manifest`; `pyctl/ai_hub/manifest_loader.load()` imports them all. Boot runs synchronously first in `event_handlers` (`boot_service.verify_all`); `blocked` = masked until `retry` (saving an API key retries), `deferred` = fixable by managed lifecycle, never masked. Hub routes `ui/ai_hub/*`, live routes `ui/model_live/*` (sampler only publishes while watched or a job runs). Design: `docs_fix/DESIGN_20260930_AI_MODEL_MANIFEST_AND_HUB.md`.

**Why:** user asked (2026-09-30) to dedupe AI definitions, give every AI test+history, live qwen3tts and kokoro monitors, boot-time lazy load that masks failing models.

**How to apply / open:** nothing ran against live services (static + import-only checks). New routes/topics have no `route_policies` entry in `config/pycore_relay_contract.json` (orchestrator change; suggested: catalog/history/boot_status general_read, test/history_delete/history_clear/boot_retry general_action). Unused duplicate routes `ui/tts_status/test`, `ui/stt_status/test`, `ui/ocr_status/test` remain; five near-identical JSON-ring history stores remain unmerged; `catalog_service.tier()` repeats capabilities tier logic; kokoro per-word events only on the batched-serial path (`KOKORO_BATCH_MERGED=1` reports per group). Locale keys for `model_*` reason codes are needed in the UI. See [[project-pycore-pitfalls]].
