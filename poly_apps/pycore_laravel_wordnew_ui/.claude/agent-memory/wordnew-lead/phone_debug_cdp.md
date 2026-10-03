---
name: phone-debug-cdp
description: How to inspect live wordnew app state on the phone (adb forward + CDP, import Vite module instances) and gotchas
metadata:
  type: reference
---

- After an app restart re-forward CDP: `adb forward tcp:13056 localabstract:webview_devtools_remote_<pid>`; Node 24 has a global `WebSocket` (no `ws` package needed).
- Read live service state with `Runtime.evaluate` + `import('/apps/wordnew/services/orchestration/WordNewBookAudioPlan.ts?t=<ts>')`; `<ts>` must match the `?t=` in the importer (curl the Vite-served WordNewOrchComposer.ts and grep it) or you get a second module instance with empty state.
- A blank black app with unresponsive CDP means the renderer main thread is blocked (not JS-interruptible); force-stop + relaunch fixes it.
- `laravel_signed_cli.js request GET /api/work/nodes` needs a query string (`?online=0`) or it prints "fetch failed"; `online=1` hides the pool.
- Other people use phone Chrome; wordnew may be backgrounded and then shows no CPU.
- Reading SSH secrets (SSH_CONNECTION_1) via secret_crypto.js is blocked by the auto-mode classifier; do not retry.
