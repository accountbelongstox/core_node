# TEST: wordnew desktop app on a Windows PC (Local-Store, audio orchestration)

Target: the Electron desktop shell (`poly_apps/pycore_laravel_wordnew_ui/native/desktop`) built by
`scripts/flavor/build_desktop.py` (flavor platform `desktop`). In the shell `isNativeAppShell()` is true, so the
clip chain is the App chain of `development-guides/WORDNEW_GUIDE.md` 1.1 (stage 1 `device` included); the
Capacitor web shims are backed by the desktop bridge (`window.coreNodeDesktop`): real disk files under
`%APPDATA%\WordNew\app-files\<directory>`, stored files served as `app-file://localhost/<path>` (byte ranges),
the bundle served as `app://localhost/`.

Test account (given by the user for testing): username `test`, password `123456`.

## Build and start

From the repo (Windows):

    .\poly_apps\pycore_laravel_wordnew_ui\scripts\start_build.ps1 -Platform windows -App wordnew -NonInteractive

(`-Platform desktop` is the same; Linux: `scripts/start_build.sh --platform desktop`.) Output:
`artifacts/desktop/wordnew/WordNew-win32-x64/WordNew.exe`. The Electron runtime is `node_modules/electron`
(its binary is fetched by `node_modules/electron/install.js` only when missing).

Debug aids: `CORE_NODE_DESKTOP_DEBUG_PORT=<port>` opens Chrome DevTools Protocol on that port; the page console
and full page loads are appended to `%APPDATA%\WordNew\logs\console.log`;
`CORE_NODE_DESKTOP_SERVER_URL=<vite url>` loads a dev server instead of the bundle.

## Cases and pass criteria

1. Start: the window opens `app://localhost/wordnew#/home`; `window.coreNodeDesktop.platform` is `win32`.
2. Login with the test account: the login dialog closes and the home page shows the user.
3. Local-Store, volumes: Settings > Clear cache (Cache & storage) lists the PC disks (C:, D: ...) with free/total
   space and "All-files access granted".
4. Audio orchestration: the Audio Orchestration tab shows "pycore API · Online"; opening a composition resolves it;
   clips are written as `orch-clips/<resourceId>.mp3` under `%APPDATA%\WordNew\app-files\data`, the index as
   `wfnew-orch/clip_index_v2.json`; the list shows "<n> clips on this device".
5. Clip serving: a stored clip fetched with `Range: bytes=0-99` answers 206 / `Content-Range bytes 0-99/<size>`;
   an `Audio` element on its URL reports a duration.
6. Persistence (R14): after closing and restarting the app the clip count and the composition progress are
   unchanged and no clip is downloaded again.
7. Playback: the composition player (`#/orch-audio/<id>?mode=play`) stays open and plays; the audio requests are
   `app-file://` URLs of the local store.

## Last run (2026-10-05, this PC, Electron 44.5.1)

1. Pass.
2. Pass (user `wispy-disk-1439` shown after login).
3. Pass: C: 40.3 GB free of 250.3 GB, D: 935.5 GB free of 1.9 TB.
4. Pass: "The Adventures of Tom Sawyer" went from "Partly ready 47%" (made on another device) to
   "Partly ready 63%" in about 1 minute; 3,234 clips (58.4 MB) on disk and in the index.
5. Pass: 206, `bytes 0-99/14644`, duration 0.849 s.
6. Pass: 3,234 clips / 58.4 MB / 63% after a restart; file count unchanged.
7. Pass after a fix: the player first bounced back to the list - the web `@capacitor/app` shim turned every
   `popstate` (also a hash route change) into a back button with `canGoBack`, and `CapAppStateCore` then called
   `history.back()` a second time. The shim now reports `canGoBack: false` (the browser has already moved).
   After the fix the player played 4 minutes (0:17 -> 3:59) with 7 clip requests in 10 s, all `app-file://`.
   Note: once, before the navigation log existed, the window was found on Home during playback; it did not
   recur in the 4-minute run with logging.
