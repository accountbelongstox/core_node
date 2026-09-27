# ncore report — client key auth and audit fixes (2026-09-27)

Role: ncore. Scope: `ncore/`, `apps/` except `apps/mcp-chrome/`, `main.js`, `ncore_module_caller.js`, `public/`.
Task tools are not available; task ids are `ncore-<n>` (reviews in `.claude/agents_shared/reviews/ncore-<n>.json`).

## Tasks

| Id | Subject | Findings | Status |
|---|---|---|---|
| ncore-1 | [ncore] K3 signer/verifier + K7 local RPC guard on every ncore server | NC-001, NC-005, NC-007, NC-013, NC-020, NC-028; new NC-038, NC-039 | approved (follow-ups done: backend reuses pycore guard, secret name check) |
| ncore-2 | [ncore] secrets from the shared store, no runtime source rewrite | NC-002, NC-024, NC-033 | approved |
| ncore-3 | [ncore] exec layer (one commander contract) | NC-003, NC-004, NC-012, NC-017, NC-018, NC-019, NC-029, NC-031, NC-032 | approved (follow-up done: array commands run as argv) |
| ncore-4 | [ncore] HTTP stack and lifecycle | NC-006, NC-009, NC-010 (= PR-025), NC-014, NC-025, NC-027, NC-037 (HTTP stack part) | approved |
| ncore-5 | [ncore] platform, data and protocol fixes | NC-008 (extension side), NC-011, NC-015, NC-016, NC-021, NC-022, NC-023, NC-026, NC-030, NC-037 (dingdoudou) | approved (NC-008 server half: laravel + orchestrator) |
| ncore-6 | [ncore] rules: duplicates, layering, throw sweep | NC-034 (HTTP stack copy deferred: guide conflict), NC-035, NC-036 (remainders counted); new NC-040, NC-041 | approved (example nit fixed after approval) |
| ncore-7 | [ncore] config/index.js secrets migration and twins, K7 403 alignment, NC-008 key pickup | NC-002/NC-024 (config/index.js), NC-011/NC-026 twins in config/index.js, K7 (B9 ruling), NC-008 | approved (after the K7 DNS-rebinding fix) |

## Shared modules (for other roles)

- K3: `ncore/foundation/common/client_key_auth.js` — `signRequest`, `verifyRequest`, `verifyRequestHeaders` + `verifyBodyDigest`, `canonicalPath`, `canonicalRawQuery`, `canonicalQuery`, `contentSha256`, `getMachineId(client)`. Reads every value from `config/service_contract.json#client_key_auth` and `pycore_relay_contract.json#signature_profile.canonicalization`; key via `secret_manager.readRawSecret` (value never logged). Reproduces `test_vectors.json` (key id, canonical strings, 3 signatures).
- K7: `ncore/foundation/common/local_rpc_guard.js` — `resolveBindHost`, `authorizeRequest`, `createExpressGuard` + `captureRawBody` + `createExpressBodyDigestCheck`, `createFastifyGuard`, `createWsVerifyClient`; options `allowedOrigins`, `allowLoopbackOrigins`, `credentials`.
- mcp-chrome was sent the path and API (plus `contentSha256` and `allowLoopbackOrigins` additions).

## ncore-1 details

