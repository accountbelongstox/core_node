---
name: lm-i18n-conventions
description: laravel-manager i18n has two styles (i18next t with {{x}} vs TRANSLATIONS[lang] objects with {x} + .replace); zh is typed against en; how to verify keys
metadata:
  type: project
---

laravel-manager (lm) locales live in `apps/laravel-manager/locales/` (LmEnCore/LmEnOperations + zh twins), composed in `LmTranslations.ts`, registered into the i18next `translation` namespace by `apps/laravel-manager/i18n.ts`.

Two coexisting call styles; follow the file you edit:
- `useTranslation()` from `@/apps/laravel-manager/i18n` → `t('db_manager.x', { n })`, placeholders `{{n}}`; bold fragments via `Trans` with named `components={{ strong: <strong /> }}`.
- `TRANSLATIONS[lang].server` object access (ServerManager.tsx, Settings.tsx) → placeholders `{x}` filled with `.replace('{x}', v)`; there is no helper.

Since 2026-09-27 zh is typed as `LmTranslationDict` (en key tree, string leaves): a missing zh key is a compile error. zh needs `_one` plural twins too (e.g. `libraryCover.attempts_one`).

**Why:** the audit found raw keys / English fallbacks because nothing enforced parity, and `|| 'English'` fallbacks hid missing keys.
**How to apply:** add every new key to en and zh in the same edit; never add `|| 'English'` fallbacks; logs (logInfo/logError) stay English. Verify with an in-memory TS transpile key checker plus a compiler-API `noEmit` type check (see [[lm-static-checks]]).
