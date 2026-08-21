<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\Utils\AppQyV1ArticleTextParser;
use App\Services\BookTextStatsService;
use App\Services\MediaIngestService;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleModel as AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWordModel as AppQyV1ArticleWord;
use App\Apps\AppQyV1\AppQyV1Requests\AppQyV1WorkerArticleSubmitRequest;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AgentHistoryArticleSubmissionService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailyReadingService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailySentenceService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ArticleSentenceAudioService;
use Illuminate\Support\Facades\Log;

class AppQyV1ArticleController extends Controller
{
    use ApiResponse;

    protected BookTextStatsService $stats;

    protected MediaIngestService $ingestService;

    protected AppQyV1DailyReadingService $dailyReadingService;

    protected AppQyV1ArticleSentenceAudioService $articleAudioService;

    protected AppQyV1AgentHistoryArticleSubmissionService $agentHistorySubmissionService;

    public function __construct(
        BookTextStatsService $stats,
        MediaIngestService $ingestService,
        AppQyV1DailyReadingService $dailyReadingService,
        AppQyV1ArticleSentenceAudioService $articleAudioService,
        AppQyV1AgentHistoryArticleSubmissionService $agentHistorySubmissionService
    ) {
        $this->stats = $stats;
        $this->ingestService = $ingestService;
        $this->dailyReadingService = $dailyReadingService;
        $this->articleAudioService = $articleAudioService;
        $this->agentHistorySubmissionService = $agentHistorySubmissionService;
    }

