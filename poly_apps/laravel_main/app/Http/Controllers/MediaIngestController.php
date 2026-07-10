<?php

namespace App\Http\Controllers;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioFiles;
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
     * Store an AI web-chat reply's audio binary captured by the mcp-chrome
     * extension (ChatGPT "Read aloud" / Gemini "Listen"). No-auth, same trust
     * boundary as the other local ingest endpoints. Idempotent fill-missing,
     * keyed by provider + language + prompt_hash. Returns a FLAT {ok,path,skipped}
     * payload (the extension's MediaUploadClient reads data.ok / data.path).
     * POST /api/app_qy_v1/media/ai-audio
     */
    public function aiAudio(Request $request): JsonResponse
    {
        $validated = null;
        $provider = null;
        $hash = null;
        $language = null;
        $ext = null;
        $name = null;
        $targetDir = null;
        $separator = null;
        $targetPath = null;

        $validated = $request->validate([
            'provider' => 'required|string|max:64',
            'prompt_hash' => 'required|string|max:128',
            'language' => 'required|string|max:32',
            'audio' => 'required|file',
        ]);

        // Sanitize to bare path-safe tokens (prevent traversal / odd filenames).
        $provider = preg_replace('/[^A-Za-z0-9_\-]/', '', $validated['provider']);
        $hash = preg_replace('/[^A-Za-z0-9_\-]/', '', $validated['prompt_hash']);
        $language = preg_replace('/[^A-Za-z0-9_\-]/', '', $validated['language']);
        if ($provider === '' || $hash === '' || $language === '') {
            return response()->json(['ok' => false, 'error' => 'Invalid provider/prompt_hash/language'], 422);
        }

        $ext = strtolower((string) $request->file('audio')->getClientOriginalExtension());
        if (!in_array($ext, ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac'], true)) {
            $ext = 'mp3';
        }
        $name = "{$language}-{$hash}.{$ext}";

        $targetDir = PathMapper::getLaravelStaticDir("media/ai/{$provider}");
        PathMapper::ensureDirectory($targetDir);

        $separator = DIRECTORY_SEPARATOR;
        $targetPath = rtrim($targetDir, '/\\') . $separator . $name;

        // Idempotent: keep the first non-empty capture, never clobber.
        if (file_exists($targetPath) && filesize($targetPath) > 0) {
            return response()->json(['ok' => true, 'path' => $targetPath, 'skipped' => true]);
        }

        $request->file('audio')->move($targetDir, $name);

        return response()->json(['ok' => true, 'path' => $targetPath, 'skipped' => false]);
    }

    /**
     * Claim-free, idempotent bulk sentence-audio upload (CoreBook §5.2).
     *
     * Unlike /ai_tools/tts/sentence/report (which requires a prior worker claim +
     * task_id), this lets pycore push a locally-generated mp3 straight in, keyed
     * by content_id + language. Fill-missing, never clobber.
     *
     * POST /api/app_qy_v1/media/audio   (multipart, no auth — same trust as ingest)
     *   language     (required)  per-language sentence table selector
     *   content_id   (required)  md5 dedup key (PathMapper {lang}/{content_id}.mp3)
     *   source_key   (optional)  originating record (informational)
     *   variant_key  (optional)  clip variant id (e.g. duoreader_tts, uk_f, us_m)
     *   accent       (optional)  us | uk | …
     *   source       (optional)  tts | human | ai | duoreader
     *   voice_type   (optional)  machine | neural | human
     *   provider     (optional)  duoreader-api | edge-tts | …
     *   audio        (required)  the mp3 file
     *
     * Behaviour:
     *   - no per-language row for content_id  -> { ok:false, status:'no_sentence' }
     *   - variant file already on disk        -> { ok:true,  status:'already_done' }
     *   - row exists, variant missing         -> store mp3 + audio_files entry
     *                                             { ok:true, status:'completed' }
     *
     * FUTURE UK example (same content_id, second clip):
     *   variant_key=uk_f, accent=uk, source=tts, voice_type=machine, provider=edge-tts
     * See AppQyV1SentenceAudioFiles::VARIANT_UK_F and roadmap in that class.
     */
    public function audio(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'required|string|max:20',
            'content_id' => 'required|string|max:64',
            'source_key' => 'nullable|string|max:64',
            'variant_key' => 'nullable|string|max:64',
            'accent' => 'nullable|string|max:20',
            'source' => 'nullable|string|max:32',
            'voice_type' => 'nullable|string|max:32',
            'provider' => 'nullable|string|max:100',
            'audio' => 'required|file',
        ]);

        $language = AppQyV1TableMaps::normalizeLangCode($validated['language']);
        $contentId = trim($validated['content_id']);
        $variantKey = trim((string) ($validated['variant_key'] ?? ''));

        if ($language === '') {
            return response()->json(['ok' => false, 'status' => 'invalid', 'error' => 'Unknown language'], 422);
        }

        $service = new AppQyV1SentenceAudioService();

        $sentence = LangSentence::onLang($language)
            ->where('content_id', $contentId)
            ->first();

        if (!$sentence) {
            return response()->json(['ok' => false, 'status' => 'no_sentence', 'error' => 'No sentence row for content_id; ingest text first'], 200);
        }

        if ($service->variantExistsOnDisk($language, $contentId, $variantKey !== '' ? $variantKey : null)
            || AppQyV1SentenceAudioFiles::hasVariantWithFile($sentence, $variantKey)) {
            return response()->json(['ok' => true, 'status' => 'already_done', 'variant_key' => $variantKey]);
        }

        $binary = @file_get_contents($request->file('audio')->getRealPath());
        if ($binary === false || $binary === '') {
            return response()->json(['ok' => false, 'status' => 'invalid', 'error' => 'Empty audio upload'], 422);
        }

        $variantMeta = [
            'accent' => $validated['accent'] ?? null,
            'source' => (string) ($validated['source'] ?? AppQyV1SentenceAudioFiles::SOURCE_TTS),
            'voice_type' => (string) ($validated['voice_type'] ?? AppQyV1SentenceAudioFiles::VOICE_MACHINE),
        ];

        $result = $service->report(
            $contentId,
            $language,
            'media:audio',
            true,
            $binary,
            (string) ($validated['provider'] ?? 'media:audio'),
            null,
            $variantKey !== '' ? $variantKey : null,
            $variantMeta
        );

        $httpStatus = $result['http_status'] ?? 200;
        unset($result['http_status']);
        $result['variant_key'] = $variantKey;

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