- NC-001 fixed: `ncore/callmodule` binds the contract loopback by default (`global_config`, `launcher`, `linux_service`, `windows_tray`, `ncore_module_caller.js`); `cors('*')` replaced by the K7 guard; `/api/call` accepts only exact `{ module, function }` pairs from `allowedCalls` (default empty, set via `initGlobalConfig({ allowedCalls })`); absolute and escaping module paths are rejected.
- NC-005 fixed: shared stack default host = contract loopback (`rpc_constants`, `rpc_config`, `ExpressServer`); `expressProvider` runs the K7 guard first, reflects only allowed origins (config `ALLOWED_ORIGINS`, `CORS_CREDENTIALS`), checks the signed body digest; WS upgrades use `verifyClient`; `/rpc/query/:id` results are bound to the requesting client id (`ResponseCache` owner). Loopback defaults also for launcher/thread-pool/matrix callers; VoiceClientAndCaddy binds `any` only when `isServer`.
- NC-013 fixed: `SessionManager` cleanup interval (unref), session cap, client ids validated (`normalizeClientId`); WS close reads the entry before deleting and ignores superseded sockets.
- NC-007 fixed: WebLocalAreaNetwork serves and accepts uploads only under `<ROOT_APP_STATIC_DIR>/share` (`SHARE_DIR`), loopback bind, containment by `pathtool.resolveInside` (realpath + `path.relative`), upload file names reduced to basename, dir picker contained.
- NC-020 fixed: jsmcptools MCP server: `@fastify/cors '*'` replaced by the fastify guard (Host check, loopback origins, extension origin from `service_contract.json#mcp_chrome.extension_id` once the orchestrator adds it).
- NC-028 fixed: translation service listens on the contract loopback with the K7 guard.
- Also: `ncore/ncore_backend_main.py` (FastAPI, 58000) binds loopback via pycore `resolve_bind_host`, CORS uses pycore `allowed_origins`, and the K7 gate is pycore's `LocalRpcGuardMiddleware` (no Python copy in ncore); ai_translator web server no longer sets `ACAO: *`.
- NC-038 (new, fixed): extensionless `#@` imports throw `MODULE_NOT_FOUND` (Node package imports do no extension/index lookup). This broke `createApp()` on 58000 (`#@ncore/utils/jsmcptools`), WebLocalAreaNetwork and VoiceClientAndCaddy at load, heartbeat/thread-pool task queue, mail/strapi/ai/stream translator configs. Fixed in 24 files. Remaining unresolvable targets that do not exist at all (dead): `#@base`, `#@baseTool`, `#@/ncore/basic/libs/*`, `#@ncore/utils/http_rpc`, `#@ncore/utils/ws_rpc`, `#@ncore/utils/puppeteer-browser/index.js`, `#@apps/okx_price_monitor/main.js`.
- NC-039 (new, fixed): `rpc.getExpressServer()` does not exist; Voice `dict_server.js`, `sync_audio.js` and WLAN `update.js` crashed at load. They now require `UploadTools` directly.
- Voice client → Voice server calls (`submit_audio`, `submit_audio_simple`, `get_row_word`) are K3-signed (the server is LAN-exposed on `isServer`).
- Laravel `client.key` routes: the published route table lists no ncore/apps caller; nothing to switch. Voice `server_init_words.js` calls the legacy `/api/dict/v1/*` (not in laravel_main); it keeps `Client-Token`, now read from the store.

## ncore-2 details

- NC-002 fixed: the hardcoded scrypt master key and `encryptValue` are removed from `config_tool.js`. Config values `SECRET:<NAME>` resolve from the shared store (`secret_manager.readRawSecret`); legacy `ENC:` values resolve to `null` with an error naming the key. Secret-like keys (`*_pwd|_password|_key|_token|_secret`) and store references stay in process memory and are no longer written to the shared `global_var` directory.
- NC-024 fixed: `importConfigFromJs` never writes the tracked config file.
- NC-033 fixed: OCR.space and Unsplash keys come from the store (`OCRSPACE_API_KEY_1..5`, `UNSPLASH_ACCESS_KEY_1..5` via pycore `get_secret_key_indexed`); the three OCR copies and both Unsplash copies are gone.
- ncore/apps `ENC:` and plaintext secrets replaced by store references: `apps/VoiceClientAndCaddy/config/index.js` (`USER_API_CLIENT_TOKEN` → `SECRET:DICT_API_CLIENT_TOKEN_1`; dead SQLPUB/XATA credentials removed), `ncore/utils/openai/config/open_config.js` (`o_secret` → `SECRET:DEEPBRICKS_API_KEY_1`).

### Keys the user must rotate (committed in git history; I did not rotate anything)

