# Laravel Main Machine Data Synchronization

## Scope

This change adds directional synchronization from Laravel Main node A to node B through the Laravel Manager Database Manager page.

- An address without a port uses port `9000`; an explicit port is preserved.
- The receiver address is optional when a source session is created. With no address, the backend collects the complete local database/resource manifest and then waits persistently at the address-binding step.
- One UI can manage multiple active or paused outbound sessions to distinct Laravel Main receivers. A duplicate active target and a second address-less draft are rejected.
- A node receiving data remains globally exclusive: it cannot start outbound sessions, and it rejects incoming preparation while any outbound session is active. This prevents inbound writes from overlapping source reads on the same databases and resource roots.
- The UI starts, pauses, resumes, and observes work. The Octane timer owns execution.
- Session state and byte/row checkpoints are persisted below the mapped backup directory, so browser disconnects and backend restarts do not reset progress.
- B creates a `pg_dump` backup for every selected configured database before it becomes ready.
- Database synchronization is additive/directional: rows missing on B are inserted and rows with the same primary or unique identity but different content are updated. Rows existing only on B are not deleted.
- Resources cover Laravel static/uploads, avatars, TTS data, AppQyV1 external data, and the configurable AppQyV1 word-audio, sentence-audio, and word-image roots. `getStaticPath()` and `getUploadPath()` resolve to the same canonical Laravel data roots, so covers and posters written through those aliases are included without duplicate whole-root transfer.
- Uncompressed resumable file batches are the default. System 7-Zip is used only when the UI option is selected.
- The shared `SystemArchiveManager` owns cross-platform system 7-Zip discovery, archive creation, listing validation, and extraction. Existing dictionary extraction now reuses the same utility.

## Persistent protocol

The source first persists its local manifest. It then normalizes the optional target to `http(s)://host:port`, probes protocol version 2, creates a receiver session, and receives a session-scoped token. `POST /api/dashboard/db-manager/sync/{id}/target` binds an address to a manifest-only session without replacing its ID, options, progress, or checkpoints. A source-generated 256-bit preparation secret makes a lost prepare response retryable without allowing another caller to retrieve the active receiver token by repeating only the source job ID. The peer token protects subsequent session endpoints but is not a machine identity credential. The automatic prepare endpoint is intended for trusted networks and must be restricted by firewall or reverse-proxy policy when port `9000` is exposed outside that trust boundary.

Active outbound sessions are scheduled round-robin by the persistent Octane timer and serialized only by their own operating-system session locks. This keeps pause/resume and checkpoints independent for every receiver. The receiver side remains single-session because it mutates shared databases and resource roots. HTTP `502`, `503`, and `504` responses and connection failures remain retryable; definitive peer application errors fail only the affected source session instead of blocking every peer.

Every database chunk carries the source connection key, table, and encoded rows. The receiver selects the primary key, then the first unique index, as its idempotency identity. Tables without either identity use exact-row existence checks. Binary cells use an explicit base64 envelope.

Configured databases are deduplicated by physical connection signature rather than Laravel connection name, preventing two aliases of the same PostgreSQL database from being backed up and transferred twice. Database inventory validation compares the connection driver, column type/nullability/generated attributes, and identity indexes. Tables are ordered by their foreign-key dependencies so referenced rows are transferred before dependent rows. JSON and JSONB values are canonicalized before post-write row verification to avoid false differences caused only by object-key formatting. Row chunks are capped by both row count and encoded byte size.

Every resource root is compared by relative path, byte size, and SHA-256. In default mode, each different file is transferred in fixed-size chunks and committed only after its full hash matches. In optional compression mode, the difference list is archived through the shared system 7-Zip manager and the archive is transferred in resumable chunks; the receiver validates the archive hash and its entry paths before extraction.

The initial local manifest is refreshed once after target binding to create current database and resource transfer snapshots. This catches schema/file changes made while the session was waiting for an address without repeatedly rescanning resources on network retries. Large immutable resource manifests and file lists are then persisted once as a separate transfer plan. The frequently updated session state contains only the current plan index and byte offset. Lightweight summary sidecars exclude internal manifests, filesystem paths, preparation secrets, and peer tokens from UI polling responses.

## Source workflow steps

