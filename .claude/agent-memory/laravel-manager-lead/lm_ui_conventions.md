---
name: lm-ui-conventions
description: laravel-manager UI app shared responsive components, i18n split and EOL gotchas learned while making it mobile-compact
metadata:
  type: project
---

- Shared responsive layout primitives live in `apps/laravel-manager/components/common/CenteredPageLayout.tsx` (CenteredPage, PageHeader, PageActionButton, CenteredTabBar, SCROLL_X_HIDDEN_CLASS); reuse them for any new page header or tab bar instead of inline flex-wrap bars.
- Two i18n systems coexist: i18next keys (`useTranslation().t('header.x')`, files `locales/Lm{En,Zh}{Core,Operations}.ts`) and the legacy `TRANSLATIONS[lang].server|vocabulary|settings` object read from the same locale files. ZH is type-checked against EN (`LmTranslationDict`), so add every key to both.
- Worktree files are mostly CRLF but some (VocabularyLearning, DatabaseManager, LibrariesTab) are LF; the Edit tool can flip endings. Edit via a small node script that detects `\r\n` and restores it, then verify with `git ls-files --eol`.
- Protected views (AuthGuard) stay mounted while logged out, so their first loads 401; LmDashboard keys protected content by auth state to remount after login.
- The Laravel debug interface (`laravel_main/public/debug-assets`) renders the page title in its own header; section iframes must not repeat it.

**Why:** a mobile-compact pass (2026-10-02) touched many files; these are the conventions that avoid redoing it.
**How to apply:** before adding UI to laravel-manager, reuse these primitives and add EN+ZH keys together.
