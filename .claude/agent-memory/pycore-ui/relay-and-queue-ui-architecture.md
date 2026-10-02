---
name: relay-and-queue-ui-architecture
description: Where relay/transport and Queue Center hub logic lives after the 2026-10-02 audit (schema gate, hub slices, relay errors, health in relay mode)
metadata:
  type: project
---

- Server schema gate (contract `queue_center_contract.json schema_gate`): one owner `core/integrations/laravel/ServerSchemaGate.ts` (fed by ApiManager health `schema` field, `readLaravelResponse`/BaseAPI 503 `SERVER_SCHEMA_PENDING`; probes health every `retry_after_seconds` while pending). UI reads it with `useServerSchemaGate`; pycore-manager shows `PcServerSchemaNotice` (also when a lane assist reports the code). wordnew has its own `WordNewServerGate.ts` with the same API shape (candidate to delegate to the shared one).
- Queue Center hub (`hooks/useQueueCenterHub.tsx`) reads two slices: pycore snapshot (refreshed by pycore topics) and Laravel slices (refreshed by Laravel Mercure `queueChanged`/`workerPresence`/reconnect, 30 s poll only while that stream is down). Hub `error`/`sliceErrors` hold CODES, localized by `pcErrorCodeText`.
- Relay failures: `PycoreRelayError.message` is already localized (`common.relay_*` in `shell/shellTranslations.ts`); `pcCaughtErrorMessage` never returns raw error text (relay error, PcLocalizedError, or `errorCodes.<code>`).
- Relay mode health: `PycoreHealth` must not treat the Laravel hub stream as proof the device is alive; it uses the designated device presence (roster) and a 30 s ping ceiling.
- Relay read policy: POST routes whose policy `delivery` is `read` are single-flight coalesced and re-sent once if the stream dropped mid-call (lost answer frame).
- Over the relay the device caps execution at min(50 s, route policy timeout, 30 s default): long compute routes need their own policy profile (backend/contract change).

**Why:** audit found the UI polling Laravel on every pycore push, reporting a dead relay device as healthy, and showing raw RELAY_* text.
**How to apply:** extend these owners instead of adding parallel paths; new route policy or error code goes through the contracts first.