| Secret | Where it was committed | New store name |
|---|---|---|
| OCR.space API key | `ncore/mcp_server/file_processor/ocr_config.py`, `ocr_engines.py`, `placeholder_image_generator/ocr_placeholder_replacer.py` | `OCRSPACE_API_KEY_1` |
| Unsplash access key | `placeholder_image_generator/main.py`, `constants.py` | `UNSPLASH_ACCESS_KEY_1` |
| Unsplash secret key and application id | `placeholder_image_generator/constants.py` | not used; revoke |
| Dict API Client-Token (`ENC:` blob, key was public) | `apps/VoiceClientAndCaddy/config/index.js` | `DICT_API_CLIENT_TOKEN_1` |
| sqlpub.com MySQL password | `apps/VoiceClientAndCaddy/config/index.js` | not used; rotate |
| Xata API key | `apps/VoiceClientAndCaddy/config/index.js` | not used; revoke |
| deepbricks.ai API key (`ENC:` blob) | `ncore/utils/openai/config/open_config.js` | `DEEPBRICKS_API_KEY_1` |
| `ADMIN_JWT_SECRET`, `JWT_SECRET`, `MYSQL_PWD`, `AZURE_SPEECH_KEY`, `STRAPI_TOKEN`, `GITEA_TOKEN` (`ENC:` blobs), `API_TOKEN_SALT`, `TRANSFER_TOKEN_SALT` (plaintext) | `config/index.js` (not ncore scope; change requested from the orchestrator) | store names chosen by the config owner, referenced as `SECRET:<NAME>` |

## ncore-3 details

- One exec core: `commander.runCommand(command, { cwd, env, input, inherit, info })` → `{ success, code, stdout, stderr }`; a string runs through the platform shell with Node's `shell` option (correct `cmd.exe /d /s /c` quoting on Windows), an array runs `[file, ...args]` without a shell.
- NC-003 fixed: `execPowerShell` spawns the PowerShell executable with argv and `-EncodedCommand` (UTF-16LE base64); quoting of the executable path and inner quotes no longer matter; `no_std` suppresses output logging, `cmdEnv` is merged into the environment.
- NC-004 fixed: `execCmd` returns `""` on any non-zero exit (keyword heuristic `isSuccessOutput`/`checkCmdSuccess` removed); `pipeExecCmd` returns `''`/output on success and `null` on failure; package_manager checks those values and verifies installs with `isInstalled` (exit status, apt `dpkg -s` + `Status: install ok installed`).
- NC-012 fixed: per-manager `remove` commands in `pmanager_map.js`; `remove`/`purge`/`autoremove`/`clean` report failure.
- NC-017 fixed: `configureSource` trusts only the live `winget source list`, verifies the mirror after `add`, and runs `winget source reset --force` on failure before returning false; winget install checks the result.
- NC-018 fixed: `wrapEmdResult`/`wrapTextResult` keep the real error.
- NC-019 fixed: edge-tts runs as argv (`runCommand([...])`), and only files that were actually written are reported; `installEdgeTTS` reports failure. (The byte-identical WLAN `basetool/` copy has no importer; it is deleted in ncore-6.)
- NC-029 fixed: `spawnAsync` clears the idle timer on close/error and never fires it after completion; `pipeExecCmdAsync` maps its arguments (env supported).
- NC-031 fixed: `compressVideo` returns false on a failed ffmpeg run and gets stderr progress chunks; `getVideoInfo` runs argv and parses stderr; `compress-index.js` treats a failed or empty output as failure and no longer throws (its misplaced shebang at line 13 made the module unloadable; removed).
- NC-032 fixed on the live paths: no `process.chdir` in `commander.js`; `global_vars/tool/common/cmder.js` is now a thin adapter over `#@commander` (the second exec implementation is gone); `foundation/utilities/porttool.js` delegates to the commander (its own exec methods called undefined `this.info`/`this.easyLog`). The remaining `chdir` copies are in dead modules (`foundation/utilities/plattool.js` requires a missing `../provider/base/base.js`, `utils/systool/libs/plattool.js` requires the missing `#@base`, `utils/porttool.js` and `utils/dev_tool/lang_deploy/libs/commander.js` have no importer); ncore-6 deletes them.

## ncore-4 details

