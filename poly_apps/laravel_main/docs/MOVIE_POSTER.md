# Movie/TV Poster Pipeline — laravel_main slice

Local PHP slice of the movie/TV poster pipeline. Canonical cross-stack contract:
[`MOVIE_POSTER_PIPELINE.md`](MOVIE_POSTER_PIPELINE.md).

laravel_main is the **store** (receives poster bytes from pycore at ingest time)
AND a **secondary PHP fetcher** (on-demand backfill when a media row has no
poster). Posters are ALWAYS stored as LOCAL files — never referenced as an
external URL.

## Columns (subtitles AND books tables)

Migration: `database/migrations/AppQyV1_2026_06_15_000001_add_poster_columns_to_media_tables.php`
(add-only, `SafeMigrationHelper::safeAddColumns`; real prefixed tables
`app_qy_v1_subtitles` + `app_qy_v1_books`). Added to BOTH via the `Subtitle`
and `Book` models (`$fillable` + `$casts`, `poster_meta`=array, `poster_fetched_at`=datetime):

| column             | type        | notes                                   |
|--------------------|-------------|-----------------------------------------|
| `poster_filename`  | string(255) | local file under static/app_qy_v1/posters |
| `poster_provider`  | string(32)  | `tmdb` \| `omdb` \| `ai`                |
| `poster_source_id` | string(64)  | `tmdb:movie:603` \| `imdb:tt0133093`    |
| `poster_status`    | string(20)  | `pending` (default) \| `ready` \| `failed` \| `none` |
| `poster_meta`      | json        | `{ title, original_title, year, overview, poster_url }` |
| `poster_fetched_at`| timestamp   | last fetch/store time                   |

## File path + URL

- On disk: `PathMapper::getStaticPath().'/app_qy_v1/posters/<source_key>.<ext>'`
  (dir created via `PathMapper::ensureDirectory`, race-safe on Octane/DrvFs).
- Served URL: `url('/static/app_qy_v1/posters/<source_key>.<ext>')` — the existing
  `/static/{path}` fallback route + `StaticFileController` already serve this dir.

## Services

- `app/Services/MoviePoster/MoviePosterClient.php`
  - `fetchForTitle(string $title, ?int $year = null, string $lang = 'en'): ?array`
    → `['provider','source_id','binary','mime','meta']` or `null` (never throws).
  - CJK / non-Latin title → translated to English first via
    `AppQyV1TranslationService::translateWithFallback($title,'en','general')`
    (chain ends in the free pycore Google path, so it completes even when LLM
    keys are down).
  - TMDB `search/multi` (Bearer `TMDB_API_READ_ACCESS_TOKEN` if present, else
    `?api_key=TMDB_API_KEY`) → first result with a non-null `poster_path`
    (prefers movie/tv) → downloads `https://image.tmdb.org/t/p/w780<poster_path>`.
  - OMDB fallback `?apikey=OMDB_API_KEY&t=<title>&y=<year>` → downloads `Poster`
    (skips `"N/A"`).
  - Uses the Laravel `Http` facade with explicit timeouts.
- `app/Services/MoviePoster/MoviePosterStore.php`
  - `applyToModel(Model $model, array $posterResult): array` — validate magic
    bytes, write `<source_key>.<ext>`, set poster_* columns with
    `poster_status='ready'`. **Fill-missing**: a row already `ready` with its
    file present is never clobbered.
  - `applyIngestPayload(Model $model, array $poster)` — decode a pycore ingest
    `poster` (base64 `image_base64`) → `applyToModel`.
  - `buildPosterUrl(string $filename): string` → `url('/static/app_qy_v1/posters/'.$filename)`.
  - `imageUrlFor(Model $model): ?string` — poster URL when `ready`, else null.

## API keys

