# Pycore HTTP Logging and Heartbeat UI Removal

## Scope

- Removed the Queue Center Heartbeat Workers card and its browser state.
- Removed the public `ui/heartbeat_workers/status` and `ui/heartbeat_workers/config` routes.
- Removed the unused heartbeat worker preference and route service modules.
- Removed legacy migration-script templates that could regenerate the deleted routes.
- Preserved the internal Pycore scheduler because translation, audio, maintenance, and worker callbacks depend on it.
- Removed the heartbeat display scope from the central Queue Center contract and advanced the schema to version 7.

## Centralized HTTP logging

The existing Pycore HTTP protocol middleware now owns all request logging, response timing, and Private Network Access headers. It emits:

- a green log when an HTTP request is received;
- a gray log containing the method, route, status code, and response duration when response headers are ready.

This covers protocol routes, RPC routes, FastAPI routers, static mounts, and preflight requests without per-route implementations or an additional middleware wrapper.

## Configuration boundary

No environment-variable configuration was introduced. Existing code and persisted user settings remain the configuration sources.

## Validation policy

No tests, builds, or services were run, as required by the repository instructions.
