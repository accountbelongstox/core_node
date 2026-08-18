<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1StudyGen;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1StudyGenSegmenter;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1StudyGenService;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Book Study-Content Generation control plane (pipeline §5 —
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md).
 *
 * The mcp-chrome "Book Study Generator" panel pulls one ~500-char segment at a
 * time, generates multi-language sentences + explanations + phrases + grammar
 * points via a web-AI chat, and posts the parsed result back here. UI-driven
 * row-lease (assist-flavor) protocol on study_segments; see AppQyV1StudyGenService.
 *
 * Routes (routes/AppQyV1Router/AppQyV1StudyGen.php):
 *   GET  /api/app_qy_v1/study-gen/sources
 *   POST /api/app_qy_v1/study-gen/claim
 *   POST /api/app_qy_v1/study-gen/submit
 *   POST /api/app_qy_v1/study-gen/release
 *   GET  /api/app_qy_v1/study-gen/status
 *   GET  /api/app_qy_v1/study-gen/segment-content
 *
 * Trust level: NO-AUTH machine plane, identical to /assist/* and submit-bing —
 * chrome is a server-side caller without a user token; every submitted artifact
 * is validated server-side. Feature gate APPQYV1_STUDY_GEN_ENABLED (default
 * true): when off the WRITE endpoints return HTTP 200 { success:false,
 * error:'study-gen disabled' } so clients back off cleanly.
 */
class AppQyV1StudyGenController extends Controller
{
    private AppQyV1StudyGenService $service;

    public function __construct()
    {
        $this->service = new AppQyV1StudyGenService();
    }

    /** Disabled-feature response (HTTP 200) for the write endpoints. */
    private function disabledResponse(): JsonResponse
    {
        return response()->json(['success' => false, 'error' => 'study-gen disabled'], 200);
    }

    /**
     * GET /api/app_qy_v1/study-gen/sources
     * Query: type=book|article|all (default all), page, per_page (max 100), q.
     */
    public function sources(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'type' => 'nullable|string|in:book,article,all',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'q' => 'nullable|string|max:200',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed: ' . $validator->errors()->first()], 422);
        }

        $type = (string) $request->input('type', 'all');
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', 20);
        $q = $request->input('q');