Read the SAME way other provider keys are read in this app, via
`App\Services\AiGateway\AiSecretLoader::getIndexed('<BASE>')`, which scans
`<BASE>_1.._5` then bare `<BASE>` in the shared `<core_node>/.secret_keys`
store (the PHP twin of pycore's `get_secret_key_indexed`):

- `TMDB_API_READ_ACCESS_TOKEN` (v4 Bearer, optional)
- `TMDB_API_KEY` (v3, used as `?api_key=` when no Bearer)
- `OMDB_API_KEY`

## Ingest decode (pycore → laravel)

`app/Services/MediaIngestService.php`: after the Book / Subtitle source row is
upserted (v1 and v2 book paths), `applyPosterFromSource()` decodes an optional
`source.poster` payload and saves it via `MoviePosterStore::applyIngestPayload`
(fill-missing). When `source.poster` is absent the row keeps its default
`poster_status='pending'` so the PHP fetch can backfill later. A poster failure
never fails the ingest (logged, ingest result carries a `poster` summary).

## On-demand fetch route

`POST /api/app_qy_v1/media/poster/fetch  { type:'book'|'subtitle', id?|source_key? }`
(no auth — mirrors the media ingest/browse endpoints; registered in
`routes/AppQyV1Router/AppQyV1MediaContent.php`, controller
`AppQyV1MoviePosterController::fetch`).

Flow: load the row → if already `ready` short-circuit → resolve title
(`title` else `original_name`) + year (`metadata.year`/`poster_meta.year`) →
`MoviePosterClient::fetchForTitle` (TMDB→OMDB) → on a miss, **AI-cover fallback**
→ `MoviePosterStore`. Returns `{ image_url, poster_status, provider? }`.

**Movie-DB miss → AI cover.** When TMDB and OMDB both miss, the endpoint builds a
text-free English cover prompt from the title and calls
`AiGateway::generateImage($prompt, '768x1024', null, 'media-poster')` (unified AI
gateway, **free-first**; the keyless `pollinations` backend is the guaranteed
last-resort, so a cover is produced even with no paid keys). A generated image is
stored via `MoviePosterStore::applyIngestPayload` with `provider='ai'`,
`source_id='ai:<model>'`, `poster_status='ready'`, and `poster_meta` carrying
`{ generator:'ai', provider, model, latency_ms }`. The AI step is best-effort and
time-bounded (the gateway bounds itself; exceptions are guarded), lazy /
on-demand only — never at bulk ingest.

**Only when BOTH the movie DBs AND the AI generator fail** is the row set
`poster_status='none'`.

## Status endpoint + laravel-manager panel

`GET /api/app_qy_v1/media/poster/status` (no auth — same group as the fetch
route in `routes/AppQyV1Router/AppQyV1MediaContent.php`, controller
`AppQyV1MoviePosterController::status`) returns a cheap pipeline snapshot and
**never throws** (each section is independently guarded):

- `providers`: `[{name:'tmdb', configured, has_v4_token}, {name:'omdb', configured}]`
  where `configured` is a non-empty key resolved via
  `AiSecretLoader::getIndexed` (tmdb = `TMDB_API_KEY` OR
  `TMDB_API_READ_ACCESS_TOKEN`; `has_v4_token` = the v4 Bearer is present).
- `keys`: masked (`first6…last4`) values for `TMDB_API_KEY`,
  `TMDB_API_READ_ACCESS_TOKEN`, `OMDB_API_KEY` (null when unset) so an operator
  can confirm WHICH key is wired without exposing it.
- `counts`: per media type `{ book:{pending,ready,failed,none,total},
  subtitle:{...} }` from a single `GROUP BY poster_status` query each (a missing
  `poster_status` column yields a zeroed shape rather than an error).

**laravel-manager dashboard.** The AI Tools console (`components/views/AITools.tsx`)
has a new left-nav tool **"Movie Poster"** → `components/ai-tools/MoviePosterPanel.tsx`.
It shows the provider key badges (TMDB configured / v4 token, OMDB configured),
the per-type poster_status count chips, and a "Test / fetch poster" control
(type + id-or-source_key → `POST /media/poster/fetch`) that renders the returned
`image_url` as an `<img>` plus the resulting `poster_status`. API methods
`getPosterStatus()` / `fetchPoster(type, {id?, sourceKey?})` live on the
`appQyV1` module (`core/api/modules/AppQyV1.ts`, prefix `/api/app_qy_v1`).

## Read exposure

Every item in these read APIs now carries `image_url` (poster URL when
`poster_status==='ready'`, else null) and `poster_status`:

- `GET /api/app_qy_v1/media/books` — `MediaBrowseController::books`
- `GET /api/app_qy_v1/media/subtitles` — `MediaBrowseController::subtitles`
- `GET /api/app_qy_v1/media/content/{type}/{id}` — `AppQyV1MediaContentPublicController::getContent` (in the `info` object)

`image_url` is built via `MoviePosterStore::imageUrlFor()` / `buildPosterUrl()`.
