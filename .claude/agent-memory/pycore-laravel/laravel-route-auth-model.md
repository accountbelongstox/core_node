---
name: laravel-route-auth-model
description: Binding auth model for laravel_main routes since 2026-09-27 - machine callers use the shared client key, never web login
metadata:
  type: project
---

Since 2026-09-27 (user directive D1, requirements `docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` §5), routes are gated as follows:
- Machine callers (pycore, ncore, mcp-chrome native host, peer Laravel as `laravel_peer`) sign requests with the shared secret-store key (K3) → `client.key`.
- Routes that the browser UIs also call → `client.key_or_dashboard`. The browser never holds the key (K6).
- Operator routes → `dashboard.auth`, which requires admin by default. Use `:super_admin` for credentials, restore and import, and `:user` for self-service. The self-service actions in routes/web.php (immutable) are allow-listed inside the middleware.

**Why:** The user ruled that anything unsuited to web login uses key authentication and must never become login-only.

**How to apply:** Put every new Laravel route into one of these classes, and read the header names, skew and error codes from `config/service_contract.json#client_key_auth`. The table of record is `.claude/agents_shared/client_key_auth/laravel_route_auth.md`. Related: [[verify-in-process-without-writes]].
