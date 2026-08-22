# Pycore UI Relay Groups and HTTP/3 — Part 1: As-Built Requirements

Original design date: 2026-08-17 21:15  
As-built audit: 2026-08-21

## Norms

- Actual source and live behavior are authoritative; design text follows them.
- Shared contracts and transport classes own cross-application behavior.
- No feature-level HTTP/3 shims or duplicated endpoint rules are permitted.
- Operations are restart-safe and idempotent at the smallest useful step.
- 103 means Early Hints; 301 remains a permanent redirect.

## Connection topology

The default Laravel API for Pycore Manager and Wordnew is `https://api.si.12gm.com`, including when the UI itself is opened from `127.0.0.1:13054`. Pycore client, worker-base, translation-worker, endpoint-manager, and audio-worker fallbacks all resolve the same `LARAVEL_WORKER_API_URL` constant; loopback endpoints remain explicit user-selectable alternatives, not implicit defaults.

Endpoint persistence distinguishes an implicit legacy default from an explicit user selection. An unmarked legacy HTTP default is migrated once to the configured HTTPS endpoint; a later explicit selection remains persistent.

The system has three distinct links:

1. Browser or Capacitor WebView to Laravel over public HTTPS. The runtime negotiates HTTP/3 when supported and falls back through HTTP/2 or HTTP/1.1.
2. Pycore to Laravel traffic through the shared Laravel client. HTTPS transactions and Mercure SSE prefer HTTP/3 through `curl_cffi`/libcurl.
3. Browser and Pycore realtime subscriptions through Mercure SSE, with Laravel/server publication to the Mercure hub.

Local Pycore RPC remains a loopback HTTP control plane. Port 13054 is the Vite UI endpoint in the audited environment; the running Pycore RPC endpoint is port 59000. The two must not be confused when validating backend state.

## Relay groups

Laravel is the authenticated rendezvous and durable relay coordinator. The implementation under `poly_apps/laravel_main/app/Services/Relay/` provides:

- machine registration, heartbeat, and unregister;
- pairing and capability discovery;
- request and response persistence;
- authenticated Mercure publication;
- bounded blob storage;
- hub authorization and key provisioning.

`poly_apps/laravel_main/routes/api/relay.php` exposes dashboard, machine, pairing, request, response, and blob endpoints with the appropriate dashboard or Pycore identity middleware.

The shared relay endpoint and topic contract is `config/queue_center_contract.json`. It defines machine, pair, event, heartbeat, TTL, and capability names. Pycore consumes that contract through `pycore/pyctl/relay/relay_service.py` and the shared Mercure client. The UI consumes it through `RelayCapabilities.ts`, `PycoreRelayTransport.ts`, `LaravelRelayRoster.ts`, and `LaravelMercureConnection.ts`.

HTTPS backend selection activates relay behavior. Direct non-HTTPS local selection remains direct. This is an explicit transport decision rather than a compatibility fallback hidden in feature code.

## Audio queue requirements

The current architecture satisfies the queue requirements through a shared worker kernel rather than separate word and sentence implementations:

- `pycore/pyctl/tts/laravel_audio_worker.py` owns ordered task admission, bounded execution, cache lookup, progress, and non-blocking delivery dispatch.
- `pycore/pyutils/tts/audio_delivery_outbox.py` atomically persists every retained cache path and the domain, result, and history checkpoints before network delivery begins.
- Word tasks use the word lane and Edge/Azure-compatible providers according to task policy.
- Sentence tasks use the sentence lane and Qwen3-TTS by default.
- Multi-sentence articles reuse sentence synthesis and are recorded as composed output.
- The Qwen managed service is shared with Agent History rather than initialized per feature.
- Explicit backend or Wordnew priority receipts may move a task to the front.
- Otherwise Laravel claims all available English sentence work before other languages.
- Persistent diff segments retain an unacknowledged head adjustment even when the next remote diff payload is unchanged.

Laravel's queue gateway returns the queue position, whether the task was moved to the head, the action taken, processing progress, and ETA data. Wordnew carries and displays this receipt instead of assuming a priority change succeeded.

## Persistence and observability

Pycore continues synthesis while Laravel is unavailable. Generation and delivery are separate task groups: the worker writes a cache-backed outbox row first, then continues draining synthesis work while bounded delivery lanes independently retry the domain upload and terminal Queue Center result. A process restart immediately reclaims stale-process leases. Successful checkpoints are monotonic, so an idempotent re-delivery cannot regress from “audio uploaded” to “not uploaded.” Domain delivery completion and domain upload success are separate checkpoints: a non-retryable domain 4xx records the upload failure and continues through the global completed-result fallback, whose body carries the audio. Missing cached files or terminal global-result failures become visible dead letters and may be explicitly requeued through `ui/queue_center/retry_audio_delivery`.

The durable outbox and history repository use the existing atomically replaced user-data document rather than SQLite; SQLite was optional, not a contract requirement. Domain delivery, global-result acceptance, and local-history persistence are separate monotonic checkpoints. Completed outbox rows are removed only after all three steps finish. Audio history uses a stable delivery-derived `record_id`, so replay updates the existing record instead of duplicating it; cached audio is retained when a delivery becomes a dead letter.

History records include:

- task and content identity;
- provider/engine provenance;
- local cached-audio metadata and playable resource routing;
- multi-sentence composition state;
- synthesis and upload progress;
- Laravel upload and global-result acceptance state;
- searchable error and detail fields.

