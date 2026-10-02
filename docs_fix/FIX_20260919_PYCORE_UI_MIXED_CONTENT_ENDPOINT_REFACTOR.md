# FIX 2026-09-19 — pycore-manager: mixed-content endpoint refactor + appearance widgets

Condensed 2026-09-29 (claude-opus-5-5): the work is completed and verified; per-file change lists and verification logs removed. The active behavior rules are kept below.

## Root cause (field-verified)

The persisted Laravel endpoint was `http://43.163.112.77:9000`. On an HTTPS page the browser blocks every plain-HTTP subresource before the network, so health probes and API calls never left the browser and the endpoint showed "offline" although `https://api.si.12gm.com` was healthy (200, CORS preflight 204).

## Active rules (`poly_apps/pycore_laravel_wordnew_ui`)

- `LaravelEndpoints.isEndpointMixedContentBlocked`: HTTPS page + plain-HTTP non-loopback endpoint = blocked (loopback stays fetchable).
- `ApiManager`: blocked endpoints are never fetched and report `MIXED_CONTENT_BLOCKED_ERROR`; a blocked persisted pin is kept in storage but a healthy endpoint is activated transiently for the secure context; `preselectEndpointSync` skips blocked endpoints.
- pycore-manager UI: blocked endpoints show an amber "blocked" state; appearance widgets (dark mode, language) live in the top bar and the Settings "Global" section.

## Update 2026-09-29

- `BackendApiEndpoint.basePath` + `endpointBaseUrl` (used by `buildApiUrl`, `endpointKey`, every endpoint display). An HTTPS `.ts.net` origin resolves the current-origin endpoint to the same host + `/laravel-api`, so tailnet pages stay HTTPS with the trusted tailscale cert. See `DESIGN_SHELL_HOSTS.md`
