<?php

namespace App\Http\Controllers;

use App\Services\MediaIngestService;
use App\Services\SentenceEnrichmentService;
use App\Providers\PathMapper;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;

/**
 * Media Ingest Controller
 *
 * Idempotent media ingestion endpoints for the local pycore worker (no auth).
 * Mirrors the WorkerController route -> controller -> service pattern.
 */
class MediaIngestController extends Controller
{
    use ApiResponse;

    protected $mediaIngestService;

    protected $sentenceEnrichmentService;

    public function __construct(
        MediaIngestService $mediaIngestService,
        SentenceEnrichmentService $sentenceEnrichmentService
    ) {
        $this->mediaIngestService = $mediaIngestService;
        $this->sentenceEnrichmentService = $sentenceEnrichmentService;
    }

    /**
     * Ingest a full media payload (source + segments + sentences).
     *
     * POST /api/app_qy_v1/media/ingest
     */
    public function ingest(Request $request): JsonResponse
    {
        // Validate only the envelope. Per-item rules over `segments.*` /
        // `sentences.*` cost ~10ms per row in Laravel's validator — a
        // feature-length movie carries thousands of rows, which burned 30s+ of
        // pure CPU per request and tripped the server's request timeout (408)
        // before the service even ran. This is a local, trusted, no-auth worker
        // endpoint and MediaIngestService is already defensive row-by-row
        // (skips empty text / missing seg_index, casts numerics, picks only
        // allowed columns), so envelope validation is sufficient.
        // Envelope-only validation (see note above). `model_version` selects the
        // book payload schema: v2 (Books Sentence/Word Model) sends a `words` map
        // and per-row content_id; absent/!=2 keeps the legacy v1 path.
        $validated = $request->validate([
            'source_type' => 'required|string|in:subtitle,book',
            'model_version' => 'nullable|integer',
            'source' => 'required|array',
            'source.source_key' => 'required|string',
            'segments' => 'nullable|array',
            'sentences' => 'nullable|array',
            'words' => 'nullable|array',
        ]);

        $result = $this->mediaIngestService->ingest([
            'source_type' => $validated['source_type'],
            'model_version' => $request->input('model_version'),
            'source' => $request->input('source', []),
            'segments' => $request->input('segments', []) ?? [],
            'sentences' => $request->input('sentences', []) ?? [],
            'words' => $request->input('words', []) ?? [],
        ]);

        return $this->success($result, 'Media ingested successfully');
    }

    /**
     * Upload a clip file to static storage (idempotent: skip if already present).
     *
     * POST /api/app_qy_v1/media/ingest-clip
     */
    public function ingestClip(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_key' => 'required|string',
            'name' => 'required|string',
            'file' => 'required|file',
        ]);

        $sourceKey = $validated['source_key'];
        // Sanitize name to a bare filename (prevent path traversal).
        $name = basename(str_replace('\\', '/', $validated['name']));

        $targetDir = PathMapper::getLaravelStaticDir("media/{$sourceKey}/segments");
        PathMapper::ensureDirectory($targetDir);

        $separator = DIRECTORY_SEPARATOR;
        $targetPath = rtrim($targetDir, '/\\') . $separator . $name;

        // Idempotent: if the target file already exists with size > 0, SKIP.
        if (file_exists($targetPath) && filesize($targetPath) > 0) {
            return $this->success([
                'path' => $targetPath,
                'skipped' => true,
            ], 'Clip already present, skipped');
        }

        $request->file('file')->move($targetDir, $name);

        return $this->success([
            'path' => $targetPath,
            'skipped' => false,
        ], 'Clip stored successfully');
    }

    /**
     * Idempotent AI + TTS enrichment pass over the shared sentence library.
     *
     * Fill-missing only (never clobber); skips already-enriched rows. Covers
     * both subtitle- and book-derived sentences. No auth (mirrors the local
     * worker ingest endpoints).
     *
     * POST /api/app_qy_v1/media/enrich  { limit?, language? }
     */
    public function enrich(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => 'nullable|integer|min:1|max:500',
            'language' => 'nullable|string',
        ]);

        $limit = isset($validated['limit']) ? (int) $validated['limit'] : 50;
        $language = $validated['language'] ?? null;

        $result = $this->sentenceEnrichmentService->enrich($limit, $language);

        return $this->success($result, 'Sentence enrichment completed');
    }
}
