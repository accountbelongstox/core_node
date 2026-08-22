# Pycore UI Relay Groups and HTTP/3 — Part 3: Implementation Record

Original design date: 2026-08-17 21:15  
As-built audit: 2026-08-21

## Outcome

The former phase checklist has been replaced by this implementation record. The relay plane, shared queue workers, durable history/cache, remote-first endpoint selection, realtime updates, HTTP/3 transaction transport, and UI protocol diagnostics exist in current source. Remaining limitations are listed explicitly rather than represented as unchecked historical plan items.

No FrankenPHP installation, deployment, or Laravel Manager implementation was modified in this audit because those components were already complete.

## Shared contracts and ownership

`config/service_contract.json` owns server-plane versions, ports, protocol configuration, Mercure ownership, and the Early Hints preload link.

`config/queue_center_contract.json` owns queue, relay, topic, machine, pairing, heartbeat, TTL, endpoint, and capability names.

Feature code consumes these contracts. It does not carry parallel port tables or a second realtime protocol vocabulary.

## Laravel implementation

The relay domain is centralized under `poly_apps/laravel_main/app/Services/Relay/`:

- `RelayRequestStore` persists requests and responses;
- `RelayPairRegistry` owns pairing state;
- `RelayMachineRegistry` owns registration and liveness;
- `RelayHubPublisher`, `RelayHubKeyProvisioner`, and `RelayHubJwt` own Mercure integration;
- `RelayHubAuthService` owns subscriber authorization;
- `RelayDispatcher` owns routing;
- `RelayCapabilityRegistry` owns supported capability declarations;
- `RelayBlobStore` owns bounded binary payloads.

`poly_apps/laravel_main/routes/api/relay.php` binds these services to protected dashboard and machine routes.

The global audio queue uses explicit queue-position overrides first. Without an override, sentence claims prioritize English work before other languages. Wordnew-triggered audio requests pass through the unified Laravel gateway and return a structured queue receipt containing head-adjustment, position, progress, and ETA fields.

The existing FrankenPHP Caddyfile builder emits the public `h1 h2 h3` server configuration, HTML-only 103 Early Hints, and the Mercure topology.

## Pycore implementation

### Queue runtime

`pycore/pyctl/queue_center/` owns snapshots, lane registration, lifecycle controls, and task-center sections. Workers publish compact state instead of making the UI reconstruct backend lifecycle from log text.

Queue Center reads the cached aggregate TTS status and never starts a cold all-engine scan from the snapshot request. Qwen capability discovery is populated by the asynchronous engine warm-up and snapshot reads use only its cached value. This keeps UI polling independent from model startup and synthesis locks.

`pycore/pyutils/common/diff_task_segments.py` owns persistent diff segments. `has_pending()` prevents an unchanged remote diff from discarding an unacknowledged priority instruction. `move_to_head()` applies the backend directive to the shared ordered queue.

`pycore/pyctl/tts/laravel_audio_worker.py` is the common persistent kernel for word, sentence, and composed article work. It owns:

- ordered admission and explicit head moves;
- bounded parallel execution through shared task groups;
- provider selection and engine provenance;
- local word and sentence cache lookup;
- synthesis progress stages;
- atomic staging into the shared audio-delivery outbox;
- independent parallel multipart audio reporting;
- independent Laravel global-result reporting;
- bounded retry scheduling without occupying synthesis lanes;
- restart recovery, monotonic delivery checkpoints, and explicit dead-letter retry.

`pycore/pyutils/tts/audio_delivery_outbox.py` is the single durable delivery repository for both worker lanes. Rows contain the cached path, engine provenance, task attempt, selected Laravel endpoint, distinct domain-delivery/domain-success checkpoints, result-acceptance state, history-persistence state, retry schedule, and a process-aware lease. A terminal domain 4xx no longer blocks the audio-bearing global result fallback. Result acceptance is persisted before local history, and history uses a stable delivery-derived record identifier before final outbox removal. `ui/queue_center/retry_audio_delivery` is the common diagnostic/control surface. Queue Center shows pending domain uploads, terminal results, history writes, dead letters, and whether a delivery group is running.

