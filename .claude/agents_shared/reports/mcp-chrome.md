# mcp-chrome report (2026-09-27)

Scope: `apps/mcp-chrome/`. Paths below are relative to `apps/mcp-chrome/app/` unless absolute.
TaskCreate is unavailable; task ids follow `.claude/agents_shared/client_key_auth/TASKS.md` (`<role>-<n>`).

## Tasks

| Id | Subject | Findings | Status |
|---|---|---|---|
| mcp-chrome-1 | [mcp-chrome] K6/K3 native-host signing for the extension's Laravel calls | K3, K6 (requirements §4) | approved (`reviews/mcp-chrome-1.json`, relay hardening included) |
| mcp-chrome-2 | [mcp-chrome] K7 on the native server (loopback 12306) | FU-001 | approved (`reviews/mcp-chrome-2.json`) |
| mcp-chrome-3 | [mcp-chrome] worker correctness | FU-007, FU-021, FU-034, FU-041 | approved (`reviews/mcp-chrome-3.json`) |
| mcp-chrome-4 | [mcp-chrome] extension i18n and the dead SSE consumer | FU-042 (extension part), RV-004 (extension part) | approved (`reviews/mcp-chrome-4.json`) |
| mcp-chrome-5 | [mcp-chrome] Firefox extension id from the contract (B9) | one definition for `mcp_chrome.firefox_extension_id`; reviewer hardening note on mcp-chrome-1 | approved (`reviews/mcp-chrome-5.json`) |

## Findings

| Id | Verdict | Fix / reason |
|---|---|---|
| FU-001 | fixed | Every route runs ncore's shared K7 guard (`local_rpc_guard.createFastifyGuard` `onRequest` + `preParsing`, loaded through `native-server/src/ncore.ts`) with `LOCAL_RPC_GUARD_OPTIONS = { allowedOrigins: [extension origins], allowLoopbackOrigins: false }`: loopback peer + loopback `Host` (DNS rebinding) + no `Origin` or the extension origin; anything else needs a K3 signature. The guard also replaces `@fastify/cors`: CORS reflects only the extension origin, never `*`. `/singleton` is covered, so only a no-Origin local client (the next native host) or the extension can shut the host down. Extension origins: `EXTENSION_ID` (one definition: `config/service_contract.json#mcp_chrome.extension_id`, exported by `chrome-mcp-shared` like `HOST_NAME`; the hardcoded literal in `native-server/src/scripts/constant.ts` is gone) plus the launching origin the browser passes on argv (the host wrappers now forward it). Local MCP clients (no Origin, Host 127.0.0.1/localhost) need no new config. The own guard (`request-guard.ts`) is deleted. `SingletonHandler.handleMessage` also rejects a non-object body instead of throwing. |
| FU-007 | fixed | The typed pull merge lives once in `LaravelWorkerLifecycleBase.pullAcrossTaskTypes`: each type takes only the remaining limit; a later failure keeps already-claimed tasks. Simple workers and the Bing worker both use it; the Bing copy is removed. |
| FU-021 | fixed | Bing `start()` runs through one `AsyncOperationController`; a concurrent watchdog resume and user Start share the in-flight start. |
| FU-034 | fixed | `fetchRemoteImageBytes` (`utils/image-utils.ts`): one `AbortSignal.timeout` deadline over headers and body, `Content-Length` and streamed byte cap (8 MiB), null on timeout. `bytesToBase64` replaces the byte loop. The raster magic check is centralized as `isRasterImageBytes` (`utils/binary.ts`) and reused by `assist-image-api.ts`; the same unbounded fetch in `web-search-cover-cache.ts` now uses the helper. |
| FU-041 | fixed | `geminiImageTool.cancel(jobId, reason)` fails the job and moves its tab to a fresh chat; `generateOnce` calls it before the mutex is released whenever no image was collected. |
| FU-042 (extension) | fixed, part refuted (refutation accepted by the lead) | Background results shown in the popup (listener start/stop/config messages, Task Center and processor statuses, unknown action/capability, Bing queue/connection messages) and popup literals (`Testing…`, `Connected · N pending`, NotebookLM, study-gen failure) now use locale keys; 19 keys added to all 6 locales (parity kept, 716 each). The background follows the popup-selected language (`followUserLocale`). Refuted: worker names (`MCP Chrome … Worker`) are protocol identifiers, not UI text: Laravel `QueueWorkerPresenceService::kind()` classifies workers by `str_contains(name, 'chrome')`, so they stay literal. |
| RV-004 (extension) | fixed | `task-history-store.ts` had no importer; deleted. Removed the extension's `stream_events` typing, `TASK_STREAM_EVENT_BY_ROLE`, `TERMINAL_TASK_EVENTS` (only user was the store), the `history_*` limit typing, and `'stream'` from `TaskSubPath`. Contract entry: see blockers. |