- NC-006 fixed: `RouterManager.api()` sends only when `!res.headersSent`; every route handler is wrapped so an async rejection is answered once (500 with `code: INTERNAL_ERROR`) instead of becoming an unhandled rejection; the router is mounted once instead of once per added route. `file_query` download handlers stop when the path handler already answered, `resolveFilePath` returns `null` instead of throwing, and error paths never send twice. `HttpRpcServer._sendResponse/_sendError` also skip after headers are sent.
- NC-009 fixed: `submit_audio_simple` uses the real `Fmonitor` watchers (`getDICTSoundWatcher`/`getSENTENCESSoundWatcher`, `add()`), awaits each copy before deleting the temp file; `submit_audio` awaits its copies too (it counted pending promises as successes). Root cause in foundation `fcopy.copyFileToDir`: with an existing empty/replaceable target it deleted the source instead of the target; fixed, and `removeSource` only after a successful copy.
- NC-010 / PR-025 fixed: `SingleInstanceManager` creates the lock with `openSync(..., 'wx')`; a lock is held while its pid is alive (same host) or its heartbeat is fresh (other host, stale threshold 3x heartbeat); stale locks are removed only if unchanged since read; heartbeats rewrite via temp+rename only while the file still names this pid (else the instance stops claiming the lock); `releaseLock` unlinks only its own lock.
- NC-014 fixed: ThreadBus is the one SIGINT/SIGTERM/uncaughtException coordinator (signals force the shutdown so busy flags cannot skip hooks; logs go through the foundation logger, so stdio MCP stdout stays clean). `SingleInstanceManager` (priority last), `DualModeRunner`, `MCPServerManager`, `mcp_server/main.js`, callmodule `launcher.js` and `linux_service.js` register async hooks instead of calling `process.exit`; `ExitOn` (`process_on.js`) forwards its shutdown handlers to ThreadBus with unique names.
- NC-025 fixed: `StaticPathResolver` uses `globalDir.mapWebPath()` for every web key on non-WSL Linux (desktop or headless) and `globalDir.rootdir` as the project root.
- NC-027 fixed: `logRequest` tolerates a missing `User-Agent`.
- NC-037 (HTTP stack part) fixed: no `'Something broke!'` / `'Internal server error' + error` bodies; errors return a machine code and no error text.

## ncore-5 details

- NC-008 fixed on the extension side (`apps/dingdoudou`): master codes, `SUPER_SALT` and the FNV-1a format are gone; codes are `DDK2.<payload>.<Ed25519 signature>` bound to the extension device id and an expiry, verified with WebCrypto against `service_contract.json#dingdoudou.super_code_public_key` (fail closed until it exists); stored super licenses are re-verified on `license.get`; the popup shows the device id to request a code. Spec: `.claude/agents_shared/client_key_auth/dingdoudou_super_code_v2.md`. Laravel minting/acceptance: sent to laravel. Also fixed the pre-existing `background.ts:57` nullable type error; `tsc --noEmit` now reports only pre-existing errors in `OrderFormModal.tsx` and `domAuto.ts`.
- NC-037 (dingdoudou) fixed: the hardcoded Chinese super-license label is removed; the UI already falls back to the i18n `superLicense` text. New strings (`deviceId`, `offlineHint`) are in `uiI18n.ts` for zh/en.
- NC-011 fixed: Windows data dir candidates add `%LOCALAPPDATA%\core_node`; every module-level/getter mkdir in `system_paths.js` goes through a guarded `ensureDirectory`; `globaldir` derives `DATA_DRIVER` from the resolved data dir and its `mkdir` logs instead of throwing; the commander cache mkdir and the `config_tool` config-dir mkdir are guarded; `user_settings` directory setup and legacy import are guarded.
- NC-015 fixed: `settings.json` is written via temp+rename; `updateSettings()` re-reads, refuses to save over an unparsable file, and is used by `setKey`/`deleteKey`/`replace` and by `SettingsCenter.set/delete` (merge into current file, then refresh the cache); `syncToFile` JSON-encodes objects.
- NC-016 fixed: `ffinder` walks with `fs.promises.readdir/realpath` and a real deadline (`SEARCH_TIMEOUT_MS`); the `countDirs` pre-walk and its statistics are removed.
- NC-021 fixed: placeholder MCP server (`main.py`, `ocr_placeholder_replacer.py`): module-level `print` writes to stderr, pip runs with `stdout=sys.stderr`, images are saved in the format of their extension.
- NC-022 fixed: `main.js` builds the service config (`name`, `execPath`, `entry`, `args`); `installService` defaults its config, gates on Linux, returns false on missing fields/exec/systemctl failure; the journald-only keys (`LogsMaxSize`, `MaxRetentionSec`, `MaxFileSec`) are removed from the unit. `User=root` is unchanged (noted).
- NC-023 fixed: `DeepSeekTranslator` keeps a carry-over line buffer and skips a bad line instead of aborting; default interpreter `python3` on POSIX (config/TranslatorAPI no longer force `python`).
- NC-026 fixed: `globaldir` per-OS tag comes from `system_paths.getOsVarTag()` (`/etc/os-release` ID + major version, e.g. `debian13`; `win10`/`win11` unchanged). Existing `.dev_linux`/`applications_linux` installs are not reused on Linux (intended ABI isolation).
- NC-030 fixed: `main.js` uses `console.error` before the logger is loaded.

