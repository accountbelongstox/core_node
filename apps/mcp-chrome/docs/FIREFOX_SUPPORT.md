# Firefox Support

`apps/mcp-chrome` builds for both Chrome and Firefox from one source tree. Firefox
support is a port of the Chrome extension; Chrome behavior is unchanged.

## Build

```bash
# Chrome (unchanged) -> .output/build_extension
wxt build

# Firefox -> .output/build_extension_firefox
wxt build -b firefox --mv3
```

The `--mv3` flag is required for Firefox (WXT defaults Firefox to MV2). Output
dirs are separate so both builds coexist. After editing `packages/shared/src`,
rebuild it first (`pnpm run build:shared`, or run `pnpm run build:all` which
does this in order) — the extension build consumes the shared `dist`.

## Install

### Extension
- **Temporary load (dev):** Firefox → `about:debugging#/runtime/this-firefox` →
  "Load Temporary Add-on" → select `.output/build_extension_firefox/manifest.json`.
- **Signed (production):** `wxt zip -b firefox --mv3` produces an `.xpi`; sign via
  [AMO](https://addons.mozilla.org/developers/) (a sources zip is also produced,
  which AMO review requires).

### Native messaging host
Firefox uses `allowed_extensions` (not Chrome's `allowed_origins`), so a separate
host manifest is written. The registration CLI detects Firefox automatically:

```bash
npx chrome-mcp-bridge register            # user-level
npx chrome-mcp-bridge register --system   # system-level
```

The Firefox host manifest `allowed_extensions` is `["mcp-chrome@core-node"]`
(the gecko id in `wxt.config.ts`) and is placed at:
- Linux user: `~/.mozilla/native-messaging-hosts/com.chromemcp.nativehost.json`
- Linux system: `/usr/lib/mozilla/native-messaging-hosts/com.chromemcp.nativehost.json`
- macOS user: `~/Library/Application Support/Mozilla/NativeMessagingHosts/…`
- Windows: registry `HKCU\Software\Mozilla\NativeMessagingHosts\com.chromemcp.nativehost`

Minimum Firefox version: **128** (MAIN-world `scripting.executeScript`).

## Tool support matrix on Firefox

| Area | Status on Firefox | Notes |
|------|-------------------|-------|
| Tabs / navigation / screenshot / read-page / click / keyboard / element-picker | ✅ Works | Same as Chrome |
| Bookmarks / history / downloads / window / javascript / inject-script / web-fetcher | ✅ Works | Same as Chrome |
| Web chats (ChatGPT, Gemini, Copilot, Grok, DeepSeek, NotebookLM) | ✅ Works | Same as Chrome |
| Bing dictionary / vector search UI | ✅ Works | Same as Chrome |
| Network capture (`chrome_network_capture`) | ✅ Works | webRequest + `filterResponseData` StreamFilter; response bodies included |
| Console capture (`chrome_console_*`) | ⚠️ Degraded | MAIN-world injection; messages logged **before** capture starts are not replayed (CDP replays history; Firefox cannot) |
| Dialog handling (`chrome_handle_dialog`) | ⚠️ Degraded | MAIN-world `alert/confirm/prompt` override; `beforeunload` and pre-injection dialogs not interceptable |
| File upload (`chrome_file_upload`) | ⚠️ Degraded | Reads file bytes through the native host then sets `input.files` via `DataTransfer` (no CDP `DOM.setFileInputFiles` on Firefox); 50 MB cap |
| Performance analyze (`performance_analyze_insight`) | ⚠️ Degraded | Performance Timeline only (navigation/paint/resource timing, longtask if present); no JS heap (`performance.memory` is Chromium-only) |
| Semantic similarity / vector search / content indexing | ⚠️ Degraded | Runs inline in the background event page (no offscreen API); single-threaded wasm (no COOP/COEP cross-origin isolation) = slower; event-page suspension re-inits the model on next use |
| Network debugger (`chrome_network_debugger_start`/`_stop`) | ❌ Unsupported | Uses `chrome.debugger` (CDP). Use `chrome_network_capture` instead |
| Performance trace (`performance_start_trace`/`_stop_trace`) | ❌ Unsupported | Uses CDP tracing |
| Audio (`chrome_audio_start`/`_stop`/`_status`/`_duration`) | ❌ Unsupported | Requires `chrome.tabCapture` + offscreen, neither exists on Firefox |

Unsupported tools return a clear error before execution when built for Firefox.

## Why the gaps exist

Firefox does **not** implement `chrome.debugger` (MDN "Chrome incompatibilities";
[Bugzilla 1316741](https://bugzilla.mozilla.org/show_bug.cgi?id=1316741), open
since 2016, no plans) and removed its experimental CDP endpoint in Firefox 141.
Extension-side CDP is therefore impossible on Firefox, so the CDP-based tools
(network debugger, performance tracing, and the audio pipeline that relies on
`tabCapture` + offscreen) cannot run. The port replaces CDP where Firefox offers
an equivalent (`webRequest` + StreamFilter for network bodies, MAIN-world
injection for console/dialog, native host for file bytes) and gates the rest.

Full parity (trace-style recording, browser-level dialog events, attach-style
debugging) would require driving **WebDriver BiDi** through the native server
(launching Firefox with `--remote-debugging-port` and speaking the BiDi
WebSocket out-of-process). This is the documented forward path and is not yet
implemented.
