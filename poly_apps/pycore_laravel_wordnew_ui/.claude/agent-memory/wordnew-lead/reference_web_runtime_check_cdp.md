---
name: web-runtime-check-via-raw-cdp
description: How to runtime-check wordnew modules in a real browser when puppeteer is unusable (dev server 13054 + headless Chrome over raw CDP)
metadata:
  type: reference
---

`node_modules/puppeteer` under D:\programing\core_node is EPERM-blocked (stat fails), and `puppeteer-core` is not installed, so scripts cannot `require` it.

Working method: spawn `C:/Program Files/Google/Chrome/Application/chrome.exe --headless=new --remote-debugging-port=9333 --user-data-dir=<scratchpad>`, read `http://127.0.0.1:9333/json/list`, open the `webSocketDebuggerUrl` with Node 24's global `WebSocket`, `Page.navigate` to the Vite dev server `http://127.0.0.1:13054/`, wait ~15 s, then `Runtime.evaluate` with `awaitPromise` and `await import('/apps/wordnew/...ts')` to call module exports (Vite serves source paths directly). Collect `Runtime.exceptionThrown` / console errors.

**Why:** lets you prove new modules load (including dynamic imports) without building an APK or needing the chrome MCP (often ECONNREFUSED).

**How to apply:** use for sanity checks after wordnew service/cache changes; the headless page cannot reach pycore/Laravel (SYN_SENT), so network paths just time out.

Related drill: extract the first ```ts block of docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md into the scratchpad and run it with `WORDNEW_UI_ROOT=<abs ui root> bun run drill.ts`.
