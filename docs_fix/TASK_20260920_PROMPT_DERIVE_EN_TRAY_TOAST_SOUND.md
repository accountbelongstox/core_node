# TASK 20260920 — Linux New-Prompt EN Derivation, Tray Extension, Stacked Toasts, Sound Flag

Development requirements record (user-stated, verbatim intent preserved).

## A. Original requirements (2026-09-19/20)

1. **pycore shared AI library** — add a public pycore class library that calls OpenRouter and
   reuses the quota base library.
2. **Generalize openrouter:free base library** — make it usable by features other than
   history-agent; quota is shared across all consumers.
3. **New-prompt watcher + UI push** — watch pycore log printing; when a new prompt appears AND
   the system is Linux, call the library with the preset instruction (derive the prompt into
   standard English, strip DEBUG code parts, return only the precise derived prompt). Print the
   AI result immediately and stream it to the UI at `/pycore-manager/agent-history`.
   UI: extend a shared component; on push, immediately print "current linux (debian) system new
   prompt, AGENT name, original, AI-derived EN"; use the library's popup component to show a
   corner popup; clicking it opens the global panel embedded into Cloud Clipboard as two tabs.
4. **Pipeline prompts relocation** — move pipeline prompt editing from
   `/pycore-manager/agent-history` to the matching AI provider's label under
   `/pycore-manager/ai`, editable, and also editable for the derive-to-EN preset.
5. **AI availability status cache** — cache availability of all AIs on `/pycore-manager/ai` in
   pycore; re-test only after restart; pycore probes once at startup and caches immediately;
   UI reads the pycore cache and caches in the frontend; when pycore restarts the UI refreshes
   its frontend cache. Reuse both sides' cache libraries.

## B. Additional requirements (2026-09-20)

6. **Tray menu awareness** — the push must account for pycore's tray menu. Extend tray support
   to Debian 13 and Ubuntu 26.04; consult official documentation first.
7. **Desktop + Web stacked toasts** — the push also pops as a UI in the bottom-right corner;
   clicking copies the derived EN prompt. Popups stack: a new popup pushes older ones up.
   WEB UI behaves the same; confirm the WEB UI popup reuses a suitable class from the shared
   library — if none fits, create the library — and popups appear on all surfaces.
8. **Sound on popup** — play a sound when the popup shows; the UI side can disable it. When the
   WEB UI disables it, the WEB UI operates the pycore side; pycore owns sound playback; when
   disabled via WEB UI, pycore stops playing via a flag.
9. **Laravel relay must forward the new event** (`agent_history.prompt.derived`) — deep
   refactor, not a surface patch.

## Standing rules (from AGENTS.md)

- English-only code/comments/logs; i18n for user-facing strings; no tests unless asked.
- Refactor shared layers instead of patching; reuse existing components first.
- Windows + Linux compatible; pycore layering: pyfoundations < pyutils < pyctl < callmodule.
