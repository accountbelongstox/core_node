---
name: wordnew-phone-debug-pitfalls
description: Live-reload phone debugging on the dev handset - how to start Vite alone, drive/measure the app over CDP, and what caused the 2026-10-03 CPU/ANR problems
metadata:
  type: project
---

Start only the live-reload Vite (no APK build): in scripts/flavor import `ensure_live_server` from live_debug.py and call it with root, `{"id":"wordnew"}`, bun path from `build_apk.executable("bun")`, env with VITE_APP_FLAVOR=wordnew + VITE_BUILD_TARGET=native. `live_debug.py attach` never starts Vite.

The dev phone is shared with the user (Chrome terminal panels in front, they touch it). Every `monkey` launch recreates the activity (WebView reloads to #/home, heavy dev-mode startup), and a user touch during that window gives an ANR kill ("Input dispatching timed out"). Launch once, then drive via CDP (`adb forward` to webview_devtools_remote_<pid>, collector re-forwards on pid change); a hidden WebView does not run timers, so CDP awaits hang until the app is foreground. Use `Input.dispatchMouseEvent` for real user-gesture clicks (audio play needs one).

Measuring: `adb exec-out run-as com.corenode.wordnew cat files/wfnew-orch/progress.json` (stage counts/cursors) and tasks.json are readable without the UI. `top -H` per thread separates app main (~15%), renderer main, compositor.

**Why:** 2026-10-03 findings - the NIV-Bible preview stage rendered every card (31k lines, 94k DOM nodes, 1.5 GB renderer, 100%+ CPU, ANR kills); fixed by windowed OrchStage (about 600 nodes). Capacitor verbose plugin logging (full payloads, MBs/s) also saturated the main thread; capacitor.config now has loggingBehavior "none" (flavor_build.py), so native current.log has no Capacitor lines, only WebView console via the Vite bridge.

**How to apply:** do not read "ready == device" as stuck: when every server-ready id is on the device the run ends in phase ready with only device + generate:pycore stages and no transfer stage; remaining clips wait on node generation.
