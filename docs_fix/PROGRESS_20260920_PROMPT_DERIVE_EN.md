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

## Done (2026-09-20, second pass)

- B6 Tray Debian 13 / Ubuntu 26.04: `pycore/pyutils/native_ui/platform_adapter.py`
  display detection refactored from X11-only (`DISPLAY`) to display-server aware
  (`DISPLAY` or `WAYLAND_DISPLAY`/`XDG_SESSION_TYPE=wayland`) — AppIndicator is
  D-Bus SNI and works natively on Wayland; `has_x11` kept as the compat name.
  `step6_tray/appindicator_system_tray.py` docs + install errors updated:
  Debian 13 = Ayatana-only + requires `gnome-shell-extension-appindicator`;
  Ubuntu 26.04 = extension preinstalled (gnome-shell-ubuntu-extensions), Ayatana
  preferred, legacy binding kept as Ubuntu-only fallback.
  Sources: packages.debian.org trixie, packages.ubuntu.com resolute,
  ubuntu/gnome-shell-extension-appindicator README.
- B7 Desktop toasts: `pycore/pyutils/desktop/toast_stack.py` (new shared library;
  no pre-existing desktop toast found) — tkinter bottom-right stacked cards,
  newest at bottom pushes older up, click copies the EN prompt, max 5 visible,
  headless-safe, THREAD_BUS shutdown hook. WEB UI: `shared/notify/notify.tsx`
  upgraded in place (reuse confirmed): viewport moved to bottom-right with
  new-pushes-old-up stacking, `copyText` option (copy chip + click-to-copy),
  single global `AppToaster` mount = pops on all surfaces.
  `PromptDerivedHost.tsx` passes `copyText` and bridges the Laravel relay
  (Mercure) frame onto the local topic with id-based dedup.
- B8 Sound: `pycore/pyutils/audio_utils/notification_sound.py` (new) —
  Windows winsound alias; Linux canberra-gtk-play (`message-new-instant`) →
  paplay/pw-play freedesktop theme file → bell. Flag `prompt_derive_sound`
  (default true) added to `config/agent_history.settings.json` defaults +
  `pipeline/config.py` save whitelist (note: keys MUST exist in the defaults
  file — `get_config()` filters stored keys against defaults; `prompt_derive_en`
  was added there too, fixing a read-filtering gap). Toggles: WEB UI bell button
  in `PromptDerivedPanel` (persists via `persistAgentHistoryArticleConfig`) and
  Linux tray menu item (`tray_action_toggle_prompt_derive_sound`, handler in
  `pycore/pyctl/runtime/event_handlers.py`); the derive worker checks the flag
  before every playback — pycore owns the sound.
- B9 Laravel relay forwards `agent_history.prompt.derived` (deep refactor):
  `config/pycore_relay_contract.json` (single source for pycore + Laravel + UI)
  gained the event, its payload profile, and the `ui/agent_history/prompt_derived`
  route policy; both validators now require the agent-history events
  (`pycore/pyutils/common/relay_contract.py`, `RelayContract.php`);
  `laravel_relay_agent_service.py` publish methods unified into
  `_publish_agent_history_event(event_name, payload, container_key)` and the
  derived handler registered/unregistered in start/stop;
  `RelayDeviceService.php` allows the new device event.

### Verification (B)
- py_compile passes for all touched Python files; both edited JSON configs and
  all three i18n translation files parse; pycore RelayContract loads the updated
  contract (digest recomputed) and resolves the new event name.
- `php -l` clean on RelayContract.php and RelayDeviceService.php.
- UI `tsc --noEmit`: zero errors in touched files; `npm run build` (vite) succeeds.

## Known scope notes

- End-to-end run of the derive service requires a Linux host; on Windows it logs a skip line.

---
Follow-up (2026-09-26): `docs_fix/FIX_20260926_AGENT_HISTORY_SCAN_CENTER_MONITOR_TRAY_NOTIFY.md`
implements the missing piece of B6/B7 for NEW prompts: a tray/desktop notification now fires on
every `agent_history.prompt.new` event (both platforms; freedesktop notify-send on Linux, Qt
showMessage / Win32 NIF_INFO balloon on Windows, tkinter toast fallback), gated by the new
`prompt_new_notify` config flag with a tray-menu toggle. The derive-path toast/sound (Linux-only,
post-AI-derivation) remains a separate surface.
