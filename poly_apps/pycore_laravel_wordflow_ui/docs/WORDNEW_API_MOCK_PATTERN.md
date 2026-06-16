# WORDNEW API — Mock ⇄ Real "import-switch" pattern (spec)

Status: **standard** for the `/wordnew` app (and the template for any new
AI-Studio-authored app that must run both offline and against a live backend).

`/wordnew` is the new UI that supersedes the legacy `wordflow` app. It is wired
to data through a single API gateway that can serve **mock** data or make **real**
API requests, chosen by **one import line** — so the same source runs unchanged
in AI Studio (offline mock) and as a shipped app (live backend).

## Why

- AI Studio (and any sandbox without the python/Laravel backend) cannot reach
  the network, so the UI must run on mock data there.
- The shipped app must use 100% real data, with no mock code paths taken.
- Mock and real must **never drift**: same field names, same shapes — so a page
  built against the mock works identically against the backend.

## Layout (canonical)

All data access for the app lives in `apps/wordnew/api/`:

```
apps/wordnew/api/
  WfNewApiTypes.ts   # THE single shared TYPE surface (models + WfNewApi interface)
  WfNewApiMock.ts    # offline impl of WfNewApi (curated data, zero network)
  WfNewApiHttp.ts    # live impl of WfNewApi (delegates to wordflowApi → backend)
  index.ts           # THE switch: exports wfNewApi = http | mock, re-exports types
  README.md          # contract doc co-located with the code
```

Curated datasets live in `apps/wordnew/WfNewMockDb.ts` and are typed by the
shared types (no parallel/duplicate shapes).

## Rules

1. **One TYPE surface.** Every data model and the `WfNewApi` interface are
   declared once in `WfNewApiTypes.ts`. `WfNewTypes.ts` and `WfNewMockDb.ts`
   re-export from it; they do not redefine shapes.

2. **Two implementations, identical contract.** `WfNewApiMock` and
   `WfNewApiHttp` both `implements`/satisfy `WfNewApi` using those exact types.

3. **One switch, by import.** Consumers do `import { wfNewApi } from '../api'`.
   `index.ts` is the only place that decides mock vs real, via a single active
   import + export pair:
   - default = `WfNewApiHttp` (real backend),
   - offline/AI-Studio = `WfNewApiMock` (swap the commented lines).

4. **Change the API → sync everything.** Editing the API means editing the
   types, the http impl, the mock impl, and the mock data together. A change to
   one without the others is incomplete.

5. **English only.** All code, comments, and these docs are English. (Localized
   user-facing strings live in the app's locale files, not in the API layer.)

6. **Avoid replacement conflicts.** Exactly one `import` line and one
   `export const wfNewApi` line may be active in `index.ts`. Toggle the pair
   together — never leave both implementations active (duplicate
   `export const wfNewApi` = compile error) and never leave an orphan import.

7. **No silent gaps.** Where the real backend has no endpoint yet, the http impl
   serves the curated dataset and logs it once; it does not fake success or
   silently return empty. Swapping such a method to a real call later must not
   change the interface or types.

## AI-assistant behavior

- In **AI Studio** / offline: switch `index.ts` to the **mock** lines so the app
  runs without a backend.
- As a **real app**: keep the **http** lines active; all data is live.
- When asked to add or change a wordnew data call: update `WfNewApiTypes.ts`
  first, then both impls and the mock data, keeping the shared type.

## Reference

- Contract doc: `apps/wordnew/api/README.md`
- Pattern this mirrors: the `wordflow` API library in
  `core/api-libs/wordflow/` (transport, types, endpoints).
