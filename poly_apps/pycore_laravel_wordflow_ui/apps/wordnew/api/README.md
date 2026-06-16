# /wordnew API layer — mock ⇄ real, one TYPE, one switch

This folder is the **single data gateway** for the `/wordnew` app. Every page and
component imports `wfNewApi` from here and never talks to the backend (or to the
mock data) directly. Whether `wfNewApi` returns **mock** data or makes **real**
network requests is decided by **one import line** in `index.ts` — nothing else.

This mirrors the `wordflow` API library pattern, applied to `/wordnew`.

## Files

| File | Role |
| --- | --- |
| `WfNewApiTypes.ts` | **The single shared TYPE surface.** All data models + the `WfNewApi` interface. The ONLY place shapes are defined. |
| `WfNewApiMock.ts`  | Offline implementation of `WfNewApi`. Serves curated datasets from `../WfNewMockDb` — zero network. |
| `WfNewApiHttp.ts`  | Live implementation of `WfNewApi`. Fetches the real backend through `WfNewEndpoints`. |
| `WfNewEndpoints.ts`| **Backend endpoint manager + reactive store** — default `:9000` list, `/api/health` probe, STORED-FIRST auto-select + offline retry. |
| `useWfNewEndpoints.ts` | React hook (`useSyncExternalStore`) over the endpoint store. |
| `index.ts`         | **The switch.** Exports `wfNewApi` as either the mock or the http impl, plus re-exports every type + the endpoint manager + hook. |

UI lives in `apps/wordnew/components/`: `WfNewApiServerPanel` (compact Settings
summary — current URL + status) opens `WfNewApiServerDialog` (full list, add/
remove, auto-select, **test page**).

### Applied project libraries

This feature uses the shared `core/` libraries rather than ad-hoc state:

- **persistence** (`core/persistence` — `StorageManager` + `StorageKeys`): all
  endpoint config (`nexus_wordnew_api_*`) instead of raw `localStorage`.
- **store pattern** (`useSyncExternalStore`, same shape as `core/logstore` /
  `core/notify`): `wfNewEndpoints.subscribe`/`getSnapshot` + the
  `useWfNewEndpoints()` hook — UIs react without manual event wiring.
- **notify** (`core/notify`): probe/selection results as global toasts.
- **overlay** (`components/shared/Portal` + `styles/overlay` `OVERLAY_Z`): the
  manager dialog (never a raw `fixed inset-0 z-50`).

## Backend endpoint management (`WfNewEndpoints`)

The http impl does not hardcode a base URL — it asks `wfNewEndpoints` for the
current one. Functionality mirrors wordflow's `WordflowApiManager` (the
behaviour, not the UI):

- **Default endpoints** (all port **9000**, the laravel_main / AppQyV1 backend):
  the page's current origin (host + `:9000`, auto-injected, tried first),
  `43.163.112.77:9000` (primary), `127.0.0.1:9000`, `100.101.149.39:9000`,
  `100.106.85.16:9000`. Users can add/remove custom endpoints in
  **Settings → API Server** (persisted in `localStorage`).
- **STORED-FIRST selection:** probe ONLY the last working endpoint first and
  reuse it if healthy; otherwise probe all in parallel and fail over to the
  best healthy one (availability-first; a user pin only ranks higher).
- **Continuous retry:** while every endpoint is offline, an interval loop keeps
  re-testing and stops as soon as one recovers (a healthy backend is never
  polled). Health = a 2xx JSON `/api/health` body with a `status`/`service`
  marker.
- **Events:** `WFNEW_API_HEALTH_EVENT` fires after each pass so the Settings
  panel and the app refresh; the app reloads content when an endpoint recovers.

Mock mode ignores all of this (no network).

## How the switch works (depends on the import)

`index.ts` contains exactly one active export line:

```ts
import { wfNewApiHttp } from './WfNewApiHttp';
// import { wfNewApiMock } from './WfNewApiMock';   // ← offline/mock

export const wfNewApi: WfNewApi = wfNewApiHttp;
// export const wfNewApi: WfNewApi = wfNewApiMock;   // ← offline/mock
```

- **Real backend (default):** keep the `WfNewApiHttp` lines active.
- **Offline / AI Studio / sandbox with no backend:** comment the two Http lines
  and uncomment the two Mock lines.

When this code is opened in **AI Studio** (no backend reachable), the assistant
should auto-swap to the **mock** lines so the app runs fully offline. When it
ships as a real app, the **http** lines stay active and all data is live.

### ⚠️ Avoid replacement conflicts

Exactly **one** `import` line and **one** `export const wfNewApi` line may be
active at a time. Never leave both implementations uncommented — two
`export const wfNewApi` declarations is a duplicate-identifier compile error, and
two `import` lines leaves an unused import. Toggle the import line **and** its
matching export line **together**, as a pair.

## The golden rule — never let mock and real drift

Both implementations implement the **same** `WfNewApi` interface from
`WfNewApiTypes.ts`, and every page consumes those same types.

> **When you change the API, you MUST update ALL of:**
> 1. the interface / types in `WfNewApiTypes.ts`,
> 2. the real impl `WfNewApiHttp.ts`,
> 3. the mock impl `WfNewApiMock.ts` (and the data in `../WfNewMockDb.ts`),
>
> so the mock keeps returning the exact shape the real backend returns. A change
> to one without the others is incomplete.

## Coverage (honest, no silent gaps)

- **Real backend data** (http impl fetches via `WfNewEndpoints`):
  `getBentoGroups`, `getWordGroups`, `getVocabulary`, `getUserProfile`,
  `getUserStats`, `getWalkmanWords`.
- **Curated content / no endpoint yet:** `searchDictionary` (returns `[]`; the UI
  fuzzy-filters its loaded word pool), `getSubtitleCourses`,
  `getBilingualSentences`, `getAnalytics` (serve the curated datasets, logged
  once). When real endpoints land, swap those bodies to a `getJSON(...)` call —
  **the interface and types do not change.**

## Usage

```ts
import { wfNewApi, type Word, type BentoGroup } from '../api';

const groups = await wfNewApi.getBentoGroups();
const words  = await wfNewApi.getVocabulary(groupId);
```
