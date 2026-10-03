---
name: wordnew-device-test-playbook
description: How the wordnew app was built, installed and driven on the XREAL test phone on 2026-10-03 (release APK signing, CDP module access, background/dev-build CPU traps)
metadata:
  type: project
---

Release APK without signing env is unsigned (`INSTALL_PARSE_FAILED_NO_CERTIFICATES`): build with `CORE_NODE_ANDROID_DEBUGGABLE=1` (build_app.ps1 -Apk -App wordnew -BuildType release -NonInteractive -NoOpenOutput); it is then debug-signed and WebView-debuggable, and keeps app data over live-reload debug installs (same key).

Live-reload build: `python scripts/flavor/build_apk.py --root . --app wordnew --build-type debug --live-reload --non-interactive --clean no --open no`, then `adb -s <dev> reverse tcp:13055 tcp:13055` (it writes server.url into capacitor.config.json; a later release build rewrites it back). On a live build, CDP `import('/apps/...ts')` reaches the app modules, BUT Vite appends `?t=<ms>` to HMR-updated imports: fetch the importer's source and import the store with the same `?t=` or you get a second, empty instance (an updater test returned "checked 0" because of this).

A hidden/backgrounded WebView hangs CDP `Runtime.evaluate` (profiler/heap calls still answer); bring the activity to front with `am start -n com.corenode.wordnew/.MainActivity` first. The user also uses the phone (Chrome, Tailscale VPN toggles): expect foreground changes.

The live-reload (Vite dev) build burns 120% renderer CPU and 0.8-1.4 GB while backgrounded with orchestration running (JS idle, thread-pool work); the release build stays at 40-50% / 350 MB. Judge CPU/ANR on the release build only.

**Why:** these cost most of the 2026-10-03 session; the app needs a logged-in user for orchestration (no credentials are available to agents: wait for the user to log in, never register).

**How to apply:** use `scripts` in the session scratchpad idea: node WebSocket CDP helper + `run-as com.corenode.wordnew cat files/wfnew-orch/progress.json` for counts; `ls files/orch-clips | wc -l` for clip files.