Sentence synthesis reuses the managed Qwen service also used by Agent History. Single sentences enter the sentence queue directly. Articles are split into sentences and composed, while history retains the multi-sentence marker.

### History and cache

`pycore/pyctl/task_history/` and `pycore/pyutils/common/task_history_repository.py` own durable history. Records are searchable by task ID, content ID, engine, path, and detail. They include progress, engine, cache, composition, upload, and result-acceptance fields.

`pycore/pyctl/task_history/archive.py` owns bounded completed-task cache metadata. `task_history/service.py` exposes cached audio only when the resolved file remains inside the managed cache root and has an allowed audio extension.

### Laravel transport

`pycore/pyutils/laravel/client.py` is the single Pycore-to-Laravel gateway. `pycore/pyutils/laravel/transport.py` owns protocol selection and payload adaptation:

- HTTPS transactional requests and Mercure SSE prefer `curl_cffi` with `http_version=\"v3\"`;
- SSE retains reconnect, JWT refresh, Last-Event-ID resume, and bounded read behavior in the shared subscriber;
- the transport is selected before sending, so POST is never replayed merely to change protocol libraries;
- requests-style form fields and files are converted to one native `CurlMime` body;
- transport and negotiated protocol are sent to the common HTTP recorder.

`curl_cffi>=0.12,<1` is declared in the Python package policy. Version 0.16.0 was installed in the audited runtime.

The read-only route `ui/assist/laravel_transport_probe` executes the normal Laravel client path and returns endpoint, status, selected transport, negotiated protocol, and an HTTP/3 boolean. It is a diagnostic surface, not a separate probe implementation with different networking behavior.

The endpoint repository records whether `current` came from an explicit user selection. Legacy unmarked HTTP defaults migrate to the configured HTTPS API, while future explicit selections remain persistent. Relay registration follows the active resolved endpoint rather than a stale stored value.

## UI and Wordnew implementation

`poly_apps/pycore_laravel_wordnew_ui/core/network/ProtocolFetch.ts` is the common browser/WebView/native request path. It owns:

- one HTTP transport policy;
- standard Fetch dispatch for browsers and streaming SSE;
- Android HTTPS API dispatch through an app-local Cronet plugin;
- browser, Capacitor WebView, and Capacitor Cronet runtime identification;
- bounded Resource Timing or native negotiated-protocol observations;
- subscription and snapshot access for diagnostics.

It is reused by:

- `core/network/api-client/MasterApiClient.ts`;
- `core/integrations/laravel/transport/BaseAPI.ts`;
- `core/integrations/laravel/LaravelMercureConnection.ts`;
- `apps/wordnew/api/WfNewApiTransport.ts`;
- `apps/wordnew/api/WfNewAdminApi.ts`;
- `apps/wordnew/platform/capabilities/CapNetwork.ts`.

The Pycore HTTP debugger displays the recorded transport and protocol. Queue Center displays worker and frontend progress, backend upload state, priority receipts, and ETA information. Shared route constants connect the UI to the transport probe and protected cached-audio resource.

Capacitor HTTP patching remains disabled because its installed Android implementation uses `HttpURLConnection`. The existing `native/wordnew/android` project instead registers `ProtocolHttpPlugin` from `MainActivity` and depends on Google Play Services Cronet 18.1.1. Non-streaming HTTPS API requests use Cronet with QUIC/HTTP2 enabled; Mercure/SSE remains on Chromium WebView. The shared TypeScript layer falls back only on provider initialization failure before send, exposes final responses as standard `Response` objects, and records Cronet's negotiated protocol. Both native and WebView transports consume 103 internally.

## Live verification record

The following checks used actual running services rather than mocks:

