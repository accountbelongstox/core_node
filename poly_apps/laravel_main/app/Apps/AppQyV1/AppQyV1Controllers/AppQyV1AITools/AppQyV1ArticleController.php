<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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
use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWord;

class AppQyV1ArticleController
{
    use ApiResponse;

    protected $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
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
        $validator = Validator::make($request->all(), [
            'article_text' => 'required|string|min:10|max:50000',
            'language' => 'nullable|string|in:english,chinese,spanish,french,german,japanese,korean',
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
        $language = 'english';
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
        DB::transaction(function () use (
                $articleId,
                $userId,
                $request,
                $articleText,
                $language,
                $parsedResult,
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
        $validator = Validator::make($request->all(), [
            'article_text' => 'required|string|min:10|max:50000',
            'language' => 'nullable|string|in:english,chinese,spanish,french,german,japanese,korean',
        ]);

        if ($validator->fails()) {
            return $this->error(
                $validator->errors()->first(),
                400,
                ['supported_params' => ['article_text', 'language']]
            );
        }

        $articleText = $request->input('article_text');
        $language = 'english';
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
}
