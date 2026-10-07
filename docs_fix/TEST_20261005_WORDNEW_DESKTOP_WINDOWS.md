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

## Edit -> preview speed (2026-10-05, this PC)

Composition: a copy of "The Adventures of Tom Sawyer" named `Tom Sawyer (speed test)` (6,974 clips, ~4,700 on
the device; test account). Timed through CDP from the save of the edit.

Changes measured here: the composer publishes a preview timeline as soon as the first chain stage (the device
store) has answered (`onSourceDone` in `resolveOrchClips`, `composeTimelines` in `orchComposer.ts`); an edition
of another plan (an edit) is offered for replacement as soon as the new plan's preview exists - see the R16 run
below (the first version replaced it without asking); an edit of the word group / read state keeps the kept sentences and asks
only read counts (`include_media: false`, 400 words per request) for words whose meaning and audio are known
(`WordNewOrchSources`, `getSentenceWordTable`).

| Edit | Before | After |
|---|---|---|
| Pattern (first step x1 <-> x2) | preview never changed (offer after 6.7-11.8 s run) | preview of the new plan at 1.6 s (UI: 2.1 s) |
| Read state (real <-> virtual) | inputs 9.9 s (12 x 300-word lookups, ~2.7 s each), offer after ~19 s | inputs 0.75 s (9 count-only requests, ~0.2 s), preview at 2.5 s |

The rest of the chain (pycore / Laravel transfers and generation requests for the ~2,200 missing clips) still
runs after the preview (10-12 s here); clips it adds come as the usual "new resources are ready" offer.
Raising the word-state concurrency from 3 to 6 did not help (the server serializes the requests: 4-6 s each).
The preview of the edited plan played (0:00 -> 0:09 in 6 s).

## Edit = re-plan, downloads never stop (R16, 2026-10-05, this PC)

Requirements: (1) an edited composition is offered for replacement (the playing edition is never swapped without
the reader's answer); (2) re-ordering steps (en/zh -> zh/en etc.) gives the new preview and the formal reading
fast; (3) an edit never stops the background download (the download set may change). Rule R16 in
`development-guides/WORDNEW_GUIDE.md`; drill re-run: violations=0.

| Case (test copy, 6,974 clips, ~4,900 on the device) | Result |
|---|---|
| Reorder sentence_en <-> sentence_zh while a run was transferring | new preview 1.5-1.6 s, offer "re-arranged" at the same time; old run not aborted (`superseded`), kept delivering |
| Same reorder with no run going (normal reading) | new plan's preview timelines 0.19-0.28 s after the save (was 2-9.5 s: the device pass waited for the book-plan request) |
| Word-meaning toggle while transferring (download set 6,974 -> 4,420) | offer at 0.11 s; the new run asked only the device store (all other clips owned by the background run); after the background run ended the follow-up run finished the 30 queued clips (2 from pycore, 27 flagged generating) |
| UI: reorder while the edition was playing | banner "The composition was re-arranged: 8274 clips, 470:39 - replace what is playing?" after 0.14 s; the old edition kept playing; Replace continued at the same clip in the new order (0:03 -> 0:07 / 470:39) |

Observation (not caused by edits): Chromium reports some Laravel `audio/bundle` requests as `canceled` in every run
(9-11 per run with no edit and no `AbortController.abort()` call at all); the edit runs showed the same.

## Run 2026-10-08 (this PC, rebuilt bundle; GPU pycore on this PC + Colab T4 node)

Cases 1-7 pass (6: 25,399 clips before and after a restart, nothing downloaded again; 7: a passage composition
plays, clips from `app-file://.../orch-clips`).

Fixed during the run:
- This PC's clock is ~593 s fast (Windows Time stopped); every client-key-signed call got 401
  `client_key_timestamp_invalid`, so the GPU pycore never registered or leased ("no pycore node online").
  The signers (pycore `client_key_auth.py` + `laravel/client.py`, ncore `client_key_auth.js`) now learn the
  server clock per origin from the `Date` header and re-sign once; loopback / LAN peers keep the local clock.
  After the fix: registered at once, leases claimed, roster `DESKTOP-1L-gpu-31a9`.
- A refused worker register was retried on every tick (~2/s per worker); now every 10 s.
- `colab_cli logs` on a freshly opened notebook tab read the model before it loaded.
- Agent-history articles lost every Chinese punctuation mark (`sanitize_fragment_text`), so `reference_cn` had
  no sentence boundaries (one clip per article, no en/zh pairing for passages). New articles keep it.
- R8 with cursors (drill S12): a resumed run inside the cursor window left the still-missing clips `queued`
  without a generation watch.

Short passages: a composition of 1 prompt + 2 articles (source `passages`, 3 segments, 221 clips) resolved
to 221/221 (143 device, 78 pycore after GPU generation), synced to Laravel (`synced: true`). Existing articles
have no Chinese punctuation, so their reference follows as one Chinese-only sentence each.

Generation / storage: NIV-Bible led by the app (R12): transfer over LAN (`192.168.1.151:59000`, up to 2.7 MB/s),
qwen3tts on the RTX 4060 (GPU 100 %), sentence and phrase clips reported to Laravel with no dead letters;
Colab node `colab-45ffdb` (gpu) took plan windows and its clips reached the device through Laravel.
Observations: bundles took 13-85 s per 256 clips while the GPU was saturated; Next / Previous in the player
switch the segment and stop playback; the Colab notebook tab hung once (flooded output), and the extension
then timed out on it (runtime unaffected).
