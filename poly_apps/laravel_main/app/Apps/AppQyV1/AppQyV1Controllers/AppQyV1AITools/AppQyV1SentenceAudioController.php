<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sentence-library audio worker + resolution surface (pycore + FE).
 *
 * laravel_main side of development-guides/SENTENCE_AUDIO_GENERATION_PIPELINE.md
 * §4.1-§4.3. The FILE on disk is the source of truth; the sentences.has_audio /
 * audio columns are caches reconciled from the filesystem.
 *
 * Routes (routes/AppQyV1Router/AppQyV1AITools.php, NO-AUTH worker surface, the
 * same trust level as /ai_tools/tts/worker/* and /assist/*):
 *   POST /api/app_qy_v1/ai_tools/tts/sentence/claim   (pycore claim by priority)
 *   POST /api/app_qy_v1/ai_tools/tts/sentence/report  (pycore validated report)
 *   GET  /api/app_qy_v1/ai_tools/tts/sentence/audio   (FE file-first resolve)
 *
 * Plus the dedicated /static serve route that maps the public sentence-audio
 * URL back onto PathMapper::getAppQyV1SentenceSoundsDir():
 *   GET  /static/app_qy_v1/sentence_sounds/{language}/{filename}
 */
class AppQyV1SentenceAudioController extends Controller
{
    private const CACHE_CONTROL = 'public, max-age=31536000';

    private const MIME_MAP = [
        'mp3' => 'audio/mpeg',
        'aac' => 'audio/aac',
        'm4a' => 'audio/mp4',
        'wav' => 'audio/wav',
    ];

    private AppQyV1SentenceAudioService $service;

    public function __construct(?AppQyV1SentenceAudioService $service = null)
    {
        $this->service = $service ?: new AppQyV1SentenceAudioService();
    }

    /**
     * POST /api/app_qy_v1/ai_tools/tts/sentence/claim  (§4.1)
     * Body: { worker_id: string, language?: string|null, limit?: int }
     * limit<=0 -> counts only (FE summary); limit>0 -> lease + return tasks.
     */
    public function claim(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'worker_id' => 'required|string|max:100',
            'language' => 'nullable|string|max:20',
            'limit' => 'nullable|integer|min:0|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        try {
            $result = $this->service->claim(
                $request->input('worker_id'),
                $request->input('language'),
                (int) $request->input('limit', 50)
            );
        } catch (\Throwable $e) {
            Log::error('[SentenceAudio] claim failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during claim'], 500);
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * POST /api/app_qy_v1/ai_tools/tts/sentence/report  (§6)
     *
     * Sentences are keyed by content_id + language against the per-language
     * tables {prefix}_sentences_{lang}. `hash` is accepted as an alias for
     * content_id (legacy `sentence_id` is still accepted as a fallback).
     *
     * Multipart (success): { content_id, language, worker_id, success:"true",
     *                        provider?, audio:<file mp3> }  (or audio_base64).
     * Form (failure):       { content_id, language, worker_id, success:"false",
     *                        provider?, error? }.
     */
    public function report(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'content_id' => 'nullable|string|max:64',
            'hash' => 'nullable|string|max:64',
            'sentence_id' => 'nullable|string|max:64',
            'language' => 'required|string|max:20',
            'worker_id' => 'required|string|max:100',
            'success' => 'required',
            'provider' => 'nullable|string|max:100',
            'error' => 'nullable|string|max:2000',
            'audio_base64' => 'nullable|string',
            'variant_key' => 'nullable|string|max:32',
            'accent' => 'nullable|string|max:16',
            'gender' => 'nullable|string|max:16',
            'source' => 'nullable|string|max:32',
            'voice_type' => 'nullable|string|max:32',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $success = filter_var($request->input('success'), FILTER_VALIDATE_BOOLEAN);

        $audioBinary = null;
        if ($success) {
            if ($request->hasFile('audio')) {
                $file = $request->file('audio');
                if (!$file->isValid()) {
                    return response()->json(['success' => false, 'error' => 'Audio upload failed'], 422);
                }
                $audioBinary = @file_get_contents($file->getRealPath());
                if ($audioBinary === false) {
                    $audioBinary = null;
                }
            } elseif ($request->filled('audio_base64')) {
                $decoded = base64_decode($request->input('audio_base64'), true);
                if ($decoded === false) {
                    return response()->json(['success' => false, 'error' => 'audio_base64 is not valid base64'], 422);
                }
                $audioBinary = $decoded;
            }

            // NOTE: a missing file is NOT rejected here — the report path is
            // idempotent and acks already_done when the file is already on disk
            // (a worker re-reporting a sentence pycore already generated).
        }

        // Canonical key is content_id; accept `hash` / legacy `sentence_id` as
        // aliases for the same value.
        $contentId = $request->input('content_id')
            ?? $request->input('hash')
            ?? $request->input('sentence_id');
        if ($contentId === null || $contentId === '') {
            return response()->json([
                'success' => false,
                'error' => 'Provide content_id (or hash)',
            ], 422);
        }

        try {
            $variantMeta = array_filter([
                'accent' => $request->input('accent'),
                'gender' => $request->input('gender'),
                'source' => $request->input('source'),
                'voice_type' => $request->input('voice_type'),
            ], static fn ($v) => $v !== null && $v !== '');
            $result = $this->service->report(
                (string) $contentId,
                (string) $request->input('language'),
                $request->input('worker_id'),
                $success,
                $audioBinary,
                $request->input('provider'),
                $request->input('error'),
                $request->input('variant_key'),
                $variantMeta ?: null
            );
        } catch (\Throwable $e) {
            Log::error('[SentenceAudio] report failed', [
                'content_id' => $contentId,
                'language' => $request->input('language'),
                'error' => $e->getMessage(),
            ]);
            return response()->json(['success' => false, 'error' => 'Internal error ingesting result'], 500);
        }

        $httpStatus = $result['http_status'];
        unset($result['http_status']);
        if (($result['error'] ?? null) === null) {
            unset($result['error']);
        }

        return response()->json($result, $httpStatus);
    }

    /**
     * GET /api/app_qy_v1/ai_tools/tts/sentence/audio  (§6) — FILE-FIRST.
     * Query: ?hash=<content_id>&language=<lang>  OR  ?text=<sentence>&language=<lang>
     *
     * Optional ?variant_key=<key> resolves a specific suffixed variant;
     * ?accent=<us|uk|...> resolves the first on-disk variant whose spec matches
     * that accent (falls back to the extension-preference scan when none match).
     * Delegates to AppQyV1SentenceAudioService::resolve() (variant-aware disk
     * lookup via relativePathFor + audio_files entry).
     */
    public function audio(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'hash' => 'nullable|string|max:64',
            'text' => 'nullable|string',
            'language' => 'nullable|string|max:20',
            'variant_key' => 'nullable|string|max:32',
            'accent' => 'nullable|string|max:16',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }

        $hash = $request->query('hash');
        $text = $request->query('text');
        $language = $request->query('language');
        $variantKey = $request->query('variant_key');
        $accent = $request->query('accent');

        if (($hash === null || $hash === '') && ($text === null || $text === '')) {
            return response()->json([
                'success' => false,
                'error' => 'Provide hash (sentence_id or content_id) or text+language',
            ], 422);
        }

        try {
            $result = $this->service->resolve($hash, $text, $language, $variantKey, $accent);
        } catch (\Throwable $e) {
            Log::error('[SentenceAudio] resolve failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during resolve'], 500);
        }

        $status = ($result['success'] ?? false) ? 200 : 422;

        return response()->json($result, $status);
    }

    /**
     * POST /api/app_qy_v1/ai_tools/tts/sentence/bump
     * Body: { content_id|hash, language, interactive?: bool, create_task?: bool }
     */
    public function bump(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'content_id' => 'nullable|string|max:64',
            'hash' => 'nullable|string|max:64',
            'language' => 'required|string|max:20',
            'text' => 'nullable|string',
            'interactive' => 'nullable|boolean',
            'create_task' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }
        $contentId = $request->input('content_id') ?? $request->input('hash');
        if (!$contentId) {
            return response()->json(['success' => false, 'error' => 'content_id or hash is required'], 422);
        }
        try {
            $result = $this->service->bumpPriority(
                (string) $contentId,
                (string) $request->input('language'),
                filter_var($request->input('create_task', true), FILTER_VALIDATE_BOOLEAN),
                filter_var($request->input('interactive', true), FILTER_VALIDATE_BOOLEAN),
                $request->input('text')
            );
        } catch (\Throwable $e) {
            Log::error('[SentenceAudio] bump failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during bump'], 500);
        }
        $ok = (bool) ($result['ok'] ?? false);
        return response()->json(array_merge(['success' => $ok], $result), $ok ? 200 : 422);
    }

    /**
     * POST /api/app_qy_v1/ai_tools/tts/sentence/bump-batch
     * Body: { items: [{ text, language }], interactive?: bool }
     *
     * Book-reader chapter/page switch: raise tts_priority for every now-visible
     * sentence lacking audio in ONE round-trip, then a SINGLE pycore run-once
     * nudge so the front-of-queue sentences are processed immediately.
     */
    public function bumpBatch(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1|max:400',
            'items.*.text' => 'required|string',
            'items.*.language' => 'required|string|max:20',
            'interactive' => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }
        try {
            $result = $this->service->bumpPriorityBatch(
                (array) $request->input('items'),
                filter_var($request->input('interactive', true), FILTER_VALIDATE_BOOLEAN)
            );
        } catch (\Throwable $e) {
            Log::error('[SentenceAudio] bump-batch failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during bump-batch'], 500);
        }
        return response()->json(array_merge(['success' => true], $result), 200);
    }

    /**
     * GET /api/app_qy_v1/ai_tools/tts/sentence/missing
     * Query: language?, page?, per_page?
     */
    public function missing(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'language' => 'nullable|string|max:20',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first(),
            ], 422);
        }
        try {
            $data = $this->service->listMissing(
                $request->query('language'),
                (int) $request->query('page', 1),
                (int) $request->query('per_page', 50)
            );
        } catch (\Throwable $e) {
            Log::error('[SentenceAudio] missing list failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error'], 500);
        }
        return response()->json(['success' => true, 'data' => $data]);
    }

    /**
     * GET /static/app_qy_v1/sentence_sounds/{language}/{filename}
     *
     * Serves a sentence-audio file from PathMapper::getAppQyV1SentenceSoundsDir()
     * — the bare-Octane fallback equivalent of the cover/media /static serving.
     * In production nginx maps /static/ straight onto the wwwroot static dir; in
     * local dev nothing served the sentence_sounds path, so this route resolves
     * the same public URL produced by AppQyV1SentenceAudioUrl.
     */
    public function serve(string $language, string $filename): Response
    {
        // Reject any path-traversal in the two captured segments before mapping.
        if (str_contains($language, '/') || str_contains($language, '\\')
            || str_contains($filename, '/') || str_contains($filename, '\\')
            || str_contains($language, '..') || str_contains($filename, '..')) {
            abort(404);
        }

        $relative = $language . '/' . $filename;
        $resolved = realpath($this->service->fullPathFor($relative));
        if ($resolved === false || !is_file($resolved)) {
            abort(404);
        }

        // SECURITY: the resolved file must stay inside the sentence sounds root.
        $baseReal = realpath($this->service->fullPathFor(''));
        if ($baseReal === false) {
            abort(404);
        }
        $prefix = rtrim($baseReal, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
        if (!str_starts_with($resolved, $prefix)) {
            abort(403);
        }

        $extension = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
        $contentType = self::MIME_MAP[$extension] ?? 'application/octet-stream';

        return response()->file($resolved, [
            'Content-Type' => $contentType,
            'Cache-Control' => self::CACHE_CONTROL,
        ]);
    }
}