## ncore-6 details

- NC-034 fixed except the HTTP stack copy:
  - exec layer: `global_vars/tool/common/cmder.js` is an adapter over `#@commander` (ncore-3); deleted the dead copies `utils/dev_tool/lang_deploy/libs/commander.js` (no importer), `foundation/utilities/plattool.js` and `utils/systool/libs/plattool.js` (no importer; they required missing `../provider/base/base.js` / `#@base`).
  - port tools: kept `foundation/utilities/porttool.js`; deleted `utils/porttool.js` and `utils/net/libs/portool.js` (no importer).
  - HTTP helpers: both copies were dead and unloadable (`foundation/utilities/httptool.js` required a missing `../provider/model/encyclopedia.js`; `utils/htmltool/libs/httptool.js` is ESM importing missing `#@base`); both deleted.
  - explorer launch: `launcher/app_executable_launcher.js` delegates to `utils/systool/libs/explorer.js` (per-platform extensions kept).
  - `apps/WebLocalAreaNetwork/basetool/**` and `provider/**` (22 files, copies of the Voice ones, no importer in WLAN and pointing at missing `provider/types`) deleted; Voice keeps the one copy.
  - colored `log` copies in 8 `global_vars` files replaced by `#@logger`.
  - deferred (orchestrator decision): `foundation/express_utils` vs `utils/rpc/http_rpc`. The audit says keep `utils/rpc` and delete the other, but `development-guides/NODE_NCORE_GUIDE.md` §5 names `foundation/express_utils` as the web stack to reuse. It has no live consumer (only the broken `utils/rpc/http_rpc/example_usage.js`), so it is not reachable today.
- NC-035 fixed except two foundation defaults:
  - installers moved out of `global_vars`: `global_vars/tool/soft-install/**`, `tool/common/ffinder.js`, `libs/bdir-libs/ensure_7zip.js` and `global_dir/binary_dir.js` → `ncore/utils/softinstall/` (15 files, requires rewritten, every require statically resolved).
  - foundation zip tool moved to `ncore/utils/zip_tool/` (it depends on the 7z resolver); its `get7zExecutable` import pointed at `globaldir.js`, which never exported it (every compress/decompress threw) — now `utils/softinstall/binary_dir.js`. Voice callers updated.
  - `utils → ncontroller`: `platform_detector` now lives in `utils/system/`; `ncontroller/platform_detector.js` re-exports it (alias unchanged).
  - `foundation → global_vars` for `isDebug` (arrtool, fcopy, sequelize_pring) now reads the foundation logger's flag; `process_on` computes its start time itself.
  - deferred: `foundation/utilities/filetoollibs/fwriter.js` (relative paths resolve under `ROOT_APP_CACHE_DIR`) and `foundation/db_utils/sequelize_db.js` (default `APP_METADATA_SQLITE_DIR`) still read app dirs from `global_vars`; moving them changes where relative paths land and needs a caller audit.
