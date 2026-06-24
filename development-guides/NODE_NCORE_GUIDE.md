# Node.js ncore Development Guide

## 1. Core Coding Rules (Highest Priority)
- Code, comments, and logs in English only; no test code; no summaries inside source files.
- Target the latest Node.js; always reference via package.json aliases, never relative paths.
- When upgrading, keep old function names and parameter order for backward compatibility.
- Never `throw new Error`: use `logger.error` and then `return` or branch with `if`.
- Static files go in the root `public/` (not gitignored); cache/tmp/debug always use the `#@global_dir` presets, no manual ensure; 7z/curl/git binary paths also use `#@global_dir` presets, never hardcode.

## 2. Architecture Layers & Dependency Direction
- `ncore/foundation`: lowest-level base capabilities; node-native only, no third-party packages, no classes, references only deeper code within foundation.
- `ncore/utils`: feature modules (one subdir = one feature); export an instance, not a class; may build on foundation + global_vars; never reimplement foundation (file/log/encoding, etc.).
- `ncore/global_vars`: the single project-wide constants region, including dynamically computed constants (e.g. disk size); `index.js` is the computed export entry, subdirs support it.
- `ncore/ncontroller`: multi-controller architecture; each controller reuses utils; avoid circular dependencies with utils.
- `apps/<app>`: entry layer that organizes ncore into applications; keep app code minimal, implement features in utils.
- Placement rule: constants → global_vars; file/log/network/subprocess → foundation; generic new tools → ncore/utils; pure node-native base → foundation.

## 3. Alias Rules
- Don't add package.json aliases freely, only important/general ones; otherwise reference files directly via `#@ncore/xxx/xxx.js`; verify every alias against package.json, never guess; the global encoding library is `encoding.js`.
- Key aliases (names only, paths in package.json): `#@/*` `#@ncore/*` `#@apps/*` `#@global_vars` `#@global_dir`(=`#@bdir`) `#@gconfig` `#@logger` `#@commander` `#@freader` `#@fwriter` `#@ftools` `#@btools` `#@dbtools` `#@downloader`.

## 4. Third-Party Package Policy
- Only use packages that support the latest Node or were updated within the last two years; otherwise implement natively per the layering rules.
- When you do add one, append a `yarn add` line to the root README.md and note the rationale.

## 5. App Rules
- Launch: `node main.js app=appName` → automatically calls `start()` in `apps/<app>/main.js`; avoid re-wrapping ncore.
- Before new or incremental development, scan ncore and write a split-of-responsibility analysis to `apps/<app>/development_analysis.md`; write no other docs.
- Config: the app's `config/index.js` is merged with the main config via `#@gconfig`; access it through `#@gconfig` in code.
- Each app must provide `scripts/{start,install,deploy,stop}.ps1` for the unified manager to call; install special system dependencies in install.ps1.
- No package.json or Dockerfile inside an app (the real entry is the root main.js); reuse and may extend `foundation/express_utils` and `foundation/db_utils` for web/db (DB prefers sqlite).

## 6. Nuxt-Laravel Integration
- API port priority: remote HTTPS(443) > local domain HTTP(80) > local IP `:9003`; health check: any HTTP response = healthy, network errors only = unhealthy.
- All Nuxt API requests must go through the unified client `common/utils/http-client.ts` (middleware/logging/auth/retry, 2s retry queue for POST when unavailable, CSRF management): `import { httpClient } from '@/common/utils/http-client'`.
