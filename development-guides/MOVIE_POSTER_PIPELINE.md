# Movie/TV Poster Pipeline (TMDB + OMDB) — canonical contract

Status: 2026-06-15. Fetches movie/TV posters from **TMDB** (themoviedb.org) and **OMDB**
(omdbapi.com) for Books & Subtitles media items and Video-Extract outputs. Posters are
**always downloaded and stored as LOCAL files** — never referenced as an external URL.

pycore is the **primary** fetcher (runs at ingest/extract time, sends bytes to laravel).
laravel is the **store** AND a **secondary** PHP fetcher (on-demand backfill when a row has
no poster). When a title is Chinese (or any non-Latin script), it is **translated to
English first** (movie DBs index by English/original titles): pycore via GoogleTranslator,
laravel via `AppQyV1TranslationService`. When the movie DBs return no match (common for real
document books), the system **falls back to the existing AI cover-generation pipeline**.

## 1. API keys (env / secret manager)

Registered in `scripts/pytools/special_software_env_manager/config/config_manager.py`:

- `TMDB_API_KEY` — TMDB v3 API key (required)
- `TMDB_API_READ_ACCESS_TOKEN` — TMDB v4 Bearer token (optional; if present, used as
  `Authorization: Bearer <token>` instead of `?api_key=`)
- `OMDB_API_KEY` — OMDB API key (required)

Read via `secret_manager.get_secret_key_indexed("TMDB_API_KEY")` etc. (pycore) and the
laravel secret resolver (`CoreNodeSecrets` / env fallback).

## 2. Provider request formats

### TMDB (preferred — richer posters)
- Search: `GET https://api.themoviedb.org/3/search/multi?query=<title>&year=<year>&language=<lang>`
  - auth: header `Authorization: Bearer <v4 token>` OR query `api_key=<v3 key>`
  - pick first result with a non-null `poster_path` (prefer `media_type` movie/tv)
- Poster bytes: `https://image.tmdb.org/t/p/w780<poster_path>` (download → bytes)
- result id: `tmdb:<media_type>:<id>`

### OMDB (fallback)
- Lookup: `GET https://www.omdbapi.com/?apikey=<key>&t=<title>&y=<year>` (or `s=` search)
- `Poster` field is a direct image URL (value `"N/A"` means none) → download → bytes
- result id: `imdb:<imdbID>`

## 3. Poster result object (internal, both stacks)

```
{
  "provider": "tmdb" | "omdb",
  "source_id": "tmdb:movie:603" | "imdb:tt0133093",
  "mime": "image/jpeg",
  "image_base64": "<base64 bytes>",   // pycore→laravel transport
  "meta": { "title", "original_title", "year", "overview", "poster_url" }
}
```

## 4. Ingest payload addition (pycore → `POST /api/app_qy_v1/media/ingest`)

Add an OPTIONAL `poster` object inside `source` (omit entirely when no match found —
laravel then leaves `poster_status='pending'` so its own PHP fetch can backfill later):

```json
"source": {
  "...existing fields...": "...",
  "poster": {
    "provider": "tmdb",
    "source_id": "tmdb:movie:603",
    "mime": "image/jpeg",
    "image_base64": "<...>",
    "meta": { "year": 1999, "original_title": "The Matrix" }
  }
}
```

## 5. laravel storage (books AND subtitles tables)

New columns (migration `AppQyV1_2026_06_15_*_add_poster_columns_to_media_tables`), added to
BOTH `subtitles` and `books` (use the real prefixed table names in the migration):

- `poster_filename`  string(255) nullable
- `poster_provider`  string(32)  nullable   // tmdb | omdb | ai
- `poster_source_id` string(64)  nullable
- `poster_status`    string(20)  default 'pending'  // pending|ready|failed|none
- `poster_meta`      json        nullable
- `poster_fetched_at` timestamp  nullable

File on disk: `PathMapper::getStaticPath().'/app_qy_v1/posters/<source_key>.<ext>'`
Served URL: `url('/static/app_qy_v1/posters/<source_key>.<ext>')` (existing `/static/{path}`
fallback route + StaticFileController already handle this dir).

Fill-missing semantics (idempotent): never clobber a row already `poster_status='ready'`.

## 6. laravel exposure (read APIs)

`GET /media/books`, `GET /media/subtitles`, `GET /media/content/{type}/{id}` each add to every
item:
- `image_url`: poster URL when `poster_status='ready'`, else null
- `poster_status`: the lifecycle string

## 7. laravel on-demand fetch + backfill

- Route `POST /api/app_qy_v1/media/poster/fetch { type:'book'|'subtitle', id?|source_key? }`
  → `MoviePosterClient` (PHP) → translate CJK title → TMDB→OMDB → save local file → set
  columns → return `{ image_url, poster_status }`. If movie DBs miss, enqueue the existing
  AI-cover fallback (or set `poster_status='none'`).
- A best-effort backfill in the existing media read path may lazily trigger a fetch for
  `pending` rows (rate-limited), but the canonical trigger is pycore-at-ingest + the route.

## 8. Video-Extract poster (pycore)

`video_extract_processor` parses a clean title + year from the filename (strip release/quality
tokens, SxxExx, year in parens/brackets), calls the same `movie_poster_client`, saves
`poster.jpg` into the per-video output dir, records `files.poster` in `mapping.json`, and adds
`poster` (local path + provider + meta) to the `video_extract` user-data entry. The
PcVideoExtractPage shows the poster thumbnail.

## 9. Module map

- pycore client: `pycore/pyutils/external_apis/movie_poster_client.py`
  (uses `get_third_package_requests`, `get_secret_key_indexed`, GoogleTranslator for CJK)
- pycore books integration: `callmodule/services/sync/laravel_media_sync.py`
  (`build_book_payload_v2` / subtitle payload → attach `poster`)
- pycore video-extract: `callmodule/services/processors/video_extract_processor.py`
- laravel PHP client: `app/Services/MoviePoster/MoviePosterClient.php`
- laravel store/apply: `app/Services/MoviePoster/MoviePosterStore.php` (or fold into
  MediaIngestService + a small service)
- laravel ingest: `app/Services/MediaIngestService.php` (decode payload `poster`)
- laravel routes/controller: media poster fetch endpoint
- FE: `apps/wordflow/pages/WfLearnLibraryPage.tsx` + `WfMediaLibraryPage.tsx` +
  `WfMediaDetailPage.tsx` + `wordflowTypes.ts`; `apps/pycore-manager/pages/PcVideoExtractPage.tsx`
