# PROGRESS 20260920 — Prompt Derive EN Pipeline (Tasks A1–A5 Done; B6–B9 In Progress)

Requirements record: `docs_fix/TASK_20260920_PROMPT_DERIVE_EN_TRAY_TOAST_SOUND.md`.

## Done (verified)

### A1+A2 — Shared OpenRouter free-quota library
- `pycore/pyctl/ai/ai_free_text.py` (new): `free_text_chat`, `free_text_prompt`,
  `ensure_free_text_available`, `resolve_free_text_model`; quota guard shared via
  `ai_rate_limits.check_rate_limit`.
- `pycore/pyctl/agent_history/pipeline/article_stages.py`: inline quota guard removed,
  refactored onto `ai_free_text` (single shared entry, not a patch).

### A3 — Linux new-prompt watcher → derive → print → push
- `pycore/pyctl/ai/prompt_derive.py` (new): `derive_prompt_en`, preset
  `DEFAULT_PROMPT_DERIVE_EN_PROMPT`, config key `prompt_derive_en`.
- `pycore/pyctl/agent_history/prompt_derive_service.py` (new): Linux-only
  (`sys.platform.startswith("linux")`); subscribes `AGENT_HISTORY_PROMPT_NEW`, serialized
  worker queue, cap 3 prompts/event, full text via `agent_history_service.read_prompt_page`;
  on success: cache append + `ColorPrint` + `THREAD_BUS.trigger_event(
  BusSignals.AGENT_HISTORY_PROMPT_DERIVED)`.
- `pycore/pyctl/agent_history/prompt_derived_cache.py` (new): AtomicJsonStore read-side
  mirror, 1000 entries, route `ui/agent_history/prompt_derived`.
- Bus/routes: `thread_bus_constants.py`, `thread_bus_routes.py` (SSE whitelist),
  `route_names.py`, `local_agent_history_routes.py`, `ui_service.py` handler.
- UI: `PycoreEventTopics.ts` (+`agentHistoryPromptDerived`), `PycoreHttpRoutes.ts`,
  `PycoreSpeechTypes.ts`, `PycoreApiLocal.ts`.
- UI push surface: `shared/prompt-derived/PromptDerivedHost.tsx` (global subscriber → log +
  corner popup via shared `shared/notify` library; click action opens panel),
  `shared/prompt-derived/PromptDerivedPanel.tsx`; Cloud Clipboard is now two tabs
  (`shell/ShellCloudClipboard.tsx`, `shell/shellTypes.ts`, `shell/ShellProvider.tsx`),
  i18n in `shared/cloud-clipboard/CloudClipboardLocales.ts`.

### A4 — Pipeline prompts moved to AI page
- `apps/pycore-manager/components/PcAiProviderPromptsEditor.tsx` (new): 3 editable presets
  (article CN / translate EN / derive EN) under the OpenRouter provider card on
  `/pycore-manager/ai?tab=capability`; empty value = built-in default.
- `apps/pycore-manager/pages/agent-history/PcAgentHistoryConfigPanel.tsx`: prompt editors
  removed, replaced by a link to the AI page.
- i18n keys added in `pc-locales/PcZhFeatures.ts` / `PcEnFeatures.ts`.

### A5 — AI availability cache (both ends)
- `pycore/pyctl/ai/probe_service.py`: process-lifetime cache (re-probe only after restart),
  `boot_id` in every response, `warm_startup_probe()` fills cache at boot; wired in
  `pycore/pyctl/runtime/event_handlers.py`.
- UI `PcAiCapabilityView.tsx`: hydrates from `pycoreRouteRecoveryStore`, refreshes from
  backend cache, re-reads on `httpEventServerRestarted`, writes cache after probe/testAll.

### Verification (A)
- `python -m py_compile` passes for all 12 touched/new Python files.
- UI `npm run build` (vite) succeeds; `tsc --noEmit` reports zero errors in all touched files
  (remaining errors are pre-existing in unrelated wordnew/laravel-manager apps).

## In progress / pending (B)

- B6 Tray Debian 13 / Ubuntu 26.04 support — official-doc research running; current backend
  selection lives in `pycore/pyutils/native_ui/platform_adapter.py` (X11-only detection is a
  suspected gap on Wayland-default sessions), tray backends in
  `pycore/pyutils/native_ui/step6_tray/` (AppIndicator ayatana/legacy fallback exists).
- B7 Desktop stacked toasts (bottom-right, click-to-copy EN, new pushes old up) — no existing
  pycore desktop-toast library found; will create one under `pycore/pyutils/`; WEB UI reuses
  `shared/notify` (to be extended: stack offset + copy action on all surfaces).
- B8 Sound on popup — pycore owns playback; WEB UI setting toggles a pycore-side flag via HTTP.
- B9 Laravel relay forwarding of `agent_history.prompt.derived` — deep refactor of the relay
  contract (`config/pycore_relay_contract.json` events table + digest) instead of the earlier
  skip decision (superseded by user instruction).

## Known scope notes

- End-to-end run of the derive service requires a Linux host; on Windows it logs a skip line.
