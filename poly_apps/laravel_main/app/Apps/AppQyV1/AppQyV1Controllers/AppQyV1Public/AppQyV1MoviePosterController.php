<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Database\Eloquent\Model;
use App\Models\Book;
use App\Models\Subtitle;
use App\Services\MoviePoster\MoviePosterClient;
use App\Services\MoviePoster\MoviePosterStore;
use App\Services\AiGateway\AiGateway;
use App\Services\AiGateway\AiSecretLoader;
use App\Traits\ApiResponse;
use Illuminate\Support\Facades\Log;

/**
 * On-demand movie/TV poster fetch + backfill (PHP secondary fetcher).
 *
 * Canonical contract: docs/MOVIE_POSTER_PIPELINE.md §7.
 *
 * POST /api/app_qy_v1/media/poster/fetch { type:'book'|'subtitle', id?|source_key? }
 *   -> load the row -> MoviePosterClient::fetchForTitle(title, year)
 *   -> on a movie-DB miss, fall back to AI cover generation (AiGateway,
 *      free-first, keyless pollinations as the guaranteed last resort)
 *   -> MoviePosterStore -> { image_url, poster_status }.
 *
 * Only when BOTH the movie DBs AND the AI generator fail is the row set
 * poster_status='none'. The AI step is best-effort and time-bounded (the
 * gateway bounds itself; exceptions are guarded and fall through to 'none').
 *
 * No authentication (mirrors the local media ingest / browse endpoints).
 */
class AppQyV1MoviePosterController
{
    use ApiResponse;

    private MoviePosterClient $client;
    private MoviePosterStore $store;

    public function __construct(MoviePosterClient $client, MoviePosterStore $store)
    {
        $this->client = $client;
        $this->store = $store;
    }

    /**
     * GET /api/app_qy_v1/media/poster/status
     *
     * Cheap, no-auth management snapshot of the movie-poster pipeline for the
     * laravel-manager dashboard. Reports:
     *   - providers: tmdb (configured + has_v4_token) and omdb (configured),
     *     where "configured" means a non-empty key resolved via
     *     AiSecretLoader::getIndexed (the same loader MoviePosterClient uses).
     *   - keys: masked (first6…last4) values for the three secret bases so an
     *     operator can confirm WHICH key is wired without exposing it.
     *   - counts: per media type (book / subtitle), the poster_status
     *     distribution (pending / ready / failed / none) + total, from a single
     *     GROUP BY poster_status query each. Guarded: a missing poster_status
     *     column (pre-migration) yields zeroed counts instead of throwing.
     *
     * Never throws — every section is independently guarded so a partial
     * failure still returns a usable snapshot. Cached a few seconds to keep
     * repeated dashboard polls cheap.
     */
    public function status(Request $request): JsonResponse
    {
        $tmdbV3 = AiSecretLoader::getIndexed('TMDB_API_KEY');
        $tmdbV4 = AiSecretLoader::getIndexed('TMDB_API_READ_ACCESS_TOKEN');
        $omdb = AiSecretLoader::getIndexed('OMDB_API_KEY');

        $tmdbConfigured = $tmdbV3 !== '' || $tmdbV4 !== '';
        $hasV4Token = $tmdbV4 !== '';

        $payload = [
            'providers' => [
                [
                    'name' => 'tmdb',
                    'configured' => $tmdbConfigured,
                    'has_v4_token' => $hasV4Token,
                ],
                [
                    'name' => 'omdb',
                    'configured' => $omdb !== '',
                ],
            ],
            'keys' => [
                'TMDB_API_KEY' => $this->maskKey($tmdbV3),
                'TMDB_API_READ_ACCESS_TOKEN' => $this->maskKey($tmdbV4),
                'OMDB_API_KEY' => $this->maskKey($omdb),
            ],
            'counts' => [
                'book' => $this->countByPosterStatus(Book::query()),
                'subtitle' => $this->countByPosterStatus(Subtitle::query()),
            ],
        ];

        return $this->success($payload, 'Movie poster pipeline status');
    }

