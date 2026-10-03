---
name: laravel-server-ops-facts
description: Non-obvious facts for debugging the live Laravel server (log location, DB timezone trap, what deploys Caddy/Mercure config, Mercure CORS rules)
metadata:
  type: reference
---

- Laravel daily logs on the server are `/www/wwwroot/laravel_db/logs/laravel-YYYY-MM-DD.log` (LOG_CHANNEL=syslog; `storage/logs/laravel.log` is stale). The log API `logs/latest?level=error` reads that dir.
- App DB timestamp columns (`tts_lease_expires_at` ...) hold UTC while server psql `now()` is CST (+8): compare with `now() at time zone 'utc'`, otherwise live leases look like 0.
- Auto code-sync (every 10 min, `laravel_signed_cli.js history`) reloads PHP workers only; Caddyfile/Mercure `cors_origins` come from `web_access_config.json` rendered by `web_access_common.sh` and are applied only when the FrankenPHP runtime restarts (step 175 / rescue restart).
- Mercure hub (0.24.2) rejects a whole preflight (no ACAO) for an Origin not in `cors_origins` (exact scheme+host+port) or for any request header besides Authorization, Cache-Control, Last-Event-ID. The dev app page origin is `http://127.0.0.1:13055` (contract `ports.native_live_reload`), the release app's is `https://localhost`.
- `client.key_or_dashboard` routes (worker/register) answer 401 "Unauthenticated / AUTH_REQUIRED" when no `X-Core-Node-Signature` header is sent, and 401 with `error_code client_key_*` when a signature is present but wrong.
- Work-lease claim: languages of a lane used to be served in declared order, so a big en backlog starved zh; claim now has a per-language share pass first (`WorkLeaseService::languageShares`).

**Why:** learned while debugging book-plan audio on 2026-10-03; each cost real time to rediscover.
**How to apply:** check these before concluding a server symptom is a code bug.
