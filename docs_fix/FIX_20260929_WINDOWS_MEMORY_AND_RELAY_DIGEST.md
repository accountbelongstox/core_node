# FIX 2026-09-29 — Windows memory exhaustion + Relay contract digest conflict

## Part A — Windows pycore memory exhaustion (DONE on Windows)

Symptoms: `WinError 1455 paging file too small`, `MemoryError`, `qwen3tts masked by memory gate`,
`No TTS engine available`, `sent_fail=8948`, SQLite `disk I/O error`, `/status` -> `Serialized operation failed`,
TLS handshake/read timeouts to Laravel (starved process). Page file peaked at 25.5 GB over 15 GB RAM.

Changes:
- `pycore/pyctl/tts/laravel_audio_worker.py`: `_await_engine_memory()` runs before every pop (serial, parallel and
  word-batch drains). While the lane's pinned engine (word batch engine / required engine) fails the memory gate, the
  lane pauses with 5–60 s backoff instead of popping and failing tasks (the retry storm). `get_status()` reads outbox
  stats through `_delivery_outbox_stats()`, which degrades to `{"error": ...}`.
- `pycore/pyutils/tts/memory_gate.py`: `free_commit_bytes()` (Windows `GlobalMemoryStatusEx.ullAvailPageFile`);
  the gate also masks an engine when commit headroom < its RAM need (WinError 1455 case). No-op on Linux.
- `pycore/pyutils/laravel/delivery_outbox.py`: reconcile streams the inventory in pages of
  `RECONCILE_INVENTORY_PAGE = 10000` (`_reconcile_page`) instead of holding every item + record in memory per server.
  Laravel diff is stateless per request, so paging is wire-compatible.
- `pycore/pyfoundations/serialized_worker.py`: empty-message errors (e.g. `MemoryError`) surface as
  `Serialized operation failed (MemoryError)`.

Verify on Windows: restart pycore; under pressure the log shows `lane paused: ...` then `host memory recovered`;
page-file peak (`Win32_PageFileUsage.PeakUsage`) stays bounded.

## Part B — Relay `contract_digest_conflict` (409) (DONE on Linux, laravel_main)

Symptom (device log):
```
POST /api/relay/device/heartbeat -> 409 error_code=contract_digest_conflict
local_contract_digest=498009255be2c7ae203aa4bc6135465a37dcf9d1fa376bbad928f0eee9b7eb93
```

Windows findings:
- Device digest = sha256 of LF-normalized `config/pycore_relay_contract.json` = `498009…eb93`, equal to `HEAD` and
  `origin/main` (commit `be1d23778`). The device side is correct; no pycore change needed.
- Both sides hash identically (pycore `relay_contract.py` `normalize_eol`; Laravel
  `RelayContract::canonicalContractBytes`). The conflict is therefore a server-side content/staleness difference.
- Laravel runs under Octane (`laravel/octane`). `RelayContract::load()` caches `$document`/`$digest` in static
  properties and returns early once set, so a long-lived Octane worker keeps the old digest after a deploy.

Linux steps:
1. On the server checkout, compute the served file's digest:
   `python3 -c "import hashlib;b=open('config/pycore_relay_contract.json','rb').read();print(hashlib.sha256(b.replace(b'\r\n',b'\n')).hexdigest())"`
   and check `git status` / `git log -1` against `origin/main`.
2. Read `storage/logs` for `[Relay] Contract digest rejected` -> `expected_digest`.
   - `expected_digest` ≠ file digest -> stale Octane worker: `php artisan octane:reload`.
   - file digest ≠ `498009…` -> pull/deploy the current contract file, then `php artisan octane:reload`.
3. Durable fix in `poly_apps/laravel_main/app/Apps/Relay/RelayServices/RelayContract.php`: make `load()` reload when
   the contract file changes (compare `filemtime` + `filesize` after `clearstatcache(true, $path)` with the values
   cached alongside `$document`), so Octane workers never serve a stale digest. Follow
   `development-guides/LARAVEL_GUIDE.md`.
4. Verify on the server: heartbeat returns 2xx and the device log no longer shows `control.http.conflict.skipped`.

Linux result (2026-09-29):
- Server file digest = `498009…eb93` (matches device). FrankenPHP worker mode had been up since 05:33 holding the old
  static digest -> confirmed stale-worker cause.
- `RelayContract::load()` now caches `filemtime:filesize` as `$fileSignature` and reloads when it changes.
- Workers restarted (`POST localhost:2019/frankenphp/workers/restart`); `RelayContract::digest()` = `498009…eb93`.

## Part C — Step 175 idempotent run (DONE on Linux)

Ran `scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh` three times (exit 0 each). Fixed:

| Issue (run 1) | Fix | Run 2+ |
|---|---|---|
| `DNSPOD_API_TOKEN` value printed in cleartext | `global_var_store.sh` `set_global_var` masks keys matching TOKEN/PASSWORD/SECRET/PASSWD/`*_KEY`/APIKEY/CREDENTIAL | masked |
| `/opt has less than 50GB free` printed ~17x | `gvar_storage_common.sh`: once per top-level run via exported `CN_OPT_SPACE_WARN_MARK` marker file | 1x |
| PostgreSQL `collation version mismatch` (glibc 2.39 -> 2.41) on every DB | `75_install_postgresql.sh` `pg_refresh_collation_versions`: drifted DBs only -> `REINDEX DATABASE` + `ALTER DATABASE … REFRESH COLLATION VERSION` (NULL-version `template0` skipped) | all DBs 2.41, no-op |

Not changed:
- `running_with_errors` on `app_qy_v1_agent_history_audio_writeback_task` / `global_task_result_writeback_task`: lifetime
  `error_count` (12 of 115k/591k runs) from a PostgreSQL shutdown window; no current fault.
- `Removed stale route: local_lan` was a one-time cleanup (server mode); absent on later runs.

## Part D — Windows test (TODO on Windows)

1. `git pull`, restart pyservice; within ~30s the pycore log must show heartbeat 2xx and no
   `contract_digest_conflict` / `control.http.conflict.skipped`.
2. Run `scripts/shells/win/install_powershells/Step175_LaravelMainStart.ps1` twice; second run must make no changes
   and print no secret values. (Collation drift is glibc-only; Windows PostgreSQL is unaffected.)
3. Confirm Part A memory fixes after restart.
