---
name: wordnew-web-e2e-findings
description: 2026-10-08 browser E2E of the orchestration monitor - web-only clip/cursor behaviour, dev-server quirks, PC clock drift, how to drive the page
metadata:
  type: project
---

Web wordnew keeps delivered clips only in page memory, so the book-plan ready cursor must not be reused across runs there (`KEEP_DELIVERED = isNativeAppShell()` in `WordNewBookAudioPlan.ts`). Re-plans while Laravel is still extracting phrases (plan hash changes every minute or two) make the web page re-fetch the whole book each time - known, by design, not fixed.

Test-driving facts (the dev server on 13054 is the user's long-running `bun x vite`, serving all apps):
- Page must be `visibilityState=visible` (own window via `newWindow`) or the app does not route/run; Vite full-reloads the page on any UI file edit and wipes injected fetch hooks.
- `import('/apps/...')` from the console yields a different module instance than the app: use it only for stateless calls (api, AuthSession), never for composer/store state.
- The stored Laravel session had no wordnew profile (UI showed logged out); `notifyAuthLoginSuccess(user, null, ns)` from `core/auth/AuthRequestCenter.ts` with the `/api/user` answer logs the UI in without typing secrets.
- Native `confirm()` (Delete composition) hangs CDP and `chrome_handle_dialog` times out: close the tab, delete via `DELETE .../client_tasks/<id>?client_updated_at=<future ISO>` (local edits win over an older delete stamp).
- This PC's clock ran ~10 min ahead of real time (Laravel is right, pycore logs "clock offset -596s"); manager ages are now server-clock based (`server_time` in `work/monitor`).
- Laravel Postgres dropped twice (~1-2 min each) during the test; after recovery wordnew self-healed within ~1-2 min.

**Why:** these cost most of the session; reuse them to skip rediscovery.

**How to apply:** for any UI E2E in Chrome, open the page in its own window, install the fetch hook right after load, and read state through the monitor (`laravel_signed_cli.js request GET /api/work/monitor`) rather than DOM text.
