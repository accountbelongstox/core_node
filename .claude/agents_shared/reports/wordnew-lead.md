# wordnew-lead report

## Review ui-wordnew-D7 (done_before_outage_unreviewed)

- Verdict: approved. File: `.claude/agents_shared/reviews/ui-wordnew-D7.json`.
- CKA-12 is confirmed. Its hunks are f4f223414..5bbb23682:
  - `MasterApiClient.ts` +3/-3 (:47, :49, :423);
  - `RequestQueue.ts` +3/-8 (:23-24, :100, and the generator removed).
- The six LF-only lines in `MasterApiClient.ts` (47-49, 365-367) are the same in D1, HEAD and the working tree.
- The import-cycle claim holds: the BaseAPI closure has 17 modules and none is under api-client.
- The grep finds one generator.
- tsc: `bun node_modules/typescript/bin/tsc --noEmit` exits 0 with 0 errors (free RAM 6.49 GB).
- `core/network/api-client/` is released for wordnew-ui-G1.
- MCHR-31-wn had no change and is re-planned:
  - `LIBRARY_COVER_WAITING_STATUSES` exists at `shared/library-cover/LibraryCoverTaskModel.ts:31-35`, but there is no presenter yet;
  - `WfNewAdminLibraries.tsx:59` and `:210` can adopt the set now, and the presenter after ui-pycore-manager adds it.
- Changed files (mine): the verdict file and this report.
- Non-blocking follow-ups for the orchestrator:
  - Generator duplicates in `core/network/ProtocolFetch.ts:140` and in `core/integrations/pycore/{PycoreClient.ts:251,PycoreLaravelRelayTransport.ts:166}` (writer: ui-pycore-manager).
  - `apps/wordnew/services/WordNewRecitationCenter.ts:34-40` (writer: wordnew-ui).
  - `bun run lint` on Windows fails with "command not found: tsc", and the root package.json needs an assigned writer to fix it.
- Blockers: none. Next owner: wordnew-ui (G1, and MCHR-31-wn after the re-plan).