- Queue Center UI assets were served from `http://127.0.0.1:13054/pycore-manager/queue-center`.
- Pycore RPC was queried at `http://127.0.0.1:59000/api/...`.
- The snapshot reported Laravel reachable at `https://api.si.12gm.com` and realtime connected.
- The transport probe completed `/api/health` with status 200 over `curl_cffi` and HTTP/3.
- Public hub authorization returned `https://api.si.12gm.com/.well-known/mercure`; an authenticated Mercure SSE connection returned status 200 with libcurl HTTP version 30 (HTTP/3) and remained open until the six-second diagnostic timeout.
- After the final process reload, the live Queue Center snapshot reported the HTTPS default and `realtime_detail=... transport=curl_cffi protocol=HTTP/3`; 37 persisted sentence tasks remained queued and one was processing.
- A Wordnew-prioritized sentence task (`task_e81b8e52-…`) moved through received, processing, and completed states using Qwen3-TTS.
- Its cached MP3 resource returned 200 and 11,756 bytes; an attempted path outside the cache root was rejected.
- A word-audio task completed using Edge and Laravel accepted its upload.
- After the HTTP/3 transport was introduced, live verification found multipart uploads retrying because `curl_cffi` does not accept the requests-style `files` argument. The shared transport was corrected to use `CurlMime`; the same previously blocked task (`task_014950bf-…`) then emitted `upload_done` on its first post-reload attempt and completed with `backend_upload=ok; result=ok`.
- Agent History contained 1,187 records in the audited snapshot, including 1,030 cached audio records and 322 multi-sentence records; reported records were uploaded.
- Qwen work from Queue Center and Agent History coexisted in the managed queue and continued to progress.
- During a natural Laravel synchronization restart, Pycore retained work and later uploaded results when Laravel returned.
- The public response advertised `h3` through Alt-Svc and identified FrankenPHP/Caddy.
- After the final hot-reload window, three consecutive Queue Center snapshots completed in 205–323 ms while the live word and sentence queues contained 23 and 73 tasks respectively.
- In the 2026-08-21 continuation audit, the Queue Center page and the transformed `ProtocolFetch.ts`/delivery-status modules were served from port 13054, and the public Laravel health and Queue Center overview endpoints returned 200. The overview reported 513 pending word-audio rows and 545 pending sentence-audio rows.

No test suite or application build was run, in accordance with repository rules. Verification used live API requests, served-module inspection, and current source inspection.

## Open verification boundaries

- No controllable in-app browser session was available, so visual interactions and transient progress rendering were not click-tested.
- During the 2026-08-21 continuation probe, the local Pycore RPC listener on port 59000 was not running and Laravel reported both Pycore audio workers offline. The new outbox checkpoints and retry controller therefore remain source-verified but were not exercised in that process state.
- The native Android project and Cronet integration are present, but no APK build or Android device was available; device-level HTTP/3 negotiation remains unverified.
- The deployed HTML request did not expose an interim 103 through the observed outer proxy path. Source and generated configuration support 103, but proxy-by-proxy delivery still requires deployment-level capture.
- Authenticated relay pairing was inspected end to end in source but was not mutated during this audit because doing so would create external pairing state.

## Official references

- [RFC 8297 — 103 Early Hints](https://www.rfc-editor.org/rfc/rfc8297.html)
- [FrankenPHP Early Hints](https://frankenphp.dev/docs/early-hints/)
- [FrankenPHP Mercure](https://frankenphp.dev/docs/mercure/)
- [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)
- [curl_cffi API](https://curl-cffi.readthedocs.io/en/stable/api.html)
- [curl HTTP/3](https://curl.se/docs/http3.html)
- [Capacitor HTTP](https://capacitorjs.com/docs/apis/http)
- [Capacitor custom native Android code](https://capacitorjs.com/docs/android/custom-code)
- [Android Cronet overview](https://developer.android.com/develop/connectivity/cronet)
- [Android Cronet setup](https://developer.android.com/develop/connectivity/cronet/start)
- [Cronet UrlResponseInfo](https://developer.android.com/develop/connectivity/cronet/reference/org/chromium/net/UrlResponseInfo)
- [Google Play Services CronetProviderInstaller](https://developers.google.com/android/reference/com/google/android/gms/net/CronetProviderInstaller)
- [Cronet UploadDataProvider](https://developer.android.com/develop/connectivity/cronet/reference/org/chromium/net/UploadDataProvider)
