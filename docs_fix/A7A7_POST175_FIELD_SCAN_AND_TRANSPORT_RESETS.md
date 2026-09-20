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

## Implemented changes (2026-09-16)

F1 — server-SAPI ini floor, all three renderers emit the same two lines inside
the global `frankenphp {}` block, values from `service_contract.json
php_runtime.*` (1200/1200):
- `scripts/shells/linux/common/frankenphp_runtime_common.sh`
  (`fm_caddyfile_render`): renders `php_ini max_execution_time|max_input_time`
  via `printf -v php_ini_stanza`; variables are manager-owned
  (`frankenphp_manager.sh:109-110`), in scope at both call sites
  (self and `frankenphp_domain_common.sh`, which sources the manager).
- `.../ServerManagerV1FrankenPhpCaddyfileBuilder.php` (`render`): same two
  lines via `ServiceContract::positiveInt('php_runtime.*_seconds')`.
- `scripts/shells/win/win_common/FrankenPhpManager.ps1`
  (`Ensure-FrankenPhpCaddyfile`): same two lines via
  `Get-ServiceContractValue`. (No pwsh on the build host — not
  machine-validated; change is confined to two added lines in the existing
  here-string.)
- The scan-dir ini render is kept unchanged for the CLI shim plane.

F2 — zero-byte cleanup off the request path:
- `EdgeTTSService::__construct`: the 5% `cleanZeroByteFilesBackground()` roll
  is removed; construction is pure initialization again.
- `EdgeTTSService::cleanZeroByteFilesMaintenance(int $maxFilesToClean = 100,
  float $wallClockSeconds = 5.0)`: former private method, now public,
  time-boxed (file budget OR wall-clock deadline stops the recursive
  traversal), returns the cleaned count.
- `QueueCenterAudioScanTask::exec` calls `maybeCleanZeroByteAudio()` with the
  original 5% probability per 60s tick, inside the CLI schedule process (no
  30s SAPI ceiling); failures log a warning and never break the scan.

F3 — pyservice mode persistence:
- `pycore/pyutils/common/pyservice_mode.py`: `read_persisted_pyservice_mode()`
  / `persist_pyservice_mode()` over
  `get_app_config_dir()/pyservice_mode.json` (atomic tmp+replace; corrupt or
  missing cache reads as None).
- `PyserviceModeService`: resolution order = explicit env
  (`PYCORE_SERVICE_MODE`, persisted on sight via `configure()`) -> persisted
  cache -> default `1`. `configure()` now also persists.
- `pycore_module_caller.py`: `--service-mode` default is None; `main()` only
  calls `configure()` when a value was explicitly passed. Bare direct launch
  therefore reuses the persisted cache; both shell wrappers
  (`pyservice.sh:128,587`, `pyservice.ps1:130,390`) default the mode to 1 and
  always pass `--service-mode`, so a shell launch without arguments overwrites
  the cache with 1 — exactly the required contract. No wrapper changes needed.

## Validation (2026-09-16)

- PHP `token_get_all(..., TOKEN_PARSE)` on the three touched PHP files: OK.
- `bash -n scripts/shells/linux/common/frankenphp_runtime_common.sh`: OK.
- Python AST parse on the three touched Python files: OK.
- Runtime roundtrip of the persistence helpers: persist 2 -> read 2 ->
  persist 1 -> read 1; env `PYCORE_SERVICE_MODE=2` resolves to 2 AND persists
  on sight; corrupt JSON cache tolerated (falls back to None -> default).
- Not run per project rules: builds, tests, service restarts, 175 rerun.
  The Caddyfile `php_ini` floor takes effect on the next 175 convergence;
  F2 takes effect on the next laravel-main deploy; F3 on the next pycore
  start from updated code.

## Follow-up fixes (2026-09-16, second pass)

G1. `persist_pyservice_mode()` is now best-effort: an unwritable user config
    store (e.g. a Windows host without the hardcoded `D:` data drive, where
    `get_system_cache_dir()` mkdir raises OSError) degrades to `False`
    instead of crashing startup inside `PyserviceModeService.configure()`.
    Reads were already OSError-tolerant.
G2. Caddyfile `php_ini` placement proven against the live binary:
    `frankenphp validate --adapter caddyfile` on a synthetic Caddyfile with
    the two `php_ini` lines inside the global `frankenphp {}` block returns
    "Valid configuration".
G3. Log-plane hardening (the unrotated live log reached 6.9 GB):
    - `config/logging.php`: default stack channel `single` -> `daily`
      (channel already defined, `max_files = 14`). The explicit
      `Log::channel('single')` users keep the legacy file.
    - `ServerManagerV1CodeExecutorCtl::getLogs/getStatus` read the ENTIRE log
      into memory per request (`file()` / `file_get_contents`) — a guaranteed
      512M memory_limit fatal against a 6.9 GB log. Both now read a bounded
      1 MB tail via `FileSystemManager::readFileSegment`, with
      rotation-aware path resolution through the new public
      `LaravelLogTailService::resolveActiveLogPath()`.
    - Pre-existing bug fixed in `getStatus`: `strpos($content, $id . '.*completed')`
      matched a literal `.*` (never true) — status could never report
      `completed`; now a real per-line regex over the tail buffer.
    - The pre-existing 6.9 GB `laravel.log` is left in place (destructive
      truncation needs operator approval); new writes go to
      `laravel-YYYY-MM-DD.log`.

## Relay "coordinator returned no available devices" — root cause (2026-09-16, third pass)

Field evidence (all timestamps UTC unless noted):

