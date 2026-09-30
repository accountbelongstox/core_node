---
name: ai-hub-ui
description: /pycore-manager/ai rebuild (2026-09-30) — tab model, shared component set, and the real ai_hub / model_live contract facts that differ from the design doc
metadata:
  type: project
---

`/pycore-manager/ai` is manifest-driven. Tab model is defined once in `pages/ai/aiTabs.ts` (models, providers, studio, tools, history; legacy slugs capability/keys and the four former tool slugs resolve through `resolveTabTarget`). Shared kit lives in `components/ai/` (PcStatusPill/PcChip/PcDot, PcTierBadge, PcKeySlots, PcHistoryList, `live/PcLivePanel`, `test/PcTestPopup`, `models/*`, `providers/*`, `tools/PcToolChrome`). Stores: `api/AiHubCatalogStore.ts`, `api/ModelLiveStore.ts` (built on `PcExternalStore`). Hooks: `usePcHistory`, `usePcRefreshSignal`, `usePcProviders`. History stores are one table in `utils/pcHistorySources.ts`.

**Why:** user asked for a no-patch rebuild with one shared component set and every model getting tests + history.

**How to apply / contract facts read from pycore/pyctl/ai_hub (not in the design doc):**
- Entry ids are unique per CATEGORY only (`tts:azure` vs `stt:azure`). Send `key` (`category:id`) + `category` for test / history / boot_retry; `aiHubEntryKey()` builds it.
- Categories: ai_text, ai_image, tts, stt, ocr, llm, translate, library. Boot states: ready, deferred, blocked, pending. `capabilities.power` is a bool; there is no hub power route, so power uses the existing tts/llm server-action routes by category.
- `test_schema.fields[].label_key` is `aiHub.field.<key>`; `visible_when` gates fields; `hints.long_wait`. OCR has an `ocr_text` field and the UI renders it to `image_data`.
- Hub route failures are `{success:false, error:{code,message}}`; test result `data.error` is a string; TTS/STT `result.record_id` is the speech-history id; history `result_ref` is `{kind:'speech_history'|'image_history', id}`.
- `ui/model_live/watch` takes `{active, ttl_s}` (default ttl 30s, max 120s); snapshot has `revision` + `sampled_at` (store guards on sampled_at). `ai_hub.boot.changed` payload is the full boot record (`key`, `state`, `reason_code`...).
- New routes still need `route_policies` in `config/pycore_relay_contract.json` for relay mode (orchestrator-owned).

Gotchas: pycore-manager source files are CRLF (node edit scripts must normalize); Bash heredocs holding TSX with quotes can fail to parse, so use the Write tool. A scoped tsconfig (`extends ./tsconfig.json`, include only `apps/pycore-manager`) type-checks in about 15 s; the full `tsc --noEmit` took about 30 s. TS is non-strict here, so null bugs are not caught by tsc.
