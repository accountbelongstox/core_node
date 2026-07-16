# API Layer

All backend access goes through the **`api` singleton** (`core/api`). One module per backend area, each extending `BaseAPI`.

```ts
import { api } from '../../core/api';
await api.appQyV1.getLibraries({ language: 'english' });
await api.books.getDictionaryWords({ language: 'english', filter: 'all' });
```

## BaseAPI conventions

- Verbs: `get(url, params?, cache?, cacheTTL?, retry?)`, `post(url, data?)`, `put`, `delete(url)`, `patch`.
- Response envelope: `APIResponse<T> = { success: boolean; data?: T; error?: string; status?: number }`. Read `res.success` then `res.data` (some endpoints also surface fields at the root — read `res.data ?? res` when unsure).
- `get` opts into caching via `APICache` (`core/api/base`); mutations should `apiCache.clear('<url-prefix>')` when they invalidate a cached list.
- Every request is auto-logged to the global log store (health probes filtered). Raw `fetch` must log explicitly.
- `FormData` bodies are auto-detected (multipart, no JSON content-type).

## Module catalog

| `api.*` | Area / backend |
|---------|----------------|
| `appQyV1` | AppQyV1: translation, TTS queue, libraries, learning, vocabulary stats, assist/cover, posters |
| `books` | Dictionary words (list/detail/sentences/validity), word management (create/update/delete/batch), language breakdown |
| `mcpV1` | MCP tools / OCR |
| `itToolsV1`, `serverManager`, `serverManagerV1` | IT tools + server management |
| `auth`, `inviteCode` | Auth + invite codes |
| `aiManagement`, `aiStatus` | AI gateway management + status |
| `databaseManager`, `systemConfig`, `mediaQuery` | DB manager, system config, media queries |

(Endpoint paths live next to each method as JSDoc; treat the source module as the source of truth — these are not re-listed here to avoid drift.)

## Backend prefixes

- laravel_main: `/api/app_qy_v1/...` (AppQyV1), plus other app prefixes.
- pycore: direct to `:59000` (`/api/local/...`, `/ping`, etc.), with live events over WS `/rpc/ws` (`pycoreApi` / `callRpc` / `subscribeWs` in `core/api-libs/pycore`).

## Endpoint switching (multi-backend)

- The active laravel base URL is selectable: `ApiEndpointSwitcher` (top bar) + the Settings dropdown, merged & deduped via `config/api-endpoints` `getMergedEndpoints()`. User-added custom endpoints persist in `localStorage` (`api_custom_endpoints`).
- pycore resolves its own laravel base URL stored-first (probe stored → parallel sweep → persist), mirrored on the pycore side by the LaravelEndpointManager.

## Adding a module / method

1. Add/extend a class in `core/api/modules/<Area>.ts` extending `BaseAPI`; document each method's URL + shape in JSDoc.
2. Register it on the `api` singleton in `core/api/index.ts`.
3. Invalidate relevant cache keys after mutations.
