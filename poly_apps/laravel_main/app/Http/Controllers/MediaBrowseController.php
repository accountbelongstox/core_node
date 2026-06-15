<?php

namespace App\Http\Controllers;

use App\Models\Subtitle;
use App\Models\Book;
use App\Models\MediaSegment;
use App\Models\SourceSentence;
use App\Models\Sentence;
use App\Providers\PathMapper;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Media Browse Controller
 *
 * READ-ONLY browse + media-file serving endpoints for the dashboard
 * "Movies/Books browser + player". Public (no auth), mirrors the local
 * worker ingest endpoints. Lists ingested subtitle sources (movies) and
 * books, exposes ordered sentences + segments, and streams clip/audio
 * files from the Laravel static dir.
 */
class MediaBrowseController extends Controller
{
    use ApiResponse;

    /** Relative API base for clip-serve URLs (FE prepends the API host). */
    private const CLIP_URL_BASE = '/api/app_qy_v1/media/clip';

    /**
     * GET /api/app_qy_v1/media/subtitles
     * Paginated list of subtitle (movie) sources.
     */
    public function subtitles(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'language' => 'nullable|string',
            'search' => 'nullable|string',
        ]);

        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 20;

        $query = Subtitle::query();

        if (!empty($validated['language'])) {
            $query->where('language', $validated['language']);
        }
        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('original_name', 'like', "%{$search}%");
            });
        }

        $query->orderByDesc('synced_at');

        $paginator = $query->paginate($perPage)->through(function (Subtitle $subtitle) {
            return [
                'id' => $subtitle->id,
                'source_key' => $subtitle->source_key,
                'title' => $subtitle->title,
                'original_name' => $subtitle->original_name,
                'ascii_name' => $subtitle->ascii_name,
                'language' => $subtitle->language,
                'duration_sec' => $subtitle->duration_sec,
                'subtitle_count' => $subtitle->subtitle_count,
                'segment_count' => $subtitle->segment_count,
                'sentence_count' => $subtitle->sentence_count,
                'synced_at' => $subtitle->synced_at,
            ];
        });

        return $this->paginated($paginator);
    }

    /**
     * GET /api/app_qy_v1/media/books
     * Paginated list of book sources.
     */
    public function books(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'language' => 'nullable|string',
            'search' => 'nullable|string',
        ]);

        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 20;

        $query = Book::query();

        if (!empty($validated['language'])) {
            $query->where('language', $validated['language']);
        }
        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('original_name', 'like', "%{$search}%");
            });
        }

        $query->orderByDesc('synced_at');

        $paginator = $query->paginate($perPage)->through(function (Book $book) {
            return [
                'id' => $book->id,
                'source_key' => $book->source_key,
                'title' => $book->title,
                'original_name' => $book->original_name,
                'ascii_name' => $book->ascii_name,
                'language' => $book->language,
                'sentence_count' => $book->sentence_count,
                'synced_at' => $book->synced_at,
            ];
        });

        return $this->paginated($paginator);
    }

    /**
     * GET /api/app_qy_v1/media/subtitles/{source_key}
     * Detail: subtitle row + ordered segments (with clip URLs) + ordered sentences.
     */
    public function subtitleDetail(Request $request, string $source_key): JsonResponse
    {
        if (!$this->isValidSourceKey($source_key)) {
            return $this->error('Invalid source key', 404);
        }

        $validated = $request->validate([
            'grain' => 'nullable|string|in:cue,sentence,all',
            'per_page' => 'nullable|integer|min:1|max:2000',
            'page' => 'nullable|integer|min:1',
        ]);

        $subtitle = Subtitle::where('source_key', $source_key)->first();
        if (!$subtitle) {
            return $this->error('Subtitle not found', 404);
        }

        $segments = MediaSegment::where('source_key', $source_key)
            ->orderBy('seg_index')
            ->get()
            ->map(function (MediaSegment $segment) use ($source_key) {
                return [
                    'seg_index' => $segment->seg_index,
                    'start_sec' => $segment->start_sec,
                    'end_sec' => $segment->end_sec,
                    'sub_idx_start' => $segment->sub_idx_start,
                    'sub_idx_end' => $segment->sub_idx_end,
                    'subtitle_count' => $segment->subtitle_count,
                    'mp4_url' => $this->clipUrl($source_key, $segment->mp4),
                    'full_mp4_url' => $this->clipUrl($source_key, $segment->full_mp4),
                    'mp3_url' => $this->clipUrl($source_key, $segment->mp3),
                ];
            })
            ->values();

        $grain = $validated['grain'] ?? 'sentence';
        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 500;
        $sentences = $this->buildSentencesPaginator($source_key, $grain, $perPage);

        return $this->success([
            'source' => $subtitle,
            'segments' => $segments,
            'sentences' => $sentences,
        ]);
    }

    /**
     * GET /api/app_qy_v1/media/books/{source_key}
     * Detail: book row + ordered sentences (no segments).
     */
    public function bookDetail(Request $request, string $source_key): JsonResponse
    {
        if (!$this->isValidSourceKey($source_key)) {
            return $this->error('Invalid source key', 404);
        }

        $validated = $request->validate([
            'grain' => 'nullable|string|in:cue,sentence,all',
            'per_page' => 'nullable|integer|min:1|max:2000',
            'page' => 'nullable|integer|min:1',
        ]);

        $book = Book::where('source_key', $source_key)->first();
        if (!$book) {
            return $this->error('Book not found', 404);
        }

        $grain = $validated['grain'] ?? 'sentence';
        $perPage = isset($validated['per_page']) ? (int) $validated['per_page'] : 500;
        $sentences = $this->buildSentencesPaginator($source_key, $grain, $perPage);

        return $this->success([
            'source' => $book,
            'sentences' => $sentences,
        ]);
    }

    /**
     * GET /api/app_qy_v1/media/clip/{source_key}/{name}
     * Serve a media file from the source's segments dir.
     */
    public function clip(string $source_key, string $name): Response
    {
        if (!$this->isValidSourceKey($source_key)) {
            abort(404);
        }

        // Only a bare filename is allowed: strip any path / traversal.
        $base = basename(str_replace('\\', '/', $name));
        if ($base === '' || $base !== $name || $base === '.' || $base === '..') {
            abort(404);
        }

        $dir = PathMapper::getLaravelStaticDir("media/{$source_key}/segments");
        $path = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . $base;

        if (!is_file($path)) {
            abort(404);
        }

        return response()->file($path, [
            'Content-Type' => $this->mimeForName($base),
            'Cache-Control' => 'public, max-age=31536000',
            'Accept-Ranges' => 'bytes',
        ]);
    }

    // ==================== Helpers ====================

    /**
     * Build an ordered (grain, seq) sentences paginator joining
     * SourceSentence (for this source_key) -> Sentence.
     */
    private function buildSentencesPaginator(string $sourceKey, string $grain, int $perPage)
    {
        $query = SourceSentence::where('source_key', $sourceKey)
            ->with('sentence');

        if ($grain !== 'all') {
            $query->where('grain', $grain);
        }

        $query->orderBy('grain')->orderBy('seq');

        $paginator = $query->paginate($perPage)->through(function (SourceSentence $link) {
            $sentence = $link->sentence;
            return [
                'grain' => $link->grain,
                'seq' => $link->seq,
                'seg_index' => $link->seg_index,
                'sub_idx' => $link->sub_idx,
                'start_sec' => $link->start_sec,
                'end_sec' => $link->end_sec,
                'text' => $sentence->text ?? null,
                'language' => $sentence->language ?? null,
                'explanation' => $sentence->explanation ?? null,
                'grammar' => $sentence->grammar ?? null,
                'ai_commentary' => $sentence->ai_commentary ?? null,
                'special_usage' => $sentence->special_usage ?? null,
                'audio' => $sentence->audio ?? null,
                'occurrence_count' => $sentence->occurrence_count ?? null,
            ];
        });

        return [
            'items' => $paginator->items(),
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ];
    }

    /**
     * Build a relative clip-serve URL for a non-empty segment filename.
     * Returns null when there is no file.
     */
    private function clipUrl(string $sourceKey, ?string $filename): ?string
    {
        if (empty($filename)) {
            return null;
        }
        $base = basename(str_replace('\\', '/', $filename));
        if ($base === '') {
            return null;
        }
        return self::CLIP_URL_BASE . '/' . $sourceKey . '/' . $base;
    }

    /**
     * Validate that source_key is a sane token.
     */
    private function isValidSourceKey(string $sourceKey): bool
    {
        return $sourceKey !== '' && (bool) preg_match('/^[A-Za-z0-9._-]+$/', $sourceKey);
    }

    /**
     * Resolve a Content-Type by file extension.
     */
    private function mimeForName(string $name): string
    {
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        switch ($ext) {
            case 'mp4':
                return 'video/mp4';
            case 'mp3':
                return 'audio/mpeg';
            case 'm4a':
                return 'audio/mp4';
            case 'ogg':
            case 'opus':
                return 'audio/ogg';
            case 'webm':
                return 'video/webm';
            case 'srt':
                return 'text/plain';
            default:
                return 'application/octet-stream';
        }
    }
}
