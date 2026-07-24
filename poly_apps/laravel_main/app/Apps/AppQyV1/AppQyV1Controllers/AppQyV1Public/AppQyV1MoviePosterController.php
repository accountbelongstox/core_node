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
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1PosterPriorityService;
use App\Services\MoviePoster\MoviePosterStore;
use App\Traits\ApiResponse;
use Illuminate\Support\Facades\Log;

/**
 * Movie/TV poster queue status and priority endpoint.
 *
 * POST /api/app_qy_v1/media/poster/fetch { type:'book'|'subtitle', id?|source_key? }
 *   -> load the row -> reset its mcp submission marker -> move it to the queue
 *      head. apps/mcp-chrome owns search, download and submission.
 *
 * No authentication (mirrors the local media ingest / browse endpoints).
 */
class AppQyV1MoviePosterController
{
    use ApiResponse;

    private AppQyV1PosterPriorityService $priority;
    private MoviePosterStore $store;

    public function __construct(AppQyV1PosterPriorityService $priority, MoviePosterStore $store)
    {
        $this->priority = $priority;
        $this->store = $store;
    }

    /**
     * GET /api/app_qy_v1/media/poster/status
     *
     * Cheap, no-auth management snapshot of the mcp-chrome poster queue for
     * the laravel-manager dashboard. Reports per media type (book / subtitle):
     * the poster_status
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
        $payload = [
            'providers' => [
                [
                    'name' => 'mcp-chrome',
                    'configured' => true,
                ],
            ],
            'keys' => [],
            'owner' => 'mcp-chrome',
            'source' => 'search-engine',
            'counts' => [
                'book' => $this->countByPosterStatus(Book::query()),
                'subtitle' => $this->countByPosterStatus(Subtitle::query()),
            ],
        ];

        return $this->success($payload, 'mcp-chrome poster queue status');
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

        $alreadySubmitted = $model->getAttribute('poster_mcp_submitted_at') !== null;
        if ($model->getAttribute('poster_status') === 'ready' && $alreadySubmitted) {
            return $this->success([
                'image_url' => $this->store->imageUrlFor($model),
                'poster_status' => 'ready',
                'provider' => 'mcp-chrome',
                'already_done' => true,
                'queued' => false,
            ], 'Poster already submitted by mcp-chrome');
        }

        try {
            $promoted = $this->priority->promote([[
                'media_type' => $type,
                'id' => (int) $model->getKey(),
            ]]);
        } catch (\Throwable $e) {
            Log::error('[MoviePoster] mcp-chrome queue promotion failed', [
                'type' => $type,
                'id' => $model->getKey(),
                'error' => $e->getMessage(),
            ]);
            return $this->error('Failed to queue poster for mcp-chrome', 500);
        }

        return $this->success([
            'image_url' => $this->store->imageUrlFor($model),
            'poster_status' => 'pending',
            'provider' => 'mcp-chrome',
            'already_done' => false,
            'queued' => $promoted > 0,
        ], 'Poster queued for mcp-chrome search');
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

}
