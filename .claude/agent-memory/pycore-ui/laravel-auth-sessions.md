---
name: laravel-auth-sessions
description: Per-Laravel-API login sessions (core/auth/AuthSession.ts) and the shared login module in shared/auth; how tokens are scoped and who owns what
metadata:
  type: project
---

Sessions live in `core/auth/AuthSession.ts`, keyed by API namespace (`authNamespaceOf(baseUrl)`), aliased to `server:<id>` when the endpoint's /health `server_id` matches another (ApiManager.checkEndpoint registers it). `setSharedBaseURL` (BaseAPI) sets the active namespace; BaseAPI picks the token by the REQUEST's target base (never the active one), so probes/fixed modules cannot leak tokens. Shared login UI: `shared/auth/` (LaravelLoginHost/Modal/AuthChip, ns `laravelAuth`); login/register/profile client: `core/integrations/laravel/LaravelAuthClient.ts`. Lm UserModel/UnifiedAppContext derive user from the store (`useAuthSnapshot`).

**Why:** web builds carry no client key, so Laravel routes need a user login, per API, with several APIs logged in at once.
**How to apply:** use `requestAuthLogin({ baseUrl })` for 401s of a fixed API (mesh guide uses MESH_GUIDE_API_ORIGIN); read login state with `useAuthSnapshot(baseUrl?)`; never add a parallel token store. Pc header endpoint select also switches the browser endpoint (laravelApi.switchEndpoint) so auth follows the header.
