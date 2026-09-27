---
name: wordnew-i18n-session-scope
description: Where wordnew keeps locales (4 languages), how non-React code translates, and which identity scopes per-user local data
metadata:
  type: project
---

- wordnew locales are en/zh/ja/ko flat-key dictionaries in `apps/wordnew/locales/<lang>_{a,b}.ts`; every new key goes into all four. wordnew does not register with the shell i18next instance; components use `translate(shellLang, key)` via `trans`.
- Non-React modules (transports, services) use `translateActive(key)` from `apps/wordnew/WfNewLocales.ts`, which reads `<html lang>` that `ShellProvider` keeps in sync.
- Per-session local data scope is `scopeFor(token)` in `apps/wordnew/runtime-store/WfNewServerMirror.ts` (`user-<stableHash(token)>` / `public`). The `userId` field in `wfNewSettings` can desync from the shared AuthSession token (login changed in another app), so do not use it as a security scope.

**Why:** learned while fixing FU-031/FU-042 (2026-09-27).

**How to apply:** reuse these instead of adding new language lookups or identity scopes. See [[crlf-mixed-line-endings]] before editing the locale files.