1. Validate the synchronization request.
2. Acquire the source session lock.
3. Create the persistent source session.
4. Discover source databases.
5. Discover source tables.
6. Select primary or unique identity keys.
7. Count source rows.
8. Discover canonical resource roots.
9. Build source resource manifests and publish the local manifest summary.
10. Normalize the peer address and apply port `9000` when absent; wait here when no address is bound.
11. Probe peer health.
12. Negotiate the protocol version and optional 7-Zip capability.
13. Create the receiver session.
14. Wait for the receiver lock.
15. Refresh the source database inventory and discover receiver databases.
16. Validate database compatibility.
17. Wait for receiver backups.
18. Record the receiver backup directory.
19. Discover receiver tables.
20. Validate table structures.
21. Initialize database checkpoints.
22. Transfer database row chunks.
23. Apply database differences on B.
24. Advance PostgreSQL sequences on B.
25. Verify database row coverage.
26. Verify database row digests applied by the receiver.
27. Refresh the source manifests and fetch receiver resource manifests.
28. Calculate resource differences.
29. Prepare uncompressed batches or optional system 7-Zip batches.
30. Initialize resource byte checkpoints.
31. Transfer resource chunks.
32. Verify received payload hashes.
33. Apply received files or extract the optional archive.
34. Rebuild and verify receiver resource manifests.
35. Finalize the receiver session.
36. Release the receiver session lock.
37. Finalize the source session.
38. Release the source session lock.
39. Publish final progress.
40. Complete the session.

## Receiver workflow steps

1. Accept the peer session.
2. Acquire the receiver single-session lock.
3. Discover receiver databases.
4. Back up receiver databases one at a time.
5. Record the mapped backup directory.
6. Prepare the database receiver.
7. Prepare the resource receiver.
8. Become ready for transfer.
9. Receive database chunks.
10. Apply database differences.
11. Receive resource chunks.
12. Verify resource payloads.
13. Apply resource payloads.
14. Verify received data.
15. Finalize the receiver session.
16. Release the receiver lock.
17. Complete the receiver session.

## Recovery semantics

- The UI may create distinct outbound sessions while other outbound sessions are queued, running, or paused. The backend rejects only the same normalized target, a second address-less draft, or any outbound start while receiving.
- An address-less session persists after local manifest collection. Binding its target later continues the same session; it does not recollect into a second browser-owned job.
- Pause changes persistent state; the Octane timer stops advancing the session without discarding checkpoints.
- A repeated database chunk is safe because the receiver compares row identity and content before insert/update.
- A repeated resource chunk is reconciled by the receiver's current byte offset.
- A resource file is moved into its canonical destination only after SHA-256 succeeds.
- Per-session operating-system file locks serialize Octane advancement, pause/resume operations, and receiver writes. The operating system releases the lock immediately if a worker exits, so backend restart recovery does not wait for a stale lock TTL.
- Session writes stage a recoverable pending copy before replacing the primary JSON state, and summary files keep two-second UI polling independent of large internal transfer data.
- Resource completion counters are keyed idempotently, and a receiver that already has the expected file hash immediately returns the completed byte offset instead of downloading the file again.
- UI polling reads lightweight source and receiver summaries from the backend rather than browser-owned progress, so page reload and endpoint reconnection restore the same step list on both A and B. Receiver sessions are visible but controlled by their source session.
- Local manifest summaries expose only aggregate database, table, row, root, file, and byte counts; internal manifests and source paths remain excluded from UI polling.

## Framework references

- Laravel 12 atomic locks: https://laravel.com/docs/12.x/cache#atomic-locks
- Laravel 12 HTTP timeouts and retries: https://laravel.com/docs/12.x/http-client#timeout
- Laravel 12 database transactions: https://laravel.com/docs/12.x/database#database-transactions
- Laravel 12 upserts and unique identity requirements: https://laravel.com/docs/12.x/eloquent#upserts
- Laravel 12 filesystem streaming contracts: https://api.laravel.com/docs/12.x/Illuminate/Contracts/Filesystem/Filesystem.html
- Laravel 12 schema inspection (`getColumns`, `getIndexes`, `getForeignKeys`): https://laravel.com/docs/12.x/database#inspecting-your-databases
- PostgreSQL `pg_dump`: https://www.postgresql.org/docs/current/app-pgdump.html
- PostgreSQL deterministic `ON CONFLICT`: https://www.postgresql.org/docs/current/sql-insert.html
