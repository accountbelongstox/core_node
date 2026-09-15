# A7A7 Post-175 field scan, enrollment convergence, and transport resets

## Task scope (user, 2026-09-16)

1. 175 script was run by the operator; scan the live host to verify self-healing.
2. UI Relay still shows `machines (0 online)`; a Windows pyservice started from
   latest code still does not join.
3. pyservice parameter design: no argument -> mode 1 (local model); argument 2 ->
   mode 2; the argument must be cached into the user data store by the Python
   side so a bare `pycore` restart (no shell wrapper) reuses the cached mode;
   a shell launch without arguments must pass 1 explicitly to overwrite the cache.
4. All six AI clients report "The coordinator returned no available devices for
   this Pycore group"; functionality still unusable.
5. New BUG: `POST /api/worker/tasks/{type}/accept` fails after ~19.27s with
   `ConnectionResetError(10054)` on the Windows client.
6. New BUG2: Mercure subscriber `Read timed out` against
   `https://api.si.12gm.com/.well-known/mercure`; relay subscriber state flips
   to `offline`.

## Field scan log (incremental, 2026-09-16 ~02:05 CST)

- `ncore-laravel-frankenphp.service` active since 2026-09-15 20:31:45 CST
  (ExecMainStart). FrankenPHP run + `schedule:work` processes alive.
- Live binary `/usr/bin/frankenphp list-modules` contains
  `http.handlers.mercure` (+ health/bolt/local) — A7A6 probe would pass.
- On-disk Caddyfile now carries the `mercure` directive (heartbeat 20s,
  write_timeout 0s, subscriptions) and the `stream_close_delay 5m` block on
  both the localhost HTTPS mercure proxy and every domain route file
  (`routes/12gm.com.caddy` included). Finding A7A6-5b is healed.
- External reachability: `/.well-known/mercure` returns 401 (auth enforced,
  route live), `https://12gm.com/` 200, `https://api.si.12gm.com/api/health`
  200.
- ANOMALY: `schedule:work` log shows the `octane-timer-heartbeat` task stalling
  for 34-51 seconds repeatedly (gaps at 18:01:30->18:02:02, 18:02:05->18:02:56
  UTC). The scheduler loop is being blocked by long-running work roughly once
  per minute. This coincides with the ~19.3s client-side connection resets and
  must be traced (DB lock / cache store / HTTP call inside a scheduled task).

## Root-cause chain for BUG1/BUG2 (field evidence, 2026-09-16 02:10-02:30 CST)

