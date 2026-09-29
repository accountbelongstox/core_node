---
name: vortex-i18n-namespace
description: How Vortex UI text is localized (vx namespace, en/zh only, shared EndNamespace gate)
metadata:
  type: project
---

Vortex text lives in `apps/vortex/vx-locales/{en,zh,index}.ts` under the i18next namespace `vx` (sections app, toast, quant, account, backtest), registered by `registerEndLocales('vx', …)` like pdd/cm; components call `useTranslation('vx')`. Panels take no `lang` prop.

- `EndNamespace` in `shell/shell-i18n.ts` (shared layer, not vortex scope) must list `'vx'`; a new namespace needs the orchestrator.
- The shared i18n instance (`core/i18n/UiI18n.ts`) supports only en/zh; the old inline Japanese dictionary was dropped for that reason. Other shell languages fall back to en.
- Use `{{var}}` interpolation; avoid the variable name `count` (plural lookup).

**Why:** FU-042 (2026-09-27) replaced per-panel inline dictionaries and English-only toasts.
**How to apply:** add every new string to both en.ts and zh.ts (zh is typed by `VxTranslationDict`). Related: [[vortex-crlf-files]].