        try {
            $result = $this->service->listSources($type, $page, $perPage, $q !== null ? (string) $q : null);
        } catch (\Throwable $e) {
            Log::error('[StudyGen] sources failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error listing sources'], 500);
        }

        return response()->json($result);
    }

    /**
     * POST /api/app_qy_v1/study-gen/claim
     * Plans on demand, then leases up to `limit` (1..3) claimable segments.
     */
    public function claim(Request $request): JsonResponse
    {
        if (!AppQyV1StudyGenService::isEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'claimer' => 'required|string|min:1|max:64',
            'source_type' => 'required|string|in:book,article,document',
            'source_key' => 'required|string|max:64',
            'segment_index' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:3',
            'languages' => 'nullable|array',
            'languages.*' => 'string|max:20',
            'target_chars' => 'nullable|integer|min:1',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed: ' . $validator->errors()->first()], 422);
        }

        $segmentIndex = $request->input('segment_index');
        $languages = $request->input('languages');

        try {
            $result = $this->service->claim(
                trim((string) $request->input('claimer')),
                (string) $request->input('source_type'),
                (string) $request->input('source_key'),
                $segmentIndex !== null ? (int) $segmentIndex : null,
                (int) $request->input('limit', 1),
                is_array($languages) ? $languages : null,
                (int) $request->input('target_chars', AppQyV1StudyGenSegmenter::DEFAULT_TARGET_CHARS)
            );
        } catch (\Throwable $e) {
            Log::error('[StudyGen] claim failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during claim'], 500);
        }

        return response()->json($result);
    }

    /**
     * POST /api/app_qy_v1/study-gen/submit
     * One transaction: sentences_{lang} (skip-if-exists), slot lang_content_ids
     * (fill-null), explanations (fill-missing), phrases + grammar points, then
     * segment -> done and source progress cache.
     */
    public function submit(Request $request): JsonResponse
    {
        if (!AppQyV1StudyGenService::isEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'source_type' => 'required|string|in:book,article,document',
            'source_key' => 'required|string|max:64',
            'segment_index' => 'required|integer|min:0',
            'claimer' => 'nullable|string|max:64',
            'provider' => 'nullable|string|max:32',
            'languages' => 'nullable|array',
            'languages.*' => 'string|max:20',
            'slots' => 'nullable|array',
            'phrases' => 'nullable|array',
            'grammar_points' => 'nullable|array',
        ]);
        if ($validator->fails()) {
            return response()->json(['ok' => false, 'status' => 'invalid', 'error' => 'Validation failed: ' . $validator->errors()->first()], 422);
        }

        try {
            $result = $this->service->submit($request->all());
        } catch (\Throwable $e) {
            Log::error('[StudyGen] submit failed', [
                'source_key' => $request->input('source_key'),
                'segment_index' => $request->input('segment_index'),
                'error' => $e->getMessage(),
            ]);
            return response()->json(['ok' => false, 'status' => 'error', 'error' => 'Internal error ingesting result'], 500);
        }

        $httpStatus = $result['http_status'];
        unset($result['http_status']);
        if (($result['error'] ?? null) === null) {
            unset($result['error']);
        }

        return response()->json($result, $httpStatus);
    }

    /**
     * POST /api/app_qy_v1/study-gen/release
     * Body: { source_type, source_key, segment_indexes:[], claimer?, error? }.
     */
    public function release(Request $request): JsonResponse
    {
        if (!AppQyV1StudyGenService::isEnabled()) {
            return $this->disabledResponse();
        }

        $validator = Validator::make($request->all(), [
            'source_type' => 'required|string|in:book,article,document',
            'source_key' => 'required|string|max:64',
            'segment_indexes' => 'required|array|min:1',
            'segment_indexes.*' => 'integer|min:0',
            'claimer' => 'nullable|string|max:64',
            'error' => 'nullable|string|max:2000',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed: ' . $validator->errors()->first()], 422);
        }

        try {
            $result = $this->service->release(
                (string) $request->input('source_type'),
                (string) $request->input('source_key'),
                (array) $request->input('segment_indexes'),
                $request->input('claimer'),
                $request->input('error')
            );
        } catch (\Throwable $e) {
            Log::error('[StudyGen] release failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error during release'], 500);
        }

        return response()->json($result);
    }

    /**
     * GET /api/app_qy_v1/study-gen/status
     * Query: source_type, source_key -> per-source snapshot.
     */
    public function status(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'source_type' => 'required|string|in:book,article,document',
            'source_key' => 'required|string|max:64',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed: ' . $validator->errors()->first()], 422);
        }

        try {
            $result = $this->service->status(
                (string) $request->input('source_type'),
                (string) $request->input('source_key')
            );
        } catch (\Throwable $e) {
            Log::error('[StudyGen] status failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error reading status'], 500);
        }

        return response()->json($result);
    }

    /**
     * GET /api/app_qy_v1/study-gen/segment-content
     * Query: (source_type, source_key) + (segment_index OR seq). The retrieval
     * hook a reader uses to find a passage's study aids.
     */
    public function segmentContent(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'source_type' => 'required|string|in:book,article,document',
            'source_key' => 'required|string|max:64',
            'segment_index' => 'nullable|integer|min:0',
            'seq' => 'nullable|integer|min:0',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'error' => 'Validation failed: ' . $validator->errors()->first()], 422);
        }

        $segmentIndex = $request->input('segment_index');
        $seq = $request->input('seq');
        if ($segmentIndex === null && $seq === null) {
            return response()->json(['success' => false, 'error' => 'segment_index or seq is required'], 422);
        }

        try {
            $result = $this->service->segmentContent(
                (string) $request->input('source_type'),
                (string) $request->input('source_key'),
                $segmentIndex !== null ? (int) $segmentIndex : null,
                $seq !== null ? (int) $seq : null
            );
        } catch (\Throwable $e) {
            Log::error('[StudyGen] segment-content failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'error' => 'Internal error reading segment content'], 500);
        }

        $httpStatus = $result['http_status'] ?? 200;
        unset($result['http_status']);
        return response()->json($result, $httpStatus);
    }
}