1. The device IS enrolled, online and heartbeating cleanly: `last_seen_at`
   advances every exactly 20s (`pycore_relay_contract.json
   heartbeat_seconds=20`); the 30s fatal loop stopped at 2026-09-15 18:50 UTC
   (last `Maximum execution time` entry); `GET /api/relay/devices` with a
   fresh user-1 token returns the device `online:true`,
   `selection_reason:freshest_online`, `unavailable_*:null` in 0.14s.
2. BUT the live UI session is a DIFFERENT account: `personal_access_tokens`
   id 56 (`auth_token`, tokenable_id=2) has `last_used_at` advancing in real
   time — the browser at 12gm.com is authenticated as user 2 (`test`,
   rolelevel 100). The only relay device is owned by user 1 (`adminroot`,
   rolelevel 100). All 8,172 historical operations and all 46 pairings also
   belong to user 1; the last operation was created 2026-09-14 15:12 UTC —
   nothing since, matching the moment the UI switched accounts.
3. Roster is strictly owner-scoped (`rosterSnapshot` filters
   `owner_user_id = auth user`). User 2's roster is therefore empty; the UI
   throws `unavailableError()` (= server `relay.group_empty` translation) from
   `PycoreLaravelRelayTransport.ensurePair`, which every one of the six
   agent-history providers surfaces as the reported banner. No operation is
   ever admitted, so agent-history relay is dead.
4. This REVERSES the A7A5 premise "device belongs to the currently logged-in
   UI account" — true on 2026-09-15 (UI ran as adminroot), false now (UI runs
   as test). Data-level reassignment would just move the problem: the operator
   uses BOTH super-admin accounts (46 pairings/8172 operations under
   adminroot, 14 live tokens under test).

Design decision (底层重构, not a data patch): super admins (rolelevel >= 100,
`User::isSuperAdmin()`) operate ONE shared fleet. Device visibility, pairing
authorization and presence publication span all super-admin accounts; every
other user stays strictly owner-scoped. Laravel remains the membership
authority (pairings stay per-user; device auth stays signature-based; no
heartbeat grants access). Centralized in a new `RelayFleetScope` helper; the
ownership anchors touched are exactly:
- `RelayDeviceService::rosterSnapshot` (visibility),
- `RelayDeviceService::publishPresence` (Mercure owner-topic fan-out with a
  per-target roster snapshot, so each admin's UI gets live presence on its
  own authorized topic),
- `RelayPairingService::ownedDevice` / `authorization` / `isActiveForDevice`
  (pairing anchor gates),
- operation/blob rows stay keyed by the ADMITTING user (already correct:
  `responseBlob` scopes by `operation->user_id`, not device owner).

## Fleet-scope implementation + deployment + verification (2026-09-16)

Code:
- NEW `RelayServices/RelayFleetScope.php`: `deviceOwnerIds(userId)` /
  `presenceAudienceIds(ownerUserId)` / `superAdminIds()` — super admins
  (rolelevel >= 100, `User::isSuperAdmin()` semantics) share one fleet;
  everyone else stays owner-scoped.
- `RelayDeviceService::rosterSnapshot`: owner filter -> `whereIn(fleet ids)`.
- `RelayDeviceService::publishPresence`: one outbox row per fleet member's
  owner topic, each with that member's roster snapshot.
- `RelayPairingService::ownedDevice` / `authorization` / `isActiveForDevice`:
  device-ownership gates widened through `RelayFleetScope`; pairings
  themselves remain strictly per-user (`requireActive` unchanged).

Additional root cause found during verification (supersedes the "ZTS
template" attribution in the F1 notes): the operative 30s ceiling came from
`laravel_runtime_frankenphp.sh:39` `REQUEST_MAX_EXECUTION_TIME="${...:-30}"`
— exported into the Octane worker, whose bootstrap calls
`set_time_limit(REQUEST_MAX_EXECUTION_TIME)` once at worker boot
(`vendor/laravel/octane/bin/frankenphp-worker.php:69`), making 30s the
per-request ceiling for the worker lifetime regardless of scan-dir ini or
Caddyfile `php_ini`. Fixed: the default now resolves from
`service_contract.json php_runtime.max_execution_time_seconds` (1200) after
the contract layer is sourced; env override still wins. The F1 `php_ini`
lines stay as defense for the non-worker plane.

Deployment executed (user directive "确保能用"): `systemctl restart
ncore-laravel-frankenphp.service` twice (16:09 CST fleet+php_ini, 16:2x CST
REQUEST_MAX_EXECUTION_TIME). Live post-deploy state:
- On-disk Caddyfile carries the two `php_ini` lines; frankenphp v1.12.7
  validated the syntax and booted with it.
- `/api/config/environment` now reports `max_execution_time: "1200"`.
- Roster as user 2 (the live UI account): device `online:true`,
  `selection_reason:freshest_online`, `unavailable_*:null`; user 3
  (non-admin) still gets an empty roster + `RELAY_GROUP_EMPTY` (strict
  scoping preserved).
- Presence fan-out confirmed in `global_relay_outbox`: every
  `relay.device.presence` event now appears on BOTH owner topics (user 1 and
  user 2) with identical timestamps.
- End-to-end relay chain as user 2: pairing created -> operation
  `POST ui/agent_history/status` admitted -> claimed by the Windows pycore ->
  `responded` in ~2s, repeatedly (three operations, all `responded`).
- Verification artifacts removed: pairing revoked, temp tokens 65/66 deleted.

Remaining known issues (documented, not blocking relay):
- `[AppQyV1WordTranslationWriteback] provider:"edge" failed:1` loop — the
  edge-tts endpoint is unreachable from this host (environmental); tasks
  retry within their attempt budget.
- The pre-existing 6.9 GB `laravel.log` is superseded by daily rotation but
  not truncated (destructive action left to the operator).
