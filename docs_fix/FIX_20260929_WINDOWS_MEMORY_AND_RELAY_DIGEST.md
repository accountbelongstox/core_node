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

Windows result (2026-09-29, after restart):
- Step 1 passed: no `contract_digest_conflict`; relay `mercure-authorization` -> 200. Part B confirmed.
- Sentence lane synthesizes and queues deliveries normally (`sent_fail=0`).
- Step 2 not yet run: `http://127.0.0.1:9000` refuses connections (local Laravel down), so rows pinned to the local
  server namespace (`server:acef73…`) stay deferred until Step 175 starts it.
- New blocker -> Part E.

## Part E — `client_key_missing` (401) on api.si.12gm.com (TODO on Linux, laravel_main)

Symptom (device log), on every signed machine route (`/api/worker/register`, `/api/queue-center/overview`,
`/api/app_qy_v1/delivery/info`, queue diff):
```
-> 401 error=A client-key signature is required, or the shared client key is not installed on this server.
```
Effect: worker registration and queue diff fail; lanes fall back to the local mirror; deliveries cannot complete.

Windows findings:
- pycore signs every Laravel request (`pycore/pyutils/laravel/client.py` -> `client_key_headers`).
- Device signing key `CORE_NODE_CLIENT_KEY_1` is present and valid; `key_id = 4618f97b272481f6` (non-secret:
  first 16 hex of sha256(key)).
- The server answers `client_key_missing`, not `client_key_unknown`: in `ClientKeyAuthService::verify()` that means
  `keys()` loaded **no** key (a wrong key would be `client_key_unknown`). Server-side secret store issue.
- `global_var_store.sh` masking from Part C is display-only (`echo` branch); not the cause.

Linux steps:
1. `grep -rn "\[ClientKey\] Shared client key is missing" storage/logs | tail` (confirms empty key set).
2. Check `<core_node>/.secret_keys/.secret_ignore/CORE_NODE_CLIENT_KEY_1` (`SecretStore::SECRET_DIRECTORY`):
   exists, non-empty, readable by the FrankenPHP worker user (`ls -l`; `sudo -u <worker user> test -r …`). Never print it.
3. Compare key id without printing the key:
   `php artisan tinker --execute="\$k = App\Services\ClientKey\ClientKeyAuthService::decodeKey(App\Utils\SecretStore::get('CORE_NODE_CLIENT_KEY_1')); echo \$k === null ? 'MISSING' : App\Services\ClientKey\ClientKeyAuthService::keyId(\$k);"`
   -> must print `4618f97b272481f6`. Empty -> missing/short key; different id -> keys differ between device and server.
4. Missing/unreadable -> run the dd.sh `[SECRETS] ensure_secret_keys_ready` decrypt step, fix ownership/permissions,
   then restart workers (`POST localhost:2019/frankenphp/workers/restart`). `keys()` caches 60 s per worker.
5. Also verify `PathMapper::getCoreNodeDir()` inside the worker resolves to the same core_node root (worker restart in
   Part B may run with a different env/cwd).
6. Verify: device log shows `/api/worker/register` 2xx and no `client_key_missing`.

Linux finding (VM-0-2-debian): `.secret_ignore/CORE_NODE_CLIENT_KEY_1` absent; only
`already_encrypted/CORE_NODE_CLIENT_KEY_1.js` (synced 2026-09-29 18:45) exists -> never decrypted. Decryption needs the
operator password (dd.sh `[SECRETS]` decrypt prompt, or `secret_password_runner.js … --password-stdin`), then worker restart.
Decrypt attempt 19:33: all 11 decrypted files from commit `win0.0.1` (incl. CORE_NODE_CLIENT_KEY_1) are 1024-byte decoys
(template writes random data on a wrong password and still exits 0) -> password differs from the one used on Windows.
Re-decrypt those with the Windows password and `--force`; then tinker key id must be `4618f97b272481f6`.
Shared client-key ensure (both ends, idempotent: valid -> key id; decoy -> removed; encrypted only -> password prompt +
decrypt `--force`; nothing -> generate): Linux `scripts/shells/linux/common/client_key_common.sh` (`client_key_ensure_ready`)
used by dd.sh (`secret_functions.sh`), `175_laravel_main_start.sh`, `pyservice_entry.sh`; Windows `SecretManager.ps1`
(`Initialize-ClientKeyReady`, `Remove-InvalidClientKeySecret`) used by `SecretDecryptionCheck.ps1` and `pyservice.ps1`.
Server decoy CORE_NODE_CLIENT_KEY_1 removed; awaiting interactive decrypt with the Windows password.
Batch secret crypto: `scripts/encryption_tools/secret_crypto.js` (decrypt/encrypt/verify any number of files, one
password, one process, parallel KDF; wrong password writes nothing). disguise.js / batch_decrypt.js wrap it. Callers:
Linux `secret_crypto_batch` (secret_tool_common.sh), Windows `Invoke-SecretCryptoBatch` (GlobalVarStoreCommon.ps1),
pycore `pyfoundations/secret_crypto_batch.py`. Client key: encrypt sites print a sync notice; a wrong-password decrypt
offers regenerate + immediate encrypt (Linux tested; Windows static review only, run under pwsh before relying on it).
