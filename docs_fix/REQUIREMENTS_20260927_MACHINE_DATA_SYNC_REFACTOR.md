# Machine Data Synchronization Refactor (Laravel Main + Laravel Manager UI)

Supersedes the conflicting parts of `FIX_20260815_LARAVEL_MAIN_MACHINE_DATA_SYNC.md` (multi-outbound sessions, purge-on-terminal, per-request inventory/manifest computation, address normalization).

## Scope

- UI: Laravel Manager → Database Manager → "Machine Data Synchronization" tab (`apps/laravel-manager/components/views/database-manager/DataSyncTab.tsx`, `models/DataSyncModel.ts`).
- Backend: `poly_apps/laravel_main/app/Services/DataSync/*`, `DataSyncController`, `routes/DashboardRouter/DatabaseManager.php`, `DataSyncTask` (Octane timer; on FrankenPHP it is driven by `schedule:work` → `octane-timer-heartbeat`).

## Measured facts (2026-09-27)

- Local node (behind NAT) and `api.si.12gm.com` (public server, machine code `2c7dee05…`) both answer protocol 4. Local cannot be reached from the server, so server → local data flows in pull mode (local = fetcher, server = exporter).
- `https://api.si.12gm.com` was normalized to `https://api.si.12gm.com:9000`, which never answers; the session waited forever at `probe_peer_health`.
- Server `GET …/export-sessions/{id}/database-inventory` took 306 s (local 18 s). The peer client times out after 60 s, so pull mode never passed `fetch_exporter_database_inventory`. Cause: the exporter recomputed the inventory per request, and `DatabaseManagerService::structure()` re-lists every table per call (O(n²) over 456 AppQyV1 tables).
- Resource roots: `static` 39,754 files / 4.7 GB; manifests SHA-256 every file on every call (build, snapshot, peer request, verify).
- Driver cancel never reached the peer. The server-side exporter/receiver stayed active, and `prepareExporter` rejected every later fetcher ("already has an active synchronization session") with no expiry.
- Terminal sessions were purged on save, so a cancelled or completed session vanished (404) and the UI lost its final state. A stale protocol-3 session file survived and made the whole local workspace report "protocol mismatch".
- Inventories and manifests were stored inside the session JSON (4–15 MB), which was rewritten on every chunk.

## Binding requirements

1. **One session, one task.** Each node has at most one active session. Starting a new driver session (push or pull) cancels every other active local session. A session is never reused after reaching a terminal state; running again creates a new session.
2. **Cancel works end to end.** Cancelling a driver records the cancel flag, finishes the local session as `cancelled`, and propagates a token-authenticated cancel to the peer session. Passive sessions (receiver/exporter) also end on their own when the driver is idle longer than `PASSIVE_IDLE_SECONDS`. A new prepare supersedes a passive session whose driver has been idle longer than `PASSIVE_SUPERSEDE_SECONDS`.
3. **Pause/resume.** Paused drivers send a keepalive status call every `KEEPALIVE_SECONDS`, so the peer never expires them.
4. **Passive work runs in the passive node's own timer, never in a request.** The exporter builds the database inventory and resource manifests in its ticks, persists them as session artifacts, and serves the stored snapshots. Peer requests only read artifacts, row chunks, or file chunks.
5. **Inventory is O(tables).** Columns, identity indexes, foreign keys, and row counts come from bulk PostgreSQL catalog queries per connection.
6. **Manifests are incremental.** A persistent per-root hash cache keyed by (path, size, mtime) avoids rehashing unchanged files.
7. **Large data lives outside the session state.** Inventories, manifests, and resource plans are per-session artifact files. Session JSON stays small. Artifacts, incoming parts, archives, and receipts are removed when the session ends.
8. **Terminal sessions stay visible.** Completed, failed, and cancelled sessions are kept in compact form (latest `TERMINAL_RETENTION` per node). Sessions with another protocol version are removed, not surfaced as UI errors.
9. **Address normalization.** A bare host or IP uses `http` and port `9000`. An explicit scheme without a port uses that scheme's default port (`https` → 443, `http` → 80). An explicit port is kept.
10. **Schema compatibility is per table.** Tables whose structure or identity differs, or that are missing on the writer, are skipped. Each skipped table is recorded with its reason in the session's `database_results.skipped`, and the remaining tables continue. Row-count verification covers the synchronized tables only.
11. **Idempotency.** DB rows are merged additively by primary key, else by first unique index, else by exact-row existence. Resource files are committed only after their SHA-256 matches, and files already present with the same hash are skipped. Re-running the same sync converges without duplicates.
12. **Remote testing rule.** Never test a "remote machine" through loopback or LAN addresses (127.0.0.1, 192.168.x.x, and similar); those are this machine. The remote peer for testing is `api.si.12gm.com`. Code edits reach the server by the periodic code sync; the protocol version in `/sync-peer/health` shows whether the server runs the new code.
13. **Final acceptance.** Pull `api.si.12gm.com` → local (databases + resources), idempotently. A second run reports only `unchanged` rows and no transferred files.

## Protocol 5 changes

- `POST sync-peer/sessions/{id}/cancel` and `POST sync-peer/export-sessions/{id}/cancel` (token header) end the passive session.
- Session status adds `cancelled`.
- `/health` exposes `protocol_version = 5`.
