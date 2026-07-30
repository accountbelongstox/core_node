# /wordnew API layer — mock ⇄ real, one TYPE, one switch

This folder is the **single data gateway** for the `/wordnew` app. Every page and
component imports `wfNewApi` from here and never talks to the backend (or to the
mock data) directly. Whether `wfNewApi` returns **mock** data or makes **real**
network requests is decided by **one import line** in `index.ts` — nothing else.

This mirrors the `wordnew` API library pattern, applied to `/wordnew`.

## Files

| File | Role |
| --- | --- |
| `WfNewApiTypes.ts` | **The single shared TYPE surface.** All data models + the `WfNewApi` interface. The ONLY place shapes are defined. |
| `WfNewApiMock.ts`  | Offline implementation of `WfNewApi`. Serves curated datasets from `../WfNewMockDb` — zero network. |
| `WfNewApiHttp.ts`  | Live implementation of `WfNewApi`. Fetches the real backend through `WfNewEndpoints`. |
| `WfNewApiPaths.ts` | **The endpoint list center** — every backend path the app calls (full `/api/app_qy_v1/...` routes), in one place. |
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

The http impl does not hardcode a base URL — it asks the centralized
`wfNewEndpoints` manager for the current one:

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
- **Events:** `WORDNEW_API_HEALTH_EVENT` fires after each pass so the Settings
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
  `getUserStats`, `getWalkmanWords`, and the **home content hub**
  `getWordContentGroups` / `getBookGroups` / `getSubtitleGroups` /
  `getLibraryGroups` / `getDocumentGroups` / `getHomeContent` (see next section).
- **Curated content / no endpoint yet:** `searchDictionary` (returns `[]`; the UI
  fuzzy-filters its loaded word pool), `getSubtitleCourses`,
  `getBilingualSentences`, `getAnalytics` (serve the curated datasets, logged
  once). When real endpoints land, swap those bodies to a `getJSON(...)` call —
  **the interface and types do not change.**

## Home content hub (5 categories: words / books / subtitles / libraries / documents)

The home page reads **five** backend content categories through ONE normalized
shape, `WfNewContentGroup`, so a single widget renders them all. Endpoints are
declared in `WfNewApiPaths.ts` (verified against `poly_apps/laravel_main`):

| Category (UI) | API method | Backend route | Array key | Count field | Notes |
| --- | --- | --- | --- | --- | --- |
| Word groups | `getWordContentGroups` | `GET /api/app_qy_v1/query_all_groups` | `data.groups` | `total_words` | **auth required** |
| Books | `getBookGroups` | `GET /api/app_qy_v1/media/books` | `data.items` | `sentence_count` | public |
| Subtitles | `getSubtitleGroups` | `GET /api/app_qy_v1/media/subtitles` | `data.items` | `subtitle_count` | public |
| Libraries | `getLibraryGroups` | `GET /api/app_qy_v1/vocabulary/libraries` | `data.libraries` | `word_count` | public word libraries |
| Documents | `getDocumentGroups` | `GET /api/app_qy_v1/media/documents` | `data.items` | `word_count` | the user's OWN uploads |

`getHomeContent()` fetches all five **in parallel** and is **partial-tolerant**:
a category whose endpoint fails resolves to `[]` rather than failing the whole
home. Backend-relative cover paths → absolute via `toAbsoluteUrl`. Word groups
are **skipped entirely when unauthenticated** so the home never fires a 401 /
auth-expired logout just to load.

> **Libraries vs documents — they are NOT the same.** `vocabulary/libraries` is the PUBLIC
> word-library list (e.g. "English Coca 60000", a frequency word collection) — a
> library, not a document. `media/documents` lists the user's OWN uploaded files (the
> `app_qy_v1_uploaded_documents` table). In this backend an uploaded document also
> *produces* a vocabulary library, which once caused them to be conflated; the home
> keeps them as two distinct tiles. `media/documents` is **optional-auth**: it
> returns an empty page (not 401) when logged out, so the public browse degrades
> gracefully and the Documents tile is simply empty until the user uploads.

### UI widgets (copy-into-a-widget, keep the source as reference)

The hub UI does **not** modify the existing cards. Instead it follows the
project convention: **copy the good parts of existing components into a new
combined widget and leave the originals untouched as reference.**

- `components/WfNewContentGroupCard.tsx` — **new** card, combined from
  `WfNewCards.tsx → CourseBlockCard` (frame, icon chip, count line) + the
  `WfNewApp.tsx` bento card (cover-image backdrop, badge pills, gradient
  fallback). Renders any `WfNewContentGroup`; only the accent + icon vary by
  `kind`. `CourseBlockCard` and the bento card are left **unchanged**.
- `components/WfNewHomeContent.tsx` — **new** widget: four horizontally-scrolling
  sections with live counts, a loading skeleton, and an honest empty state. Pure
  presentation; `WfNewApp` owns the fetch (`getHomeContent`) + click routing.

## Usage

```ts
import { wfNewApi, type Word, type BentoGroup, type WfNewHomeContent } from '../api';

const groups = await wfNewApi.getBentoGroups();
const words  = await wfNewApi.getVocabulary(groupId);

// Home hub — all five categories at once (partial-tolerant):
const home: WfNewHomeContent = await wfNewApi.getHomeContent();
//   home.words / home.books / home.subtitles / home.libraries / home.documents
```