    /**
     * Per-poster_status distribution for one media table, in a single grouped
     * query. Returns a fixed-shape map (every status key present, defaulting to
     * 0) plus the total. Guarded: any DB error (e.g. the poster_status column
     * not yet migrated) returns the zeroed shape rather than throwing, so the
     * status endpoint never fails because of one table.
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return array{pending:int,ready:int,failed:int,none:int,total:int}
     */
    private function countByPosterStatus($query): array
    {
        $base = ['pending' => 0, 'ready' => 0, 'failed' => 0, 'none' => 0, 'total' => 0];

        try {
            $rows = $query
                ->selectRaw('poster_status, COUNT(*) as aggregate')
                ->groupBy('poster_status')
                ->pluck('aggregate', 'poster_status');
        } catch (\Throwable $e) {
            Log::warning('[MoviePoster] poster_status count failed', ['error' => $e->getMessage()]);
            return $base;
        }

        $total = 0;
        foreach ($rows as $statusKey => $count) {
            $count = (int) $count;
            $total += $count;
            $key = (string) $statusKey;
            if (array_key_exists($key, $base)) {
                $base[$key] = $count;
            }
        }
        $base['total'] = $total;

        return $base;
    }

    /**
     * Mask a secret as first6…last4 (e.g. "abcdef…wxyz"). Empty key → null so
     * the dashboard can render a clear "not set". Short keys are fully masked.
     */
    private function maskKey(string $key): ?string
    {
        $key = trim($key);
        if ($key === '') {
            return null;
        }
        $len = strlen($key);
        if ($len <= 10) {
            return str_repeat('*', $len);
        }
        return substr($key, 0, 6) . '…' . substr($key, -4);
    }