Cached audio playback is restricted to files inside the managed cache root and to supported audio extensions. Arbitrary local file paths are rejected.

Queue Center snapshots expose worker lifecycle, current and queued tasks, backend progress, frontend receipts, recent events, diff state, endpoint reachability, and realtime connectivity. HTTP debugger records include selected transport and negotiated protocol.

## HTTP/3 and 103 client requirements

Pycore's common Laravel transport is `pycore/pyutils/laravel/transport.py`. It selects one transport before sending a request, preventing an unsafe retry of non-idempotent POST requests on a second transport. It also translates requests-style multipart uploads into `CurlMime`, so audio and media uploads retain the same HTTP/3 gateway.

Browser-facing API code uses `core/network/ProtocolFetch.ts`. Wordnew, the Laravel integration, Mercure setup, and network capability probes reuse this fetch layer. Browser and streaming requests record bounded protocol observations using Resource Timing when the runtime and server timing policy expose them. Android non-streaming HTTPS API requests use the same interface but dispatch through the local Capacitor `ProtocolHttp` plugin and record Cronet's `UrlResponseInfo.getNegotiatedProtocol()` value.

The Fetch API does not surface an interim 103 response as an application response. Browsers consume Early Hints during navigation/resource loading. UI code therefore records the negotiated protocol but does not invent a false `response.status === 103` check.

The repository uses Capacitor 8.4.2 and contains the generated project at `native/wordnew/android`. The installed `CapacitorHttp` implementation still delegates to Java `HttpURLConnection`, so it remains disabled. Wordnew instead registers the app-local `ProtocolHttpPlugin` from `MainActivity`. The plugin uses Google Play Services Cronet 18.1.1, enables QUIC, HTTP/2, and Brotli once per application process, preserves WebView cookies, supports request cancellation and redirects, and reports the negotiated protocol with every final response.

Mercure/SSE remains on Chromium WebView fetch because it requires a streaming response body. If the Cronet provider cannot initialize, `ProtocolFetch` falls back only before a request is sent; it never replays an ambiguous non-idempotent request through a second transport. 103 Early Hints remains transport-managed on both paths and is not surfaced as a business response. The native source integration is complete, but this audit does not claim an APK build or Android-device HTTP/3 negotiation.

## Acceptance state

| Requirement | State | Evidence |
| --- | --- | --- |
| Default remote Laravel endpoint | Implemented and live | Legacy implicit default migrated; Queue snapshot reports `https://api.si.12gm.com` reachable |
| Pycore transactional HTTP/3 | Implemented and live | Read-only probe reports `curl_cffi`, `HTTP/3`, `http3=true` |
| Multipart audio upload over shared gateway | Implemented and live | Previously retrying task completed with backend upload and result accepted |
| Word audio generation/report | Implemented and live | Edge task completed and Laravel accepted the upload |
| Sentence generation/report | Implemented and live | Qwen sentence task completed with cached playable audio |
| English-first plus explicit head override | Implemented | Laravel claim query and queue receipt path inspected |
| Offline generation and deferred upload | Implemented; prior restart behavior observed | Durable cache-backed outbox now decouples synthesis from parallel upload/result delivery |
| Detailed durable history and cache playback | Implemented and live | History metadata and protected audio resource were queried |
| Mercure relay groups over HTTP/3 | Implemented and live | Public hub auth returned the HTTPS hub; an authenticated SSE stream returned 200 over HTTP/3 |
| Browser/Capacitor protocol layer | Implemented | Shared fetch dispatches browser/SSE traffic through Chromium and Android API traffic through Cronet |
| Android native Cronet transport | Implemented in source; device verification open | Native project registers `ProtocolHttpPlugin`; Cronet 18.1.1 is the current Google Maven release |
| End-to-end 103 visibility through outer proxy | Not proven | Server code emits 103; live HTTP/1.1 observation exposed only final 200 |

## Official references

- [curl_cffi HTTP/3 documentation](https://curl-cffi.readthedocs.io/en/stable/index.html)
- [curl_cffi advanced usage](https://curl-cffi.readthedocs.io/en/stable/advanced.html)
- [libcurl HTTP version selection](https://curl.se/libcurl/c/CURLOPT_HTTP_VERSION.html)
- [Capacitor HTTP API](https://capacitorjs.com/docs/apis/http)
- [Capacitor custom native Android code](https://capacitorjs.com/docs/android/custom-code)
- [Android Cronet overview](https://developer.android.com/develop/connectivity/cronet)
- [Android Cronet setup](https://developer.android.com/develop/connectivity/cronet/start)
- [CronetEngine.Builder](https://developer.android.com/develop/connectivity/cronet/reference/org/chromium/net/CronetEngine.Builder)
- [Cronet UrlResponseInfo](https://developer.android.com/develop/connectivity/cronet/reference/org/chromium/net/UrlResponseInfo)
- [Google Play Services CronetProviderInstaller](https://developers.google.com/android/reference/com/google/android/gms/net/CronetProviderInstaller)
- [Cronet UploadDataProvider](https://developer.android.com/develop/connectivity/cronet/reference/org/chromium/net/UploadDataProvider)
- [Chrome Early Hints](https://developer.chrome.com/docs/web-platform/early-hints)
- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
