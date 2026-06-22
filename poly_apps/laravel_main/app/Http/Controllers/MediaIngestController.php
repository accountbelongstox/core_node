<?php

namespace App\Http\Controllers;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioService;
use App\Models\LangSentence;
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
        // `model_version` selects the payload schema: v3 (Books unified model)
        // sends a chapter -> slot correspondence tree (`chapters` + `slots`); v2
        // sends a `words` map + per-row content_id; absent/<2 keeps legacy v1.
        // §1.1/§13.3: the shared sentence library accepts every source type.
        $validated = $request->validate([
            'source_type' => 'required|string|in:subtitle,book,document,article',
            'model_version' => 'nullable|integer',
            'source' => 'required|array',
            'source.source_key' => 'required|string',
            'segments' => 'nullable|array',
            'sentences' => 'nullable|array',
            'words' => 'nullable|array',
            'chapters' => 'nullable|array',
            'slots' => 'nullable|array',
        ]);

        $result = $this->mediaIngestService->ingest([
            'source_type' => $validated['source_type'],
            'model_version' => $request->input('model_version'),
            'source' => $request->input('source', []),
            'segments' => $request->input('segments', []) ?? [],
            'sentences' => $request->input('sentences', []) ?? [],
            'words' => $request->input('words', []) ?? [],
            'chapters' => $request->input('chapters', []) ?? [],
            'slots' => $request->input('slots', []) ?? [],
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
     * Claim-free, idempotent bulk sentence-audio upload (CoreBook §5.2).
     *
     * Unlike /ai_tools/tts/sentence/report (which requires a prior worker claim +
     * task_id), this lets pycore push a locally-generated mp3 straight in, keyed
     * by content_id + language. Fill-missing, never clobber.
     *
     * POST /api/app_qy_v1/media/audio   (multipart, no auth — same trust as ingest)
     *   language    (required)  per-language sentence table selector
     *   content_id  (required)  md5 dedup key (PathMapper {lang}/{content_id}.mp3)
     *   source_key  (optional)  originating record (informational)
     *   audio       (required)  the mp3 file
     *
     * Behaviour:
     *   - no per-language row for content_id  -> { ok:false, status:'no_sentence' }
     *   - row exists but already has audio     -> { ok:true,  status:'already_done' }
     *   - row exists, audio empty              -> store mp3 + has_audio/audio/
     *                                             tts_completed_at, { ok:true, status:'completed' }
     */
    public function audio(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'required|string|max:20',
            'content_id' => 'required|string|max:64',
            'source_key' => 'nullable|string|max:64',
            'audio' => 'required|file',
        ]);

        $language = AppQyV1TableMaps::normalizeLangCode($validated['language']);
        $contentId = trim($validated['content_id']);

        if ($language === '') {
            return response()->json(['ok' => false, 'status' => 'invalid', 'error' => 'Unknown language'], 422);
        }

        $service = new AppQyV1SentenceAudioService();

        // Locate the per-language sentence row first so a not-yet-ingested
        // sentence reports 'no_sentence' (pycore ingests text first) rather than
        // the generic worker-report 404.
        $sentence = LangSentence::onLang($language)
            ->where('content_id', $contentId)
            ->first();

        if (!$sentence) {
            return response()->json(['ok' => false, 'status' => 'no_sentence', 'error' => 'No sentence row for content_id; ingest text first'], 200);
        }

        // Fill-missing: a row that already carries audio is acknowledged without
        // overwriting (the service's report() is also file-first idempotent).
        if (!empty($sentence->has_audio)) {
            return response()->json(['ok' => true, 'status' => 'already_done']);
        }

        $binary = @file_get_contents($request->file('audio')->getRealPath());
        if ($binary === false || $binary === '') {
            return response()->json(['ok' => false, 'status' => 'invalid', 'error' => 'Empty audio upload'], 422);
        }

        // Delegate the validated write (MP3 magic + deterministic path + on-disk
        // verification + has_audio/audio/tts_completed_at) to the shared service.
        $result = $service->report(
            $contentId,
            $language,
            'media:audio',
            true,
            $binary,
            'media:audio',
            null
        );

        $httpStatus = $result['http_status'] ?? 200;
        unset($result['http_status']);

        return response()->json($result, $httpStatus);
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