- NC-036 partly fixed (behavior-relevant sites): exec layer has no throw; server-side RPC/MCP: `HttpRpcServer` constructor, `SubAppManager.registerRoute`, `SingletonRpcLauncher` port check, `DualModeRunner` (all 6), `SingleInstanceManager` (ncore-4); `videoCompressor`/`ffmpegSetupBywin`, `docker_control.controlContainer` (also argv exec now), `TampermonkeyServer.processPagePayload` (400 instead of 500 + error text). Remaining `throw new Error` in scope: 462 (172 `utils/ittools`, 106 `utils/puppeteer_spider_v2`, 23 `flutter_icon_tool`, 17 RPC client-side promise rejections kept as their error channel, rest spread). Recorded as remainder.
- NC-040 (new, fixed): the foundation logger started a non-unref'd `setInterval` at load, so any CLI/script that required `#@logger` never exited on its own; now `unref()`.
- ncore-6 review follow-ups: `ncore_backend_main.py` uses `pycore/pyutils/rpc_v2/http/local_rpc_middleware.LocalRpcGuardMiddleware` (the local ASGI gate, its error-code mapping and its body format are gone); the 12 `utils/dev_tool/lang_deploy/*_win.js`/`*_linux.js` installers import their binary getters from `utils/softinstall/binary_dir.js` (`globaldir.js` never exported them); dead `ncore/utils/softinstall.js` deleted (it shadowed the new directory); `global_vars/index.js` takes `isDebug` from the logger instead of a second parser; `SingletonRpcLauncher.startBackendServer` returns true/false; `launch()` logs the failed host:port, emits `launchError` and returns false (true on success), and its only caller (`singleton_rpc_entry_example.js`) checks it, with the example's `startBackendServer` override returning true/false like the base class; root `package.json` (temporary writer, alias block only): removed `#@link` and `#@puppeteer-api`, whose targets are missing at HEAD and which have no importers. Still broken, pre-existing and dead: `lang_deploy/getcmder_win.js` calls `bdir.downloadFile`, which exists nowhere.
- NC-041 (new, fixed): `apps/VoiceClientAndCaddy/config/index.js` required `../../config/service_contract` (resolves to `apps/config/…`, missing) so the Voice config failed to load; `utils/python_bridge/libs/ModelCaller.js` had one `../` too many for `system_paths`. Both use aliases now. Other unresolvable relative requires are in dead modules (`ncore/db.js`, `utils/serve.js`, `utils/softinstall.js`, `utils/caddy/libs/*`, `utils/win_tool/libs/sysinfo.js`, examples): 30 sites, recorded.

## ncore-7 details

- One-off migration (scratchpad script, not committed; values never printed or logged): legacy `ENC:` values (decrypted with the old key from git history) and committed plaintext secrets were written to `.secret_keys/.secret_ignore/<NAME>` with `wx` (never overwriting), mode 0600, owner aligned with the store (debian). An existing store file with the same value is reused. dd.sh's re-encrypt prompt will encrypt the new files.
  - created: `ADMIN_JWT_SECRET_1`, `JWT_SECRET_1`, `MYSQL_PWD_1`, `STRAPI_TOKEN_1`, `GITEA_TOKEN_1`, `API_TOKEN_SALT_1`, `TRANSFER_TOKEN_SALT_1` (config/index.js); `DICT_API_CLIENT_TOKEN_1` (Voice), `DEEPBRICKS_API_KEY_1` (openai), `OCRSPACE_API_KEY_1`, `UNSPLASH_ACCESS_KEY_1` (NC-033 keys, so those features keep working).
  - reused: `AZURE_SPEECH_KEYA_1` already held the same value as `AZURE_SPEECH_KEY`.
