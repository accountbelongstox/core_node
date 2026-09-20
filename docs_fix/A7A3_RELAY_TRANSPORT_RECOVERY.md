# A7A3 Relay transport recovery

## Findings

1. `LaravelAPI.requestLaravel` reduces every HTTP failure to `LARAVEL_HTTP_<status>` in its message. The response payload is retained but page error rendering discards it, so missing routes, unavailable devices, missing pairings and missing operations are indistinguishable in the supplied report. Do not infer the production 404 cause from this message alone.
2. Relay signed requests pass a scalar 30-second timeout to Requests. This also becomes the TCP connect timeout, including Mercure authorization. The existing 10-second subscriber connect limit applies only to the subsequent SSE request.
3. The reported `.ts` URLs are Vite development module requests. The shared Laravel API imports unrelated media and application contracts, and the event consumer imports the entire API module. Vite has no warmup configuration. This creates a cold module dependency waterfall; the report contains no timing evidence to attribute all latency to it.
4. A browser `ERR_QUIC_PROTOCOL_ERROR` after status 200 is a stream transport failure, not a successful subscription lifetime. Browser Fetch cannot select HTTP/2 via a request option. Repair/recovery must live in the stream and server transport configuration, without inventing a client HTTP-version flag.
5. Persisted selected device IDs are used before the authorized roster is reconciled. A removed device can trigger repeated pairing-create 404s; previous recovery handled pairing errors only. Validate selection against the shared roster before admission and bound repeat failures.
6. The shared API base URL can change without resetting Relay pairings, roster or the owner stream. An operation admitted on one coordinator can then be read from another, yielding 404. Fence work and invalidate coordinator-owned state on the existing base-URL change event.
7. Browser SSE has no connection or idle-read deadline, and a complete event descriptor may be overwritten by reordered notifications. Stream recovery must remain bounded and operation reconciliation must preserve revision order.
8. Domain proxy generation has no delayed stream shutdown policy. Add the same contract-driven policy to the existing shell and PHP renderers, while retaining HTTP/3 support. This mitigates reload-triggered stream churn; the supplied QUIC trace alone does not establish a reload as its cause.

## References

- https://vite.dev/guide/performance
- https://caddyserver.com/docs/caddyfile/options
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#streaming

## Workflow

Record findings before code changes; inspect Relay route/error paths, shared stream recovery and deployment. Do not execute tests, builds, services or verification commands.

## Implemented

- Extracted `LaravelRequest.ts` as the shared JSON/error boundary and `LaravelRelayAPI.ts` as the Relay-only API. The existing aggregate reuses these methods; no second Relay implementation was added. Errors preserve domain code, status, path and server-localized message, including failed binary transfers.
- Admission consumes the shared authorized roster and stops before pairing creation when the selected device is missing or offline. A missing selected device does not silently redirect an action to another machine. Cached roster failures bound repeated requests, while presence and reconnection refresh the roster.
- The existing shared-base-URL event resets coordinator-owned state and fences pending operations. Initial endpoint selection preserves the existing preferred device; actual coordinator changes clear it.
- Shared browser SSE now bounds connection establishment and idle reads, releases timers/readers, logs transport failures and adds reconnect jitter. Operation reconciliation ignores older revisions.
- Signed Python Relay HTTP calls use separate connect/read timeouts. Subscriber authorization uses the existing 10-second contract limit for both phases; networking failures retain backoff and do not replay ambiguous operations.
- Vite warms the API, request boundary and Relay stream entry modules. The stream and roster no longer import the aggregate application API.
- Domain proxy templates in shell, PHP and PowerShell share `realtime.mercure_proxy_close_delay`. HTTP/3 remains enabled. This is a reload-churn mitigation, not proof that the observed QUIC failure was caused by reload.

## Evidence boundary

The supplied report lacks the HTTP method/path/body for each 404 and a QUIC/network trace. Existing local Laravel logs contained no matches for the inspected Relay domain errors. The production 404 subtype, TCP reachability failure and QUIC root cause therefore remain unconfirmed.

No Git operations, tests, builds, deployment scripts, service restarts or runtime verification were executed. Code changes and documentation are complete for the identified defects; production acceptance still requires authenticated Relay completion, screenshot delivery, sustained SSE and browser module timing evidence. Caddy and Vite configuration changes require their normal runtime reload/restart path to take effect.
