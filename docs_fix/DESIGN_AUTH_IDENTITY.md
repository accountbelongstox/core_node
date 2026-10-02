# Authentication and Identity

Scope: how machines, devices, browsers and humans authenticate to Laravel, pycore, ncore, mcp-chrome and CodeSync; where the shared key lives; device and relay identity; the security rules from the team security audit that stay in force.

Authority: code > config/*_contract.json > this document.

Related: `DESIGN_LARAVEL_PLATFORM.md` (Laravel runtime and the pycore boundary), `DESIGN_RELAY.md` (relay device enrollment and Ed25519 relay tokens), `CODESYNC_AI_COMMUNICATION_API.md` (CodeSync signing), `development-guides/LARAVEL_GUIDE.md` (binding Laravel rules).

## 1. Principals and surfaces

| Surface | Callers | Authentication |
|---|---|---|
| Laravel machine routes: `worker/*`, task results, `work/leases/{claim,renew,release}`, audio/media/resource ingest and offset uploads, `app_qy_v1/delivery/*` (plus `ServerIdentityHeader`), queue-center lane diff, AppQyV1 worker/queue groups, `internal/pycore/*`, orch-audio and agent-history ingest | pycore, ncore, mcp-chrome native host | `client.key` |
| Laravel data-sync peer routes (`dashboard/db-manager/sync-peer/prepare`, `export-prepare`, every session/export-session route) | the peer Laravel, signing as client `laravel_peer` | `client.key`; the per-session token is a second check. `sync-peer/health` is public |
| Routes both operators and machines call: queue-center overview/events/receipts/items/id-pages/page-data/head/cancel/retry, `queue-center/mercure-authorization`, worker register/accept, `work/nodes`, media/enrich, task-center reads | UIs and machines | `client.key_or_dashboard` (default level admin) |
| Compute routes (OCR, TTS generate, voice-subtitle add, audio heads, ItTools image/pdf, placeholders, audio lookup) | wordnew, pycore, signed UI builds, logged-in users | `ApiComputeCatalog::AUTH_MIDDLEWARE` = `client.key_or_dashboard:user` + `throttle:compute` (30/min per user, else per signing machine, else per IP); `app_qy_v1/system/initialize` uses `AUTH_MIDDLEWARE_ADMIN` |
| Operator/admin routes (database manager, backup/restore, DB credentials, AI provider keys, settings, bulk reset/clean, cover regenerate, DingDuoDuo admin group) | laravel-manager and pycore-manager humans | `dashboard.auth` = admin; `dashboard.auth:super_admin` for credentials, restore and import; `dashboard.auth:user` for self-service `/api/user*` and `tts/generate` |
| End-user routes (wordnew, codemart) | users | Sanctum or public reads; never the machine key |
| Payment callbacks | payment gateway | gateway signature plus amount check, or admin confirm; never the client key |
| Relay owner routes (grant, frames, telemetry, stats, roster, claim, pairings, owner blobs) | UIs (signed builds, logged-in users) | `client.key_or_dashboard:user`; owner identity = client key → shared fleet owner `RelayFleetScope::clientKeyOwner()`, OR the Sanctum user (`RelayOwnerResolver`, `DESIGN_RELAY.md` §2) |
| Agent bus (`/api/agent-bus/*` REST and `/api/agent-bus/mcp`; `info` is public) | AI agents through the K3-signing bridge, operators | `client.key_or_dashboard` (admin); agent id = K3 machine id (or `user-<id>`) + name (`DESIGN_AGENT_BUS.md` §3) |
| Relay device enrollment | pycore | Ed25519 relay flow (`DESIGN_RELAY.md`); an enrollment that also carries a valid K3 signature is approved at once (`RelayDeviceCtl` → `approveWithClientKey`) |
| pycore RPC 59000, ncore 58000 and its HTTP stack, translation service, WebLocalAreaNetwork, mcp-chrome native server | local UI, relay, LAN peers | K7 (§7) |
| CodeSync workspace | LAN pycore peers | K3 only; no bearer secret |
| TTS engine servers started by pycore (f5tts, chattts, ...) | pycore | loopback bind only |
| `GET /api/public/client-key-routes`, `GET /api/public/avatar/*` | anyone | public; own limiter (§5) / `throttle:compute` |

Machine callers never move to web login. Web login (`dashboard.auth`, Sanctum) exists only for human operator and end-user surfaces.

## 2. Shared client key (K1, K2)

- One symmetric key, `CORE_NODE_CLIENT_KEY_1`, is shared by Laravel, every pycore, ncore, the mcp-chrome native host and wordnew. Every end must hold the identical value.
- Storage: the shared secret store. Encrypted `.secret_keys/already_encrypted/CORE_NODE_CLIENT_KEY_1.js` travels with git; dd.sh / dd.cmd decrypt it into `.secret_keys/.secret_ignore/CORE_NODE_CLIENT_KEY_1` (git-ignored, 0600 where the filesystem enforces modes). Crypto: `scripts/encryption_tools/secret_crypto.js` (AES-256-GCM, PBKDF2-SHA512); the password reaches the tool only on stdin (`secret_password_runner.js`), never argv.
- Key names: `CORE_NODE_CLIENT_KEY_1.._5` only (`client_key_auth.secret_key_max_index`); a bare `CORE_NODE_CLIENT_KEY` is ignored everywhere. Verifiers accept any slot, selected by `X-Core-Node-Key-ID`; signers use `_1`. Rotate by adding the new key under a free index on every end, then moving it to `_1`.
- Lifecycle is owned by shell only:
  - Linux `scripts/shells/linux/common/client_key_common.sh` (`client_key_generate_if_absent`, `client_key_offer_regenerate`, `client_key_ensure_ready`, called by dd.sh and 175); Windows `Initialize-ClientKeySecret` in `scripts/shells/win/win_common/SecretManager.ps1`; pycore `pyfoundations/secret_manager.py`.
  - No raw file and no encrypted copy (single file or bundle) → generate 32 random bytes, base64url without padding, then the re-encrypt prompt encrypts it. An encrypted copy exists → never generate; decrypt restores it. Undecryptable → offer regenerate, encrypt and replace; other hosts then sync.
- Runtimes only read the key. They never create, print or log it and never put it on a command line. A missing key fails closed with `client_key_missing` and logs the secret name and the dd step, never a value.
- Other secrets follow the same store: `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1` (§9), ncore `config/index.js` values as `SECRET:<STORE_NAME>` references, the CodeMart admin password (`DESIGN_LARAVEL_PLATFORM.md`).

## 3. Request signature (K3, K4, K5)

Contract: `config/service_contract.json#client_key_auth`. Every end reads it and never re-declares values.

- HMAC-SHA256 with the decoded key over `canonical_fields` joined by `\n`: canonical version (`core-node-client-key`), protocol (`2`), METHOD, path, query, client, machine id, key id, timestamp, nonce, content sha256. Signature and key encoding: base64url without padding. Key id: first 16 hex chars of sha256 of the decoded key.
- Headers: `X-Core-Node-Client`, `-Protocol`, `-Machine-ID`, `-Key-ID`, `-Timestamp`, `-Nonce`, `-Content-SHA256`, `-Signature`.
- Clients: `pycore`, `ncore`, `mcp_chrome`, `laravel_peer`, `shell`.
- Path and query use the relay canonicalization (`pycore_relay_contract.json#signature_profile.canonicalization`) through the existing implementations: pycore `pyutils/common/relay_contract.py`, Laravel `RelayContract::canonicalPath/canonicalRawQuery`. The signed path is the full wire path including any base path; Laravel verifies `getBaseUrl().getPathInfo()`. The query is signed.
- Body digest: lowercase sha256 hex of the exact transmitted bytes. Only `multipart/form-data` uses the literal `UNSIGNED-PAYLOAD`.
- Timestamp skew ≤ 300 s; each nonce (`^[A-Za-z0-9_-]{16,128}$`) is accepted once within 600 s.
- K4: the machine id (`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`) attributes and logs a request; it is not a trust boundary. Every key holder is trusted equally; there is no per-machine enrollment or trust-on-first-use.
- K5: failures are closed — 401 with one of the contract `error_codes` (`client_key_missing`, `_unknown`, `_protocol_invalid`, `_timestamp_invalid`, `_nonce_invalid`, `_nonce_replayed`, `_body_digest_invalid`, `_signature_invalid`) and an i18n message. Unsigned anonymous calls to a session-or-key route get 401 `AUTH_REQUIRED`; a logged-in user below the route level gets 403 `AUTH_FORBIDDEN`.
- Laravel CORS (`config/cors.php`, `allowed_headers: ['*']`, credentials on, contract origins) echoes the `X-Core-Node-*` headers on preflight.

## 4. Laravel verifier and middleware

- `App\Services\ClientKey\ClientKeyAuthService` is the one verifier and the `laravel_peer` signer (`signedHeaders`). Nonces are cached under `client-key:nonce:`.
- Aliases in `bootstrap/app.php`: `client.key` → `ClientKeyOnly`; `client.key_or_dashboard[:level]` → `ClientKeyOrDashboard` (a valid K3 signature passes, otherwise `LocalDebugOrSanctum` at the given level).
- `dashboard.auth[:level]` → `LocalDebugOrSanctum`, levels `user | admin (default) | super_admin`.
- Loopback debug bypass (`DebugAuthService::isDebugBypass`): only for loopback requests while `DASHBOARD_LOCAL_DEBUG` is on; it defaults on for Windows or non-production (`PathMapper::isProduction()`), off on production Linux.
- Routes registered in the immutable `routes/web.php` get middleware through the controller (`HasMiddleware`), e.g. `TTSController`, `McpV1PlaceholderCtl`.

## 5. Public signed-route table

- `GET /api/public/client-key-routes` (path in `client_key_auth.routes_endpoint`) returns `{success, data: {client_key_routes: [{method, path, auth, session_level}]}}` from `ApiComputeCatalog::signedRoutes(true)`, derived from the live route table (route and controller middleware). No static copy exists anywhere.
- It lists only routes a client may sign instead of logging in (`client_key_or_session`, any session level); worker-only `client_key` routes stay in the admin-only `/api_info` (`client_key_routes`, full table). HEAD is listed wherever GET is.
- ETag = sha1 of the table, `Cache-Control: public, max-age=300`; a matching `If-None-Match` gets 304 with an empty body.
- Own limiter `throttle:client-key-routes` (60/min per IP, `ApiComputeCatalog::THROTTLE_ROUTE_TABLE`), not shared with `compute`.

## 6. Signers

| End | Implementation |
|---|---|
| pycore | `pycore/pyutils/common/client_key_auth.py` (signer, store key) |
| ncore | `ncore/foundation/common/client_key_auth.js` (signer and verifier for all ncore layers) |
| mcp-chrome | every extension Laravel call goes through one `laravelFetch`; the native host signs with ncore's signer. The key never enters extension storage; only extension pages may request signatures; signing works only while the native host is connected and the key exists |
| UI (`poly_apps/pycore_laravel_wordnew_ui`) | `core/integrations/laravel/ClientKeySigner.ts` (WebCrypto, byte-identical to pycore and Laravel), `ClientKeyRouteTable.ts` (reads §5 once per selected endpoint over the shared transport, ETag-revalidated, cached per endpoint in localStorage; while no table is known a keyed build signs every request), `ClientKeyFailure.ts` (a 401 with `client_key_*` shows the localized `common.client_key_*` message instead of the login window). One `withClientKey` wraps every Laravel path: `BaseAPI`, wordnew `laravelFetch`, `WfNewAdminApi`, `MasterApiClient.signRequest` |

Build flag `CORE_NODE_COMPILE_CLIENT_KEY` (`vite.config.ts`, `compiledClientKey`): the key is compiled into `__CORE_NODE_CLIENT_KEY__` only by the dev server or a build with `CORE_NODE_COMPILE_CLIENT_KEY=1`, read from `.secret_keys/.secret_ignore/CORE_NODE_CLIENT_KEY_1`. Such a bundle exposes the key to anyone who unpacks it. Rule: never set it for a public web build; use it only for app packaging and local debugging. A build without it, or a page without `crypto.subtle` (not HTTPS/localhost), sends no signature and the session decides.

## 7. Local RPC servers (K6, K7, K7a)

- K6: browsers never hold the key in public builds. Humans authenticate with web login; pycore UI actions that need machine identity go through local pycore, which signs.
- K7 (contract `client_key_auth.local_rpc`), on pycore 59000, ncore 58000 and its HTTP stack, the translation service, WebLocalAreaNetwork, the mcp-chrome native server:
  - bind loopback by default;
  - a non-loopback caller needs a valid K3 signature (else 401 `client_key_*`);
  - a loopback browser caller needs a loopback peer, a loopback `Host` header (DNS rebinding) and an allowed `Origin` (else 403 `local_rpc_host_forbidden` / `local_rpc_origin_forbidden`);
  - loopback names are matched exactly against the contract loopback hosts (peer addresses via IP parsing, never a `127.` prefix test); one trailing dot is stripped from Host/Origin names;
  - never `Access-Control-Allow-Origin: *` with credentials; rejections carry no CORS allow headers;
  - relay-token paths are unchanged.
- Implementations: pycore `pyutils/common/local_rpc_guard.py` (`LocalRpcGuardMiddleware`, also reused by ncore's Python backend), ncore `ncore/foundation/common/local_rpc_guard.js` (all Node servers and the mcp-chrome native server, extension-only origins). The Node guard accepts a loopback Origin on any port; pycore accepts only the dashboard ports — deliberate.
- K7a: remote browser access to pycore is relay only. pycore binds 127.0.0.1 even when scripts pass `--host 0.0.0.0`; the opt-in `system_settings.rpcLanBind` (`pyservice config system set --key rpcLanBind --value true`) admits only K3-signed machine callers (CodeSync peers, LAN discovery). pycore-manager hides non-loopback direct modes and shows a relay hint. The loopback browser allow-list = contract loopback hosts × `nexus_dash_frontend` and `pycore_backend` ports. The UI classifies rejections with `core/integrations/pycore/pycoreAccess.ts` (`classifyPycoreAccess`) reading the keyed error codes.
- ncore `/api/call` refuses every call until allowed module/function pairs are configured (empty by default).

## 8. Machine authentication and realtime

- Every non-human Queue Center caller (pycore, mcp-chrome workers, peer Laravel) authenticates with K3. There are no per-installation enrollment credentials or short-lived machine tokens.
- Realtime (Mercure) is a wake/revision channel only: event cursor, revision, resource kind, task type, a non-sensitive resource id, timestamp. Task prompts, source text, audio, results and credentials never go on it; clients fetch data over authenticated HTTP after the wake.
- The Mercure subscriber authorization is issued only by `POST /api/queue-center/mercure-authorization` (`client.key_or_dashboard`); event replay (`queue-center/events`) has the same gate.
- Server-side publication secrets never reach clients, bundles or extensions.

## 9. Device and relay identity

Current:
- Relay devices enroll with Ed25519 keys through the relay flow (`DESIGN_RELAY.md`). A K3-signed enrollment request is approved without a web-login step.
- DingDuoDuo licenses: the extension accepts only Ed25519-signed, device-bound `DDK2` codes (`config/service_contract.json#dingdoudou`, spec `.claude/agents_shared/client_key_auth/dingdoudou_super_code_v2.md`). The seed is the store secret `DINGDUODUO_SUPER_CODE_SIGNING_KEY_1`; minting is only `php artisan dingduoduo:super-code <device>` (no web route) and refuses a seed that does not match the contract public key. Seeded master codes stay revoked.

Target design (requirement, not implemented; moves identity off the shared symmetric key step by step, each step accepted alongside the shared key through `client_key_auth.protocol_version`):
1. Stop compiling the shared key into any app package; apps use the logged-in user's token until step 2.
2. Phone/app device keys: Ed25519/P-256 key pair generated in Android Keystore (StrongBox when available) / iOS Secure Enclave, never exported; one-time enrollment by a Laravel challenge plus key attestation, authorized by a logged-in user or a pycore-displayed pairing code; Laravel keeps a device registry (public key, device, owner, revoked). Requests are signed per RFC 9421 over the same fields as K3 with the same skew/nonce rules. Attestation is hardening; registry plus revocation is the control.
3. User access tokens become short-lived and DPoP-bound (RFC 9449) to the device key.
4. Machine keys: each host generates its own `CORE_NODE_MACHINE_KEY` (Ed25519, `.secret_keys/.secret_ignore/`, never in git); signatures in OpenSSH SSHSIG form (`ssh-keygen -Y sign -n core-node-k3`) checked against an `allowed_signers` registry in Laravel keyed by machine id. The git SSH key is not reusable (it is one shared key installed on every host). Inside the tailnet, callers may be identified with Tailscale WhoIs on the source address; identity headers are trusted only after WhoIs.
5. Owner root of trust: an Ed25519 owner root key encrypted with the user's password as `.secret_keys/already_encrypted/CORE_NODE_OWNER_ROOT_1.js`, public anchor `config/trust/owner_root.pub`. dd.sh / dd.cmd generate it on a fresh system (password typed twice, private key only in memory), then issue each host a certificate `{v, subject, kind: machine|device, public_key, roles, not_before, not_after}` signed with the root (canonical JSON, Ed25519). Verifiers check root signature, validity window, revocation list (root-signed, held by Laravel and synced to pycores), roles, then the request signature. Losing a host = revoke its certificate; changing the password = re-encrypt only the root file.
6. Per-host vault unlock: the vault data key is additionally wrapped for each enrolled host's machine key (age/X25519, `.secret_keys/hosts/<machine>.age`); dd tries the machine key first and falls back to the password; excluding a host = re-wrap without it.

## 10. Security rules from the team audit

Still binding on every end:
- Destructive or remote-reachable actions need K7/K3 plus explicit allow-lists: pycore `thread_bus/trigger_event` accepts only allow-listed UI event names with validated payloads; "open path" routes accept only paths contained (after resolve) in known output roots and never shell-execute files; document/setting routes validate roots and schema (base URLs only from the Laravel endpoint catalog).
- Path containment is checked on resolved paths, never by string prefix.
- Uploaded file names from clients are ignored for storage names.
- Never kill processes the service did not start; VRAM reclaim is opt-in.
- Never pass passwords on argv (stdin only); masking via the shared launcher helper; the secret store is excluded from any 777 permission walk; 777 helpers guard resolved paths and refuse system paths.
- Never drop a PostgreSQL cluster that holds user databases; never overwrite another user's existing SSH key.
- Client retries: only GET/HEAD or requests carrying an `Idempotency-Key`; Laravel dedupes replay routes per key and user (`Idempotent-Replayed: true`, 409 while in progress).
- Money paths: payment callbacks verify gateway signature and amount and apply via an atomic `pending` compare-and-set; escrow remainder is refundable on cancel/complete (admin route `POST /api/codemart/v1/admin/escrows/{escrowId}/refund`).
- Third-party credentials committed to git history must be rotated by the user; committed `ENC:` blobs are removed in favour of `SECRET:` store references.

## 11. Verification

- Cross-end vectors: Laravel, pycore (`client_key_auth.py`), ncore and the UI signer must produce identical headers and signatures for the same request (query sort, percent-encoded path, unicode JSON body, multipart unsigned). A verify round trip returns ok, then `client_key_nonce_replayed` on replay, then `client_key_signature_invalid` on a tampered query.
- `curl -si https://<laravel>/api/public/client-key-routes` → 200 with ETag; repeat with `If-None-Match: <etag>` → 304.
- Unsigned non-loopback call to `POST /api/ocr/recognize` → 401 `AUTH_REQUIRED`; signed call → passes auth.
- Same key on every end: compare key ids (`sha256(decoded)[:16]`), never values.

## 12. Open items

ncore development is paused (`AGENTS.md`); the `ncore:` items below wait for its resumption, except fixes the agent-bus bridge needs.

- §9 target design: nothing implemented (`config/trust/`, `CORE_NODE_OWNER_ROOT_1`, `CORE_NODE_MACHINE_KEY`, device registry, RFC 9421/DPoP absent). LAN phone access depends on step 2 or a default-off unsigned LAN read policy in `local_rpc_guard`.
- dd secrets submenu (reset the vault password and re-encrypt every secret with a decrypt round-trip before replace; encrypt missing `.js` for raw secrets; show key fingerprints) is not present in `scripts/shells/linux/dd_helper/secret_functions.sh` or `SecretManager.ps1`.
- `apps/mcp-chrome/app/chrome-extension/key.pem` is tracked in git.
- ncore: `ncore/utils/rpc/http_rpc` and `ncore/foundation/express_utils` both remain (audit says keep `http_rpc`; `development-guides/NODE_NCORE_GUIDE.md` §5 says reuse `express_utils`); needs a user ruling.
- Rotation of the third-party keys still in git history (OCR.space, Unsplash, dict API Client-Token, sqlpub MySQL, Xata, deepbricks, and the `config/index.js` JWT secrets, MYSQL_PWD, Azure speech key, Strapi/Gitea tokens, salts) and deletion of old `ENC:` files in host `global_var`: user action.
- Secret store modes on ntfs3 mounts without permission support cannot be enforced; keep `.secret_keys/.secret_ignore` on a native filesystem or mount with permissions.
- Front proxies (FrankenPHP/Caddy, tailnet) that answer `OPTIONS` themselves must allow the `X-Core-Node-*` headers; unverified on the server.
- ncore: `foundation/express_utils/libs/RouterManager.js` `truncateUserAgent` calls `.indexOf` on an undefined User-Agent, so a request without that header throws a TypeError (the `http_rpc` copy is guarded); `express_utils` also requires `#@gconfig`, `#@global_dir` and `#@global_vars` upward from foundation.
- ncore: the explorer / `xdg-open` launch logic is duplicated in `launcher/app_executable_launcher.js` and `utils/systool/libs/explorer.js`; extract one shared helper.
- ncore: about 400 `throw new Error` sites remain across ncore against the never-throw rule of `development-guides/NODE_NCORE_GUIDE.md`; the entry modules (`DualModeRunner`, `HttpRpcServer`, `SingleInstanceManager`, `docker_control`, `TampermonkeyServer`) have none.
