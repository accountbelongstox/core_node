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
| `WfNewApiHttp.ts`  | Live implementation of `WfNewApi`. Delegates to the shared `wordflowApi` transport (real backend). |
| `index.ts`         | **The switch.** Exports `wfNewApi` as either the mock or the http impl, plus re-exports every type. |

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

- **Real backend data** (http impl calls `wordflowApi`): `getBentoGroups`,
  `getWordGroups`, `getVocabulary`, `getUserProfile`, `getUserStats`,
  `searchDictionary`, `getWalkmanWords`.
- **Curated content** (no dedicated backend endpoint yet): `getSubtitleCourses`,
  `getBilingualSentences`, `getAnalytics`. The http impl serves the same curated
  datasets the mock uses and logs this once. When a real endpoint lands, swap
  those three method bodies to a `wordflowApi` call — **the interface and types
  do not change.**

## Usage

```ts
import { wfNewApi, type Word, type BentoGroup } from '../api';

const groups = await wfNewApi.getBentoGroups();
const words  = await wfNewApi.getVocabulary(groupId);
```