1. Live worker runtime has `max_execution_time = 30`, not the contract's 1200.
   `/api/config/environment` reports `max_execution_time: "30"` while
   `memory_limit: 512M` / `upload_max_filesize: 10G` from the same
   `/etc/frankenphp/php-conf.d/99-core-node.ini` ARE applied. The 1200s value
   is therefore not effective for the FrankenPHP server SAPI; the effective
   floor is the ZTS production template `/etc/php-zts/php.ini:414`
   (`max_execution_time = 30`). Per the official FrankenPHP configuration
   docs (https://frankenphp.dev/docs/config/), the reliable mechanism for
   server-SAPI ini values is the Caddyfile `frankenphp { php_ini ... }`
   directive; the current renderer only writes the scan-dir ini.
2. `EdgeTTSService::__construct` (app/Services/EdgeTTS/EdgeTTSService.php:107-110)
   has a 5%-chance `cleanZeroByteFilesBackground()` call that recursively walks
   the ENTIRE audio tree — measured 196,031 mp3 files / 4.2 GB under
   `/www/wwwroot/laravel_db/static/app_qy_v1/audio`. The scan burns >30s CPU.
3. laravel.log (6.9 GB, live) shows a fatal loop: `Maximum execution time of
   30 seconds exceeded` at `EdgeTTSService.php:683` (the scan loop) and
   `:676`, each immediately followed by a full application boot
   (`OctaneTimerServiceProvider: Bootstrapped`, `Timer started`). `Timer
   started` appears 96,164 times — worker threads restart several times per
   minute. Every restart kills in-flight requests on that thread: remote
   clients see `ConnectionResetError(10054)` after the elapsed time their
   request already spent queued/in-flight (observed ~19.3s), and long-lived
   Mercure SSE subscriptions die (`Read timed out`, relay subscriber
   `state=offline`). This single defect explains BUG1, BUG2 and the flapping
   "machines (0 online)".
4. schedule:work (frankenphp php-cli, `max_execution_time=0`) stays alive but
   its 1s heartbeat is serialized with the timer tasks:
   `app_qy_v1_agent_history_audio_writeback_task` shows last_duration ~38-40s
   every run (58 stale pending markers in
   `/www/wwwroot/laravel_db/writeback/app_qy_v1/agent_history_audio`;
   finalize takes a database `Cache::lock` that can be stranded by a fatally
   killed worker for up to LOCK_SECONDS=300). While the heartbeat is blocked,
   `realtime_outbox_publish_task` (interval 1s) and `relay_maintenance_task`
   (interval 30s) do not run — presence/offline transitions and all Mercure
   event publications stall, feeding the same UI symptoms.
5. `[AppQyV1WordTranslationWriteback] ... provider":"edge","processed":0,
   "failed":1` once per second — an Edge-TTS-bound writeback fails every
   single attempt (edge endpoint unreachable from this host), each attempt
   contributing worker load and log volume to the 6.9 GB laravel.log.

## Relay enrollment state (task 2/4 field check)

- `global_relay_devices`: exactly one device `dfa8d11d-...` (DESKTOP-1L9K06N),
  owner_user_id=1, status=active, credential valid; `last_seen_at` advancing
  within seconds of real time — the Windows pyservice IS enrolled, claimed and
  heartbeating after the 175 convergence. Enrollment table: both enrollments
  `claimed` (Sep 4/5). The A7A6 auto-claim chain works.
- Presence math: `online` = last_seen within `presence_timeout_seconds` (65),
  heartbeat cadence 20s. Any transport stall above ~45s of lost heartbeats
  flips the device offline — exactly what the worker-restart churn produces.
- The six-client "coordinator returned no available devices" banner is the
  `relay.group_empty` translation (lang/en/relay.php), rendered only when the
  owner's roster is empty OR when the (stale) UI bundle misreports a failed
  roster fetch as empty (A7A5 finding 8). With the roster non-empty on the
  server, the remaining client-side precondition is the UI rebuild; the
  server-side precondition is the transport stability fixed above.

## Implementation plan (agreed scope, then code)

F1. FrankenPHP server SAPI ini: add `php_ini max_execution_time <contract>` and
    `php_ini max_input_time <contract>` inside the global `frankenphp {}` block
    of the Caddyfile, rendered byte-identically by all three canonical
    renderers: `fm_caddyfile_render` (shell), `ServerManagerV1FrankenPhpCaddyfileBuilder::render`
    (PHP), `Ensure-FrankenPhpCaddyfile` (PS1). Values come from
    `service_contract.json php_runtime.*` (1200/1200). This follows the official
    FrankenPHP configuration mechanism; the scan-dir ini demonstrably does not
    reach the server SAPI for `max_execution_time` on the apt variant (live
    `/api/config/environment` shows 30 while other keys from the same ini file
    apply). The scan-dir ini render is kept for the CLI shim plane.
F2. EdgeTTS zero-byte cleanup off the request path:
    `EdgeTTSService::__construct` no longer rolls the 5% full-tree scan
    (196k files, >30s CPU, worker-thread fatal + restart churn).
    `cleanZeroByteFilesBackground` becomes a public, time-boxed maintenance
    entry (max files + wall-clock budget) invoked from the existing 60s
    `QueueCenterAudioScanTask` (audio-domain maintenance, CLI schedule process,
    no 30s SAPI limit), preserving the original 5% probability per tick.
F3. pyservice mode persistence (task 3):
    - `pycore/pyutils/common/pyservice_mode.py`: persisted-mode read/write
      helpers under `pyfoundations.app_config_path.get_app_config_dir()`
      (`.core_node/config/pyservice_mode.json`, atomic write).
    - `PyserviceModeService`: resolution order = explicit env
      (`PYCORE_SERVICE_MODE`, persisted on sight) -> persisted cache -> default
      mode 1. `configure()` (explicit argv) persists.
    - `pycore_module_caller.py`: `--service-mode` default becomes None; only an
      explicitly passed value reconfigures (and persists). Bare direct launch
      reuses the cache; shell wrappers already always pass `--service-mode`
      (default 1), so a shell launch without arguments overwrites the cache
      with 1 as required.
F4. NOT changed: `Cache::lock(...)->get()` in the agent-history writeback is a
    single non-blocking acquire in Laravel 13 (verified in vendor), so the ~38s
    writeback durations are attributed to worker-churn contention (stranded
    300s locks, DB pressure during restart storms), not to a blocking lock
    wait. Re-verify durations after F1/F2 converge; no speculative change.
F5. Deployment convergence (not executed here per rules): 175 convergence
    re-renders the Caddyfile; UI at 12gm.com is served by the dev server from
    live source (ncore-nexus-dash, `--serve --dev`), so the A7A5/A7A6 UI fixes
    are already in the served bundle once recompiled by that server.