- `config/index.js` (temporary writer, NC-002/NC-024): every secret is a `SECRET:<STORE_NAME>` reference resolved by `config_tool` through `secret_manager.readRawSecret`; a missing store key logs `Config <KEY>: secret <NAME> missing; run dd.sh ... or dd.cmd ...` and resolves to null (fail closed). No `ENC:` value remains. Checked in-process: all 8 config keys plus the Voice token and the openai key resolve (booleans only).
- NC-026/NC-011 twins in `config/index.js`: `DATA_DRIVER`, `LANG_COMPILER_DIRNAME` and `APP_INSTALL_NAME` now come from `globaldir.js` (os-release tag, resolved data-dir drive); the local `os.type()` tag and the `D:\`-exists drive logic are gone.
- K7 alignment (B9 ruling): the Node guard now answers a loopback peer with a non-loopback `Host` header 403 `local_rpc_host_forbidden` and a disallowed `Origin` 403 `local_rpc_origin_forbidden` (codes from `client_key_auth.local_rpc.error_codes`); non-loopback callers without a valid signature keep 401 `client_key_*`. Same decision as pycore's `evaluate_request`, which `ncore_backend_main.py` uses.
- K7 DNS-rebinding fix (reviewer HIGH): `isLoopbackAddress` (peer and bind addresses) accepts only `net.isIP() === 4` addresses in 127.0.0.0/8, IPv4-mapped ones validated the same way, the IPv6 loopback, or an exact contract name; `isLoopbackHostHeader` (Host header and Origin hostname) accepts only exact membership in the contract loopback hosts after lower-casing and removing one trailing dot; `hostnameOf` keeps a bare IPv6 address whole. Scratchpad check: `127.attacker.example[:port]`, `localhost.attacker.example`, `127.0.0.1.nip.io[:port]`, upper-case/trailing-dot variants, `127.0.0.2`, `[::2]` → 403 `local_rpc_host_forbidden` (also with a matching Origin, and with `allowLoopbackOrigins:false` and no Origin); the same names as Origin → 403 `local_rpc_origin_forbidden`; `localhost`, `LOCALHOST.`, `127.0.0.1`, `[::1]:port` allowed; unsigned non-loopback peers (incl. `::ffff:10.0.0.1`) → 401.
- Deliberate differences from pycore's gate, recorded: (1) any loopback-host Origin port is allowed by default (pycore allows only the dashboard ports); callers that need a narrower set pass `allowLoopbackOrigins:false` plus `allowedOrigins` (mcp-chrome does). (2) One trailing dot is removed from Host/Origin names before the exact match (orchestrator instruction), so `localhost.` passes here while pycore refuses it; neither accepts any other name.
- dingdoudou imports only the contract sections it needs (`import { dingdoudou }`, `import { access }`), so the extension bundle does not ship the host/IP map.
- NC-008: `superCode.ts` reads both `super_code_format` and `super_code_public_key` from `service_contract.json#dingdoudou` (build-time import, one definition). The contract key decodes to 32 bytes and imports as an Ed25519 WebCrypto key; `tsc --noEmit` shows only the pre-existing errors. laravel-T10 mints DDK2 with the matching seed.
- Old `ENC:` files in `global_var`: none on this host (`/www/www/core_node/global_var`, `/var/_core_node/global_var`, `/root/.core_node/global_var` checked by content). On other hosts delete any `<data dir>/global_var/*` file whose content starts with `ENC:` (names like `<OS_TAG>_ADMIN_JWT_SECRET`, `<OS_TAG>_JWT_SECRET`, `<OS_TAG>_MYSQL_PWD`, `<OS_TAG>_AZURE_SPEECH_KEY`, `<OS_TAG>_STRAPI_TOKEN`, `<OS_TAG>_GITEA_TOKEN`, `<OS_TAG>_USER_API_CLIENT_TOKEN`).

## Blockers / requests

- None open. NC-034 HTTP stack: deferred (guide conflict) — `development-guides/NODE_NCORE_GUIDE.md` §5 names `foundation/express_utils`; the orchestrator recorded it for the user's decision; `express_utils` stays untouched.
- pycore: asked whether a reusable K7 Starlette guard exists for `ncore_backend_main.py`.

## Behaviour changes to note

- WebLocalAreaNetwork and the Voice local UI are loopback-only; LAN browsers cannot use them (a browser cannot hold the client key, K6).
- `/api/call` on 58000 refuses every call until `allowedCalls` lists pairs.
- A loopback caller with a non-loopback Host or a disallowed Origin now gets 403 (`local_rpc_host_forbidden` / `local_rpc_origin_forbidden`) on every ncore server, like pycore.

## Next owner

- none for review: ncore-1..7 approved.
- user: NC-034 HTTP stack decision (guide conflict).
- orchestrator: trailing-dot difference with pycore's gate (Node strips one dot from Host/Origin names, pycore does not) if both should be identical.
- user: rotate the keys in the table above; put the new values in the shared secret store under the listed names.