    /**
     * Submit article for TTS generation
     *
     * POST /api/app_qy_v1/ai_tools/article/submit
     *
     * Request body:
     * {
     *     "article_text": "Article content...",
     *     "language": "english",
     *     "generate_sentence_audio": true,
     *     "generate_word_audio": true
     * }
     *
     * Response:
     * {
     *     "status": "success",
     *     "message": "Article submitted for processing",
     *     "data": {
     *         "task_id": "uuid",
     *         "total_sentences": 10,
     *         "total_words": 50,
     *         "unique_words": 30
     *     }
     * }
     */
    public function submitArticle(Request $request): JsonResponse
    {
        // §2: language is a CODE; validate against the canonical supported set
        // (the edge_tts codes that back the per-language tables) so the rule stays
        // auto-synced and never drifts from a hardcoded list.
        $languageRule = 'nullable|string|in:' . implode(',', AppQyV1TableMaps::getSupportedLanguages());

        $validator = Validator::make($request->all(), [
            'article_text' => 'required|string|min:10|max:50000',
            'language' => $languageRule,
            'generate_sentence_audio' => 'nullable|boolean',
            'generate_word_audio' => 'nullable|boolean',
            'title' => 'nullable|string|max:255',
            'article_type' => 'nullable|string|max:50',
            'source' => 'nullable|string|max:255',
            'difficulty_level' => 'nullable|string|in:beginner,intermediate,advanced',
            'is_daily_reading' => 'nullable|boolean',
            'reading_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return $this->error(
                $validator->errors()->first(),
                400,
                ['supported_params' => ['article_text', 'language', 'generate_sentence_audio', 'generate_word_audio']]
            );
        }

        $articleText = $request->input('article_text');
        // §2: language is a CODE. Default to the primary 'en'; the normalizer
        // (AppQyV1TableMaps::normalizeLangCode) remains a safety net downstream.
        $language = 'en';
        if ($request->has('language')) {
            $language = $request->input('language');
        }

        $generateSentenceAudio = true;
        if ($request->has('generate_sentence_audio')) {
            $generateSentenceAudio = $request->input('generate_sentence_audio');
        }

        $generateWordAudio = true;
        if ($request->has('generate_word_audio')) {
            $generateWordAudio = $request->input('generate_word_audio');
        }

        $parsedResult = AppQyV1ArticleTextParser::parseArticle($articleText, $language);

        $articleId = 'article_' . Str::uuid();
        $userId = $request->user()->id;

        $article = null;
        $taskId = null;

        try {
        AppQyV1Article::runInTransaction(function () use (
                $articleId,
                $userId,
                $request,
                $articleText,
                $language,
                $parsedResult,
                $generateSentenceAudio,
                $generateWordAudio,
                &$article
            ) {
                $article = AppQyV1Article::createRecord([
                    'article_id' => $articleId,
                    'user_id' => $userId,
                    'title' => $request->input('title'),
                    'content' => $articleText,
                    'language' => $language,
                    'article_type' => $request->input('article_type', 'general'),
                    'source' => $request->input('source'),
                    'difficulty_level' => $request->input('difficulty_level'),
                    'word_count' => $parsedResult['total_words'],
                    'unique_word_count' => $parsedResult['unique_words'],
                    'sentence_count' => $parsedResult['total_sentences'],
                    'is_daily_reading' => $request->input('is_daily_reading', false),
                    'reading_date' => $request->input('reading_date'),
                    'task_id' => null,
                    'tts_generated' => false,
                    'metadata' => [
                        'generate_sentence_audio' => $generateSentenceAudio,
                        'generate_word_audio' => $generateWordAudio,
                    ],
                ]);

                AppQyV1ArticleWord::createFromArticleWords(
                    $articleId,
                    $parsedResult['words'],
                    $parsedResult['word_frequency'],
                    $language
                );
            });

            // §1.1/§13.2: map the finalized article body into the ONE shared
            // multi-language sentence library (sentences_{lang} by content_id) via
            // source_sentences slots (source_type='article'). The articles row
            // keeps `content` unchanged. Never let a mapping failure fail the save
            // (the article + its TTS task still proceed).
            $this->mapArticleToLibrary($articleId, $articleText, $language);

            if ($generateSentenceAudio || $generateWordAudio) {
                $queueResult = $this->articleAudioService->enqueueArticle($article);
                if (!($queueResult['ok'] ?? false) || empty($queueResult['task_id'])) {
                    throw new \RuntimeException('Queue Center article audio enqueue failed');
                }
                $taskId = (string) $queueResult['task_id'];
                $article->updateRecord(['task_id' => $taskId]);
            }

            $sentencesData = array_map(function($sentence) {
                return [
                    'text' => $sentence,
                    'audio_url' => null,
                    'status' => 'pending',
                ];
            }, $parsedResult['sentences']);

            $wordsData = array_map(function($word) use ($parsedResult) {
                return [
                    'word' => $word,
                    'frequency' => $parsedResult['word_frequency'][$word] ?? 1,
                    'audio_url' => null,
                    'status' => 'pending',
                ];
            }, $parsedResult['words']);

            return $this->success([
                'article_id' => $articleId,
                'task_id' => $taskId,
                'tts_status' => $taskId !== null ? 'pending' : 'not_requested',
                'article' => [
                    'title' => $article->title,
                    'language' => $language,
                    'article_type' => $article->article_type,
                    'total_sentences' => $parsedResult['total_sentences'],
                    'total_words' => $parsedResult['total_words'],
                    'unique_words' => $parsedResult['unique_words'],
                ],
                'sentences' => $generateSentenceAudio ? $sentencesData : [],
                'words' => $generateWordAudio ? $wordsData : [],
            ], 'Article saved successfully. TTS generation in progress.');

        } catch (\Throwable $e) {
            return $this->error('Failed to save article: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Get article task status
     *
     * GET /api/app_qy_v1/ai_tools/article/task/{taskId}
     *
     * Response:
     * {
     *     "status": "success",
     *     "data": {
     *         "task_id": "uuid",
     *         "status": "completed|processing|pending|failed",
     *         "progress": 75.5,
     *         "article_id": "article_uuid",
     *         "audio_url": "/static/app_qy_v1/audio/..."
     *     }
     * }
     */
    public function getTaskStatus(string $taskId): JsonResponse
    {
        $task = GlobalTask::findByTaskId($taskId);

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $article = AppQyV1Article::findByTaskId($taskId);
        if (!$article) {
            return $this->error('Article data not found', 404);
        }
        $metadata = is_array($article->metadata) ? $article->metadata : [];

        $responseData = [
            'task_id' => $task->task_id,
            'article_id' => $task->payload['article_id'] ?? $article->article_id,
            'status' => $task->status,
            'progress' => $task->progress,
            'error' => null,
            'total_sentences' => (int) $article->sentence_count,
            'total_words' => (int) $article->word_count,
            'unique_words' => (int) $article->unique_word_count,
        ];

        if ($task->error) {
            $responseData['error'] = $task->error;
        }

        if ($task->status === GlobalTask::status('completed')) {
            $responseData['audio_url'] = $metadata['audio_url'] ?? null;
        }

        return $this->success($responseData, 'Task status retrieved successfully');
    }

    /**
     * Get article parsing preview (without creating task)
     *
     * POST /api/app_qy_v1/ai_tools/article/preview
     *
     * Request body:
     * {
     *     "article_text": "Article content...",
     *     "language": "english"
     * }
     *
     * Response:
     * {
     *     "status": "success",
     *     "data": {
     *         "sentences": [...],
     *         "words": [...],
     *         "word_frequency": {...},
     *         "total_sentences": 10,
     *         "total_words": 50,
     *         "unique_words": 30
     *     }
     * }
     */
    public function previewParsing(Request $request): JsonResponse
    {
        // §2: validate language against the canonical supported set (auto-synced).
        $languageRule = 'nullable|string|in:' . implode(',', AppQyV1TableMaps::getSupportedLanguages());

        $validator = Validator::make($request->all(), [
            'article_text' => 'required|string|min:10|max:50000',
            'language' => $languageRule,
        ]);

        if ($validator->fails()) {
            return $this->error(
                $validator->errors()->first(),
                400,
                ['supported_params' => ['article_text', 'language']]
            );
        }

        $articleText = $request->input('article_text');
        // §2: language is a CODE. Default to the primary 'en'; the normalizer
        // (AppQyV1TableMaps::normalizeLangCode) remains a safety net downstream.
        $language = 'en';
        if ($request->has('language')) {
            $language = $request->input('language');
        }

        $parsedResult = AppQyV1ArticleTextParser::parseArticle($articleText, $language);

        return $this->success([
            'sentences' => $parsedResult['sentences'],
            'words' => $parsedResult['words'],
            'word_frequency' => $parsedResult['word_frequency'],
            'total_sentences' => $parsedResult['total_sentences'],
            'total_words' => $parsedResult['total_words'],
            'unique_words' => $parsedResult['unique_words'],
        ], 'Article parsed successfully');
    }

    /**
     * Idempotent backfill: map an EXISTING article's body into the shared
     * multi-language sentence library (§1.1/§13.2). Safe to call repeatedly —
     * MediaIngestService::ingest is fill-missing/never-clobber. Maps every
     * article in the table when no article_id is given.
     *
     * POST /api/app_qy_v1/ai_tools/article/backfill-library  { article_id? }
     */
    public function backfillLibrary(Request $request): JsonResponse
    {
        $articleId = $request->input('article_id');

        $mapped = 0;
        $failed = 0;
        AppQyV1Article::chunkForLibraryBackfill(
            is_string($articleId) ? $articleId : null,
            function ($articles) use (&$mapped, &$failed): void {
                foreach ($articles as $article) {
                    $content = (string) $article->content;
                    if (trim($content) === '') {
                        continue;
                    }
                    if ($this->mapArticleToLibrary((string) $article->article_id, $content, (string) $article->language)) {
                        $mapped++;
                    } else {
                        $failed++;
                    }
                }
            }
        );

        return $this->success([
            'mapped' => $mapped,
            'failed' => $failed,
        ], 'Article library backfill completed');
    }

    /**
     * Segment an article body into BOTH grains (cue/sentence) via
     * BookTextStatsService and ingest it into the ONE shared per-language
     * sentence library through the v3 MediaIngestService path (§1.1/§13.2).
     *
     * source_key = the article's stable id (already 'article_<uuid>'). The PHP
     * parser yields one detected language per slot; selected_languages = the
     * primary code plus every detected slot language (multilingual articles fill
     * several langs; monolingual fills only the primary, others null). Codes only.
     * Never throws — a mapping failure must not fail article creation.
     *
     * @return bool True when the ingest ran without error.
     */
    private function mapArticleToLibrary(string $articleId, string $content, string $language): bool
    {
        try {
            if (trim($content) === '') {
                return false;
            }

            $primaryCode = AppQyV1TableMaps::normalizeLangCode($language);
            if ($primaryCode === '') {
                $primaryCode = 'en';
            }

            // Both-grain segmentation + per-slot language detection (reused from
            // the books pipeline). Articles use a single default chapter.
            $tree = $this->stats->analyzeChapters($content, $primaryCode);
            $cachedSlots = isset($tree['slots']) && is_array($tree['slots']) ? $tree['slots'] : [];
            if (count($cachedSlots) === 0) {
                return false;
            }

            // selected_languages = primary + every detected slot language (codes).
            $selected = [$primaryCode];
            foreach ($cachedSlots as $slot) {
                $code = AppQyV1TableMaps::normalizeLangCode((string) ($slot['language'] ?? ''));
                if ($code !== '' && !in_array($code, $selected, true)) {
                    $selected[] = $code;
                }
            }

            $sourceKey = $articleId; // already 'article_<uuid>', stable + prefixed.

            // Build v3 slots: each detected language fills its own text; the other
            // selected languages stay null (留空), exactly like a book sentence.
            $slots = [];
            foreach ($cachedSlots as $slot) {
                $grain = isset($slot['grain']) ? (string) $slot['grain'] : 'sentence';
                $seq = isset($slot['seq']) ? (int) $slot['seq'] : 0;
                $text = isset($slot['text']) ? (string) $slot['text'] : '';
                if (trim($text) === '') {
                    continue;
                }
                $slotLang = AppQyV1TableMaps::normalizeLangCode((string) ($slot['language'] ?? ''));
                if ($slotLang === '') {
                    $slotLang = $primaryCode;
                }

                $langs = [];
                foreach ($selected as $code) {
                    $langs[$code] = ($code === $slotLang) ? $text : null;
                }

                $slots[] = [
                    'chapter_index' => 0,
                    'grain' => $grain,
                    'seq' => $seq,
                    'corr_id' => MediaIngestService::computeCorrId($sourceKey, $grain, $seq),
                    'primary_language' => $primaryCode,
                    'langs' => $langs,
                    'seg_index' => null,
                    'sub_idx' => null,
                    'start_sec' => null,
                    'end_sec' => null,
                ];
            }

            if (count($slots) === 0) {
                return false;
            }

            $payload = [
                'source_type' => 'article',
                'model_version' => 3,
                'source' => [
                    'source_key' => $sourceKey,
                    'language' => $primaryCode,
                    'selected_languages' => $selected,
                    'full_content' => $content,
                    'metadata' => ['source' => 'article', 'article_id' => $articleId],
                ],
                // Single default chapter (per selected language, title null/留空).
                'chapters' => [
                    ['chapter_index' => 0, 'sentence_count' => count($slots), 'titles' => []],
                ],
                'slots' => $slots,
            ];

            $this->ingestService->ingest($payload);
            return true;
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1Article] Library mapping failed', [
                'article_id' => $articleId,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * List articles. When type/article_type=short, delegates to the file-backed
     * daily-sentence store (formerly GET /api/app_qy_v1/daily-sentences/list).
     *
     * GET /api/app_qy_v1/ai_tools/article/list?type=short
     */
    public function listArticles(Request $request): JsonResponse
    {
        $type = strtolower(trim((string) (
            $request->query('type', $request->query('article_type', ''))
        )));

        if ($type === 'short' || $type === 'daily_short') {
            $limit = (int) $request->query('limit', $request->query('pageSize', 50));
            $page = (int) $request->query('page', 0);
            $offset = $page > 0 ? ($page - 1) * max(1, $limit) : (int) $request->query('offset', 0);
            $data = (new AppQyV1DailySentenceService())->list($limit, $offset);
            $data['article_type'] = 'short';
            $data['deprecated_notice'] = 'Short sentences live under article/list?type=short; /daily-sentences/list is deprecated.';
            return $this->success($data, 'Short articles (daily sentences)');
        }

        return $this->error('Unsupported article list type. Use type=short.', 400, [
            'supported_types' => ['short'],
        ]);
    }

    /**
     * Recommend one article. type=short → daily-sentence recommend.
     *
     * GET /api/app_qy_v1/ai_tools/article/recommend?type=short
     */
    public function recommendArticle(Request $request): JsonResponse
    {
        $type = strtolower(trim((string) (
            $request->query('type', $request->query('article_type', 'short'))
        )));

        if ($type === 'short' || $type === 'daily_short') {
            $item = (new AppQyV1DailySentenceService())->recommend();
            return $this->success([
                'item' => $item,
                'article_type' => 'short',
                'deprecated_notice' => 'Short sentences live under article/recommend?type=short; /daily-sentences/recommend is deprecated.',
            ], 'Short article recommendation');
        }

        return $this->error('Unsupported article recommend type. Use type=short.', 400, [
            'supported_types' => ['short'],
        ]);
    }

    /**
     * Stream stored TTS audio for a short/daily sentence (thin alias of
     * daily-sentences/audio/{id}). Prefer metadata.audio_url when present.
     *
     * GET /api/app_qy_v1/ai_tools/article/audio/{id}
     */
    public function shortAudio(string $id)
    {
        $path = (new AppQyV1DailySentenceService())->audioFile($id);
        if (!is_file($path)) {
            return $this->notFound('Audio not found');
        }
        return response()->file($path, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Worker-facing article submit (no auth — pycore Agent History pipeline).
     *
     * POST /api/app_qy_v1/ai_tools/article/worker/submit
     */
    public function workerSubmit(AppQyV1WorkerArticleSubmitRequest $request): JsonResponse
    {
        $result = $this->agentHistorySubmissionService->submit($request->validated());

        return $this->success($result, __('article.worker_stored'));
    }

    /**
     * Worker-facing audio replacement (no auth — pycore Agent History legacy
     * audio rebuild lane). Overwrites the deterministic <article_id>.mp3 file
     * of an existing agent_history article and refreshes its provenance
     * metadata; the public audio_url stays stable.
     *
     * POST /api/app_qy_v1/ai_tools/article/worker/replace-audio
     */
    public function workerReplaceAudio(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'article_id' => 'nullable|string|max:100|required_without:source_record_id',
            'source_record_id' => 'nullable|string|max:255|required_without:article_id',
            'audio_base64' => 'required|string',
            'tts_engine' => 'nullable|string|max:100',
            'tts_model' => 'nullable|string|max:200',
            'tts_chunked' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error($validator->errors()->first(), 422);
        }

        $articleId = trim((string) $request->input('article_id', ''));
        $sourceRecordId = trim((string) $request->input('source_record_id', ''));

        $article = null;
        if ($articleId !== '') {
            $article = AppQyV1Article::query()
                ->where('article_id', $articleId)
                ->where('source', AppQyV1Article::SOURCE_AGENT_HISTORY)
                ->first();
        }
        if ($article === null && $sourceRecordId !== '') {
            $article = AppQyV1Article::findAgentHistoryBySourceRecordId($sourceRecordId);
        }
        if ($article !== null) {
            $article = AppQyV1Article::resolveCanonicalArticle($article);
        }
        if ($article === null) {
            return $this->error('Agent history article not found for audio replacement', 404);
        }

        $audioUrl = $this->dailyReadingService->replaceAudio(
            $article,
            (string) $request->input('audio_base64'),
            [
                'tts_engine' => $request->input('tts_engine'),
                'tts_model' => $request->input('tts_model'),
                'tts_chunked' => (bool) $request->input('tts_chunked', false),
                'source_record_id' => $sourceRecordId,
                'audio_rebuild' => true,
            ]
        );
        if ($audioUrl === null) {
            return $this->error('Replacement audio could not be stored', 500);
        }

        return $this->success([
            'article_id' => $article->article_id,
            'audio_url' => $audioUrl,
        ], 'Agent history article audio replaced');
    }

    /**
     * Recent daily-reading articles for wordnew / pycore polling.
     *
     * GET /api/app_qy_v1/ai_tools/article/worker/recent
     */
    public function workerRecent(Request $request): JsonResponse
    {
        $limit = (int) $request->input('limit', 30);
        if ($limit < 1) {
            $limit = 30;
        }
        if ($limit > 100) {
            $limit = 100;
        }

        $data = $this->dailyReadingService->list($limit, 0);

        return $this->success([
            'items' => $data['items'],
            'total' => $data['total'],
        ], 'Recent daily-reading articles');
    }

}
