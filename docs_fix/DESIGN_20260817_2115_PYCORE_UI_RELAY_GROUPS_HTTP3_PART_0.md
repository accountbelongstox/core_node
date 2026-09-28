# Pycore UI Relay Groups and HTTP/3 — Part 0: FrankenPHP Server Plane

Original design date: 2026-08-17 21:15  
As-built audit: 2026-08-21

## Status

Complete in the current codebase. This document records the implementation that exists in code; it is no longer an implementation plan. No FrankenPHP installer, deployment, or server-manager source was changed during the 2026-08-21 audit.

The standardized informational response is **103 Early Hints**. HTTP 301 is a permanent redirect and is not an Early Hints protocol.

## Authoritative implementation

The shared service contract is `config/service_contract.json`. It defines:

- public HTTP and HTTPS ports 80 and 443;
- the Caddy admin port 2019;
- the Pycore UI development port 13054;
- `frankenphp` as the default Laravel server plane;
- FrankenPHP `v1.12.7` and Mercure `v0.24.2` build inputs;
- the UI Early Hints preload link;
- local Mercure ownership.

The Debian installation entry is `scripts/shells/linux/debian/install_shells/93_install_frankenphp.sh`. It delegates reusable work to the modules under `scripts/shells/linux/debian/install_shells/common/`, including:

- `frankenphp_install_pipeline.sh` and its focused pipeline modules;
- `frankenphp_install_modes.sh`;
- `frankenphp_static_builder.sh`;
- `frankenphp_manager.sh`.

The static build is assembled through xcaddy with the required Mercure module and the configured optional modules. Installation and repair are split into small file/package/service operations rather than guarded by one coarse completed flag.

`common/frankenphp_manager.sh` owns the generated runtime configuration. The resulting Caddy HTTP server enables `h1 h2 h3`, owns the local Mercure hub, and emits the configured preload Link as a 103 response for HTML requests before continuing the normal handler chain.

The Laravel Manager renders the same topology through:

`poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1FrankenPhpCaddyfileBuilder.php`

Its reverse-proxy handler emits 103 only when `Accept` matches HTML, then continues to `reverse_proxy`. JSON APIs do not receive pointless Early Hints. Direct application upstream traffic remains an internal transport detail; public clients negotiate HTTP/1.1, HTTP/2, or HTTP/3 at the HTTPS edge.

## Realtime plane

The built-in Mercure hub is the single realtime plane. Reverb is not a compatibility transport. Browser subscribers use Mercure SSE, while authenticated server-side publishers post updates to the hub. Hub keys and URLs are provisioned through the existing Laravel and server-manager configuration rather than duplicated in UI code.

## Runtime evidence

The 2026-08-21 live audit observed the public endpoint `https://api.si.12gm.com` returning:

- `Server: FrankenPHP Caddy`;
- `Alt-Svc: h3=\":443\"`;
- a successful HTTP/3 health transaction from Pycore through `curl_cffi`/libcurl.

The Pycore read-only transport probe reported `transport=curl_cffi`, `http_version=HTTP/3`, and `http3=true` for `/api/health`.

A separate HTTP/1.1 HTML request reached the deployed page but did not expose an interim 103 response to the client. The code path and generated Caddy semantics are present, but this audit does not claim end-to-end 103 visibility through every outer proxy. That deployment observation must remain distinct from code completion.

## Protocol boundaries

- 103 is emitted only for useful navigation/preload responses.
- HTTP/3 is negotiated at HTTPS edges; local Pycore RPC on loopback is not mislabelled as HTTP/3.
- Mercure remains SSE downstream plus HTTP POST publication; it is not WebSocket compatibility code.
- Protocol fallback is negotiated below business clients and is recorded for diagnostics.
- Server-manager and shell renderers consume the shared contract so ports, versions, links, and ownership are not copied into feature code.

## Official references

- [RFC 8297 — 103 Early Hints](https://www.rfc-editor.org/rfc/rfc8297.html)
- [Caddy HTTP app protocols](https://caddyserver.com/docs/modules/http)
- [Caddy `respond` directive](https://caddyserver.com/docs/caddyfile/directives/respond)
- [FrankenPHP production and HTTP/3](https://frankenphp.dev/docs/production/)
- [FrankenPHP Early Hints](https://frankenphp.dev/docs/early-hints/)
- [FrankenPHP Mercure](https://frankenphp.dev/docs/mercure/)
- [Mercure protocol specification](https://mercure.rocks/spec)