## mcp-chrome-1 design (K6/K3)

- One transport: `chrome-extension/services/LaravelTransport.ts` `laravelFetch()`. `BaseApiClient.request` (Worker, TaskCenter, StudyGen, Assist clients), `QueueCenterWakeService` (overview, events), `duoreader-importer-core` (ingest-status, ingest, audio) and the ai-audio upload in `ai-web-common` all go through it. Every attempt (including retries) is signed fresh. Not signed: `/api/health` reachability probes (public, run against not-yet-selected endpoints) and third-party URLs.
- The extension sends only `{ method, url: path+rawQuery as sent, contentType, contentSha256 }` over native messaging (`NativeMessageType.SIGN_CLIENT_REQUEST`, `packages/shared/src/types.ts`). The digest is the WebCrypto sha256 of the exact body bytes; `FormData` is the contract `UNSIGNED-PAYLOAD`. The host answers with the contract headers or a contract error code; the key and canonical string never leave the host.
- Background: `native-host.ts` registers the sign transport (request/response by `requestId`, 5 s timeout, waits for the port during startup, rejects pending requests on disconnect). Popup and other extension pages relay through `BACKGROUND_MESSAGE_TYPES.CLIENT_KEY_SIGN`; the relay answers only `sender.id === chrome.runtime.id && !sender.tab`, so content scripts and tool-injected tab scripts get `{ ok: false }`.
- Host: `native-server/src/client-key-signer.ts` calls ncore `client_key_auth.signRequest({ client: 'mcp_chrome', method, url, contentType, contentSha256 })` (no second implementation; ncore validates the digest and fails `client_key_body_digest_invalid` otherwise). `native-server/src/ncore.ts` is the one place that loads ncore modules: it sets `MCP_MODE=mcp` first so ncore logs go to stderr (host stdout is the native-messaging channel; checked: the signer's error line appears only on stderr). Sign requests are not logged per call.
- No signature available (host not connected, key missing, old host): the request goes out unsigned and Laravel fails `client.key` routes closed; a host that times out pauses signing 30 s so calls do not each wait 5 s. Warnings are throttled.
- Test vectors (scratchpad, no repository or secret-store writes): (a) URL as sent → ncore canonical path/query, extension digest, ncore canonical string and signature: all three vectors exact. (b) Full `signRequest({ url, contentType, contentSha256, ... })` with the test key injected in memory and the clock pinned: `content_sha256`, `key_id`, `timestamp` headers equal the vectors, the signature equals the vector fields signed with the returned nonce, and ncore `verifyRequestHeaders` accepts each; the unsigned marker with a JSON type is refused (`client_key_body_digest_invalid`). (c) Through the host signing path (TypeScript transpiled in memory): extension `laravelFetch` → body digest → JSON round trip standing in for native messaging → host `signClientRequest` → ncore `signRequest`, with `fetch` stubbed to capture the request. For all three vectors the captured `X-Core-Node-Client` is `mcp_chrome`, `content_sha256`/`key_id`/`timestamp` equal the vector, the signature equals the vector canonical with this client, machine id and nonce, and ncore `verifyRequest` accepts the captured headers plus the exact body.

## Changed files

mcp-chrome-1:
- `packages/shared/src/types.ts` (`SIGN_CLIENT_REQUEST[_RESPONSE]`, `ClientKeySignRequest`, `ClientKeySignResult`)
- `native-server/src/client-key-signer.ts` (new), `native-server/src/ncore.ts` (new, shared with mcp-chrome-2), `native-server/src/native-messaging-host.ts`, `native-server/src/constant/index.ts` (`NCORE_MODULES`, `CLIENT_KEY_SIGNING`)
- `chrome-extension/services/LaravelTransport.ts` (new), `entrypoints/background/native-host.ts`, `common/message-types.ts`, `common/constants.ts`, `utils/binary.ts` (`sha256Hex`)
- callers: `entrypoints/background/api/BaseApiClient.ts`, `entrypoints/background/services/task-center/QueueCenterWakeService.ts`, `utils/duoreader-importer-core.ts`, `entrypoints/background/tools/browser/ai-web-common.ts`

mcp-chrome-2:
- `native-server/src/constant/index.ts` (`LOCAL_RPC_GUARD_OPTIONS`)
- `native-server/src/ncore.ts` (new; loads ncore `local_rpc_guard`)
- `native-server/src/server/index.ts` (guard hooks replace `@fastify/cors`)
- extension id from the contract: `packages/shared/src/constants.ts` (`EXTENSION_ID`), `native-server/src/scripts/constant.ts` (re-export, literal removed), `scripts/native-host-common.cjs` (`EXTENSION_ID` export), `scripts/update-extension-id.cjs` (usage example), `chrome-extension/config.cjs` (comment)
- `native-server/src/server/singleton.ts`
- `native-server/src/scripts/run_host.sh`, `native-server/src/scripts/run_host.bat` (forward browser argv)

mcp-chrome-5 (B9):
- `packages/shared/src/constants.ts` (`FIREFOX_EXTENSION_ID` from `config/service_contract.json#mcp_chrome.firefox_extension_id`)
- `native-server/src/scripts/constant.ts` (re-export; literal removed)
- `chrome-extension/wxt.config.ts` (gecko `id` from `chrome-mcp-shared`)
- reviewer hardening on mcp-chrome-1: `chrome-extension/entrypoints/background/native-host.ts` (`CLIENT_KEY_SIGN` relay only from extension pages)

mcp-chrome-3:
- `chrome-extension/entrypoints/background/services/task-center/LaravelWorkerLifecycleBase.ts`
- `chrome-extension/entrypoints/background/services/task-center/SimpleWorkerRuntimeBase.ts`
- `chrome-extension/entrypoints/background/services/bing-dictionary-worker-service.ts`
- `chrome-extension/entrypoints/background/services/bing-dictionary-worker-runtime.ts`
- `chrome-extension/entrypoints/background/api/WorkerApiClient.ts`
- `chrome-extension/utils/binary.ts`, `utils/image-utils.ts`, `utils/media-image-search.ts`, `utils/web-search-cover-cache.ts`
- `chrome-extension/services/assist-image-api.ts`
- `chrome-extension/entrypoints/background/services/gemini-image-generate.ts`
- `chrome-extension/entrypoints/background/tools/browser/gemini-image.ts`

mcp-chrome-4:
- `chrome-extension/_locales/{en,zh_CN,zh_TW,de,ja,ko}/messages.json`
- `chrome-extension/utils/i18n.ts`, `utils/runtime-message.ts`, `entrypoints/background/bootstrap.ts`
- `chrome-extension/entrypoints/background/{puter-translate,bing-dictionary-client,ai-web-client,gemini-image,duoreader-importer,web-search,notebooklm,qwen-tts,task-center}-listener.ts`, `web-chat-job-listener-factory.ts`
- `chrome-extension/entrypoints/background/services/bing-dictionary-worker-service.ts`
- `chrome-extension/entrypoints/popup/composables/useBingDictionaryClient.ts`, `composables/useBookStudyGenerator.ts`, `components/extensions/NotebookLMPanel.vue`
- RV-004: deleted `chrome-extension/entrypoints/background/services/task-center/task-history-store.ts`; `utils/queue-center-contract.ts`, `utils/api-paths.ts`, `entrypoints/background/api/WorkerApiClient.ts` (comment)

## Static checks

- `tsc --noEmit -p app/native-server`: clean for mcp-chrome-2..4. With mcp-chrome-1, clean against `packages/shared/src` (scratchpad tsconfig mapping `chrome-mcp-shared` to src); against the stale shared `dist` only the 4 new shared symbols are missing.
- `tsc --noEmit -p app/chrome-extension`: clean except the 17 pre-existing `Cannot find module './*.vue'` lines (plain tsc does not resolve SFCs); same shared-`dist` note for mcp-chrome-1.
- Line endings: every edited file keeps its HEAD endings per line (several files are CRLF or mixed).
- `node --check` on `native-host-common.cjs`, `update-extension-id.cjs`, `config.cjs`: OK. `bash -n run_host.sh`: OK. Locale files: JSON parses, CRLF line endings kept, 716 keys in each locale.
- FU-001 decisions (scratchpad, ncore `authorizeRequest` with `LOCAL_RPC_GUARD_OPTIONS`): allowed: MCP client without Origin (127.0.0.1 / localhost Host), the next host's `/singleton`, the extension origin; refused: a web page's `/singleton` shutdown, a localhost dev page origin, a rebinding Host (with or without Origin), `Origin: null`, an unsigned LAN peer. CORS answer for the extension: its own origin. Re-checked after ncore's B9 code change: same decisions; refusals now carry 403 `local_rpc_origin_forbidden` / `local_rpc_host_forbidden` (unsigned LAN peer: 401 `client_key_missing`). No mcp-chrome code depends on these codes. ncore then fixed a DNS-rebinding hole in the shared guard (Host/Origin names starting with `127.`, e.g. `127.attacker.example`, `127.0.0.1.nip.io`, counted as loopback, so Origin-less GETs to this native server were reachable through rebinding). Re-checked with the native server options: those names and a `127.`-prefixed Origin are refused (403 `local_rpc_host_forbidden` / `local_rpc_origin_forbidden`); `127.0.0.1:port`, `LOCALHOST.`, `[::1]`, peers `127.0.0.2` and `::ffff:127.0.0.1`, and the extension origin still pass. No mcp-chrome change was needed.

## Blockers

- None open. (ncore added `signRequest` `contentSha256` and `allowLoopbackOrigins: false`; the interim digest-mismatch refusal in the host was removed because ncore now validates the digest itself.)
- Follow-up (lead ruling B9, carried into D7): remove unused @fastify/cors (package.json + lockfile) at the next install. `native-server/package.json` and its lockfile stay unchanged until then, because removing the dependency without a lockfile update would break `npm ci`.
- Reviewer note on mcp-chrome-3 (`GENERATION_ABANDONED`), explanation accepted by the reviewer: not shown in the popup. `geminiImageTool.cancel` is only called from the worker path (`generateViaGemini`), and the popup only polls the job id its own `start` returned; the string is job/MCP diagnostics like the file's other job errors, so no locale key.
- Build order: the extension and the host import `chrome-mcp-shared` from its `dist`; the new sign types appear there after `build:shared` (the standard `build` script runs it first). Against the stale `dist`, `tsc` reports only those 4 missing shared symbols.
- Contract cleanup (RV-004, `history_*`, `stream_events`): the orchestrator sequences it with pycore/laravel/laravel-manager; nothing left for mcp-chrome.

## Next owner

None: all mcp-chrome tasks are approved. Open follow-up carried by the orchestrator into D7: remove unused @fastify/cors (package.json + lockfile) at the next install, and run `build:shared` before building the host and the extension.
