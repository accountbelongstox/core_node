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

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\Utils\AppQyV1ArticleTextParser;
use App\Services\TaskManagerService;
use App\Services\BookTextStatsService;
use App\Services\MediaIngestService;
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWord;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\Log;

class AppQyV1ArticleController
{
    use ApiResponse;

    protected $taskManager;

    protected BookTextStatsService $stats;

    protected MediaIngestService $ingestService;

    public function __construct(
        TaskManagerService $taskManager,
        BookTextStatsService $stats,
        MediaIngestService $ingestService
    ) {
        $this->taskManager = $taskManager;
        $this->stats = $stats;
        $this->ingestService = $ingestService;
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
        $task = null;

        try {
        DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1))->transaction(function () use (
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
                $article = AppQyV1Article::create([
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
                $timeoutSeconds = 120 + (count($parsedResult['sentences']) * 5) + (count($parsedResult['words']) * 2);
                if ($timeoutSeconds > 3600) {
                    $timeoutSeconds = 3600;
                }

                $task = $this->taskManager->createTask(
                    'AppQyV1',
                    'article_tts_generation',
                    GlobalTask::EXECUTION_LOCAL_TIMER,
                    [
                        'article_id' => $articleId,
                        'language' => $language,
                        'generate_sentence_audio' => $generateSentenceAudio,
                        'generate_word_audio' => $generateWordAudio,
                    ],
                    $timeoutSeconds,
                    50,
                    3
                );

                $article->update(['task_id' => $task->task_id]);

                $cacheKey = "article_task:{$task->task_id}";
                Cache::put($cacheKey, [
                    'article_id' => $articleId,
                    'user_id' => $userId,
                    'article_text' => $articleText,
                    'language' => $language,
                    'sentences' => $parsedResult['sentences'],
                    'sentences_with_md5' => $parsedResult['sentences_with_md5'],
                    'words' => $parsedResult['words'],
                    'word_frequency' => $parsedResult['word_frequency'],
                    'total_sentences' => $parsedResult['total_sentences'],
                    'total_words' => $parsedResult['total_words'],
                    'unique_words' => $parsedResult['unique_words'],
                    'generate_sentence_audio' => $generateSentenceAudio,
                    'generate_word_audio' => $generateWordAudio,
                    'sentence_audio_urls' => [],
                    'word_audio_urls' => [],
                ], 3600);
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
                'task_id' => $task ? $task->task_id : null,
                'tts_status' => $task ? 'processing' : 'not_requested',
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
     *         "article_data": {
     *             "article_text": "...",
     *             "sentences": [...],
     *             "words": [...],
     *             "sentence_audio_urls": [...],
     *             "word_audio_urls": [...]
     *         }
     *     }
     * }
     */
    public function getTaskStatus(string $taskId): JsonResponse
    {
        $task = GlobalTask::where('task_id', $taskId)->first();

        if (!$task) {
            return $this->notFound('Task not found');
        }

        $cacheKey = "article_task:{$taskId}";
        $articleData = Cache::get($cacheKey);

        $article = null;
        if (!$articleData) {
            $article = AppQyV1Article::where('task_id', $taskId)->first();
            if (!$article) {
                return $this->error('Article data not found', 404);
            }
        }

        $responseData = [
            'task_id' => $task->task_id,
            'article_id' => $task->result['article_id'] ?? ($articleData['article_id'] ?? $article?->article_id),
            'status' => $task->status,
            'progress' => $task->progress,
            'error' => null,
        ];

        if ($task->error) {
            $responseData['error'] = $task->error;
        }

        if ($task->status === GlobalTask::STATUS_COMPLETED) {
            if ($articleData) {
                $responseData['sentences'] = array_map(function($item) {
                    return [
                        'text' => $item['sentence'],
                        'audio_url' => $item['audio_url'],
                        'status' => 'completed',
                    ];
                }, $articleData['sentence_audio_urls'] ?? []);

                $responseData['words'] = array_map(function($item) {
                    return [
                        'word' => $item['word'],
                        'audio_url' => $item['audio_url'],
                        'status' => 'completed',
                    ];
                }, $articleData['word_audio_urls'] ?? []);
            } else {
                $responseData['sentences'] = [];
                $responseData['words'] = [];
                $responseData['note'] = 'TTS data cached expired, query article directly for audio URLs';
            }
        } else {
            if ($articleData) {
                $responseData['total_sentences'] = $articleData['total_sentences'];
                $responseData['total_words'] = $articleData['total_words'];
                $responseData['unique_words'] = $articleData['unique_words'];
            }
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

        $query = AppQyV1Article::query();
        if (is_string($articleId) && $articleId !== '') {
            $query->where('article_id', $articleId);
        }

        $mapped = 0;
        $failed = 0;
        $query->orderBy('id')->chunkById(200, function ($articles) use (&$mapped, &$failed) {
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
        });

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
}