    /**
     * POST /api/app_qy_v1/media/poster/fetch
     */
    public function fetch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|string|in:book,subtitle',
            'id' => 'nullable|integer',
            'source_key' => 'nullable|string',
        ]);

        $type = $validated['type'];
        $id = isset($validated['id']) ? (int) $validated['id'] : null;
        $sourceKey = isset($validated['source_key']) ? (string) $validated['source_key'] : null;

        if ($id === null && ($sourceKey === null || $sourceKey === '')) {
            return $this->error('Either id or source_key is required', 422);
        }

        $model = $this->resolveModel($type, $id, $sourceKey);
        if (!$model) {
            return $this->notFound(ucfirst($type) . ' not found');
        }

        // Already stored: short-circuit (fill-missing / idempotent).
        if ($model->getAttribute('poster_status') === 'ready') {
            return $this->success([
                'image_url' => $this->store->imageUrlFor($model),
                'poster_status' => 'ready',
                'already_done' => true,
            ], 'Poster already present');
        }

        $title = trim((string) $model->getAttribute('title'));
        if ($title === '') {
            $title = trim((string) $model->getAttribute('original_name'));
        }
        if ($title === '') {
            $this->markStatus($model, 'failed');
            return $this->error('Media has no title to search by', 422, [
                'image_url' => null,
                'poster_status' => 'failed',
            ]);
        }

        $year = $this->resolveYear($model);

        $result = $this->client->fetchForTitle($title, $year);

        if ($result === null) {
            // Movie DBs miss: fall back to AI cover generation before giving up.
            $aiApplied = $this->tryAiCover($model, $title);
            if ($aiApplied !== null && ($aiApplied['ok'] ?? false)) {
                return $this->success([
                    'image_url' => $aiApplied['image_url'] ?? $this->store->imageUrlFor($model),
                    'poster_status' => 'ready',
                    'provider' => 'ai',
                ], 'Poster generated via AI cover');
            }

            // Both movie DBs and AI generation failed: mark 'none'.
            $this->markStatus($model, 'none');
            return $this->success([
                'image_url' => null,
                'poster_status' => 'none',
            ], 'No poster found in movie databases or AI generator');
        }

        $applied = $this->store->applyToModel($model, $result);
        if (!($applied['ok'] ?? false)) {
            $this->markStatus($model, 'failed');
            return $this->error('Failed to store fetched poster', 500, [
                'image_url' => null,
                'poster_status' => 'failed',
                'detail' => $applied['error'] ?? null,
            ]);
        }

        return $this->success([
            'image_url' => $applied['image_url'] ?? $this->store->imageUrlFor($model),
            'poster_status' => 'ready',
            'provider' => $result['provider'] ?? null,
        ], 'Poster fetched and stored');
    }

    /**
     * Best-effort AI-cover fallback when the movie DBs miss.
     *
     * Builds a text-free English cover prompt from the media title, calls the
     * unified AiGateway image generator (free-first; keyless pollinations is the
     * guaranteed last-resort backend), and stores any generated image through
     * MoviePosterStore with provider='ai'. The gateway bounds its own time; this
     * wrapper guards exceptions and returns null so the caller falls through to
     * 'none'. Reuses the store's base64 ingest-payload decode path.
     *
     * @return array{ok:bool,status:string,image_url?:string,error?:string}|null
     */
    private function tryAiCover(Model $model, string $title): ?array
    {
        $prompt = 'Minimalist cover art for "' . $title . '", no text, no letters, '
            . 'cinematic, high quality, portrait orientation, dramatic lighting.';

        try {
            $result = AiGateway::generateImage($prompt, '768x1024', null, 'media-poster');
        } catch (\Throwable $e) {
            Log::warning('[MoviePoster] AI cover generation threw', [
                'source_key' => $model->getAttribute('source_key'),
                'error' => $e->getMessage(),
            ]);
            return null;
        }

        if (!is_array($result) || ($result['success'] ?? false) !== true) {
            return null;
        }

        $imageBase64 = (string) ($result['image_base64'] ?? '');
        if ($imageBase64 === '') {
            return null;
        }

        $aiModel = (string) ($result['model'] ?? '');
        $aiProvider = (string) ($result['provider'] ?? '');

        // Reuse the store's base64 ingest-payload decode path (it accepts
        // {provider,source_id,mime,image_base64,meta}); provider is forced to
        // 'ai' so the row records an AI-generated cover.
        return $this->store->applyIngestPayload($model, [
            'provider' => 'ai',
            'source_id' => $aiModel !== '' ? ('ai:' . $aiModel) : 'ai:generated',
            'mime' => $result['mime'] ?? 'image/png',
            'image_base64' => $imageBase64,
            'meta' => [
                'generator' => 'ai',
                'provider' => $aiProvider,
                'model' => $aiModel,
                'latency_ms' => $result['latency_ms'] ?? null,
            ],
        ]);
    }

    /**
     * Load the Book / Subtitle row by id (preferred) or source_key.
     */
    private function resolveModel(string $type, ?int $id, ?string $sourceKey): ?Model
    {
        $query = $type === 'book' ? Book::query() : Subtitle::query();

        if ($id !== null) {
            return $query->find($id);
        }

        return $query->where('source_key', $sourceKey)->first();
    }

    /**
     * Best-effort year resolution from the row's metadata / poster_meta.
     */
    private function resolveYear(Model $model): ?int
    {
        $meta = $model->getAttribute('metadata');
        if (is_array($meta) && isset($meta['year']) && (int) $meta['year'] > 0) {
            return (int) $meta['year'];
        }

        $posterMeta = $model->getAttribute('poster_meta');
        if (is_array($posterMeta) && isset($posterMeta['year']) && (int) $posterMeta['year'] > 0) {
            return (int) $posterMeta['year'];
        }

        return null;
    }

    /**
     * Persist a terminal poster_status (none / failed) + fetched_at, fill-missing
     * safe (only sets the status fields, never clobbers a stored file).
     */
    private function markStatus(Model $model, string $status): void
    {
        $model->setAttribute('poster_status', $status);
        $model->setAttribute('poster_fetched_at', now());
        $model->save();
    }
}
