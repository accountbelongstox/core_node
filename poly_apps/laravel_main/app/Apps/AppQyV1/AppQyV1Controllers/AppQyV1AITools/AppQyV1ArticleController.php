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
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\Utils\AppQyV1ArticleTextParser;
use App\Services\TaskManagerService;
use App\Models\GlobalTask;

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

        $timeoutSeconds = 120 + (count($parsedResult['sentences']) * 5) + (count($parsedResult['words']) * 2);
        if ($timeoutSeconds > 3600) {
            $timeoutSeconds = 3600;
        }

        $task = $this->taskManager->createTask(
            'AppQyV1',
            'article_tts_generation',
            GlobalTask::EXECUTION_LOCAL_TIMER,
            [
                'language' => $language,
                'generate_sentence_audio' => $generateSentenceAudio,
                'generate_word_audio' => $generateWordAudio,
            ],
            $timeoutSeconds,
            50,
            3
        );

        $cacheKey = "article_task:{$task->task_id}";
        Cache::put($cacheKey, [
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

        return $this->success([
            'task_id' => $task->task_id,
            'total_sentences' => $parsedResult['total_sentences'],
            'total_words' => $parsedResult['total_words'],
            'unique_words' => $parsedResult['unique_words'],
        ], 'Article submitted for processing');
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

        if (!$articleData) {
            return $this->error('Article data not found in cache', 404);
        }

        $responseData = [
            'task_id' => $task->task_id,
            'status' => $task->status,
            'progress' => $task->progress,
            'error' => null,
        ];

        if ($task->error) {
            $responseData['error'] = $task->error;
        }

        if ($task->status === GlobalTask::STATUS_COMPLETED) {
            $responseData['article_data'] = [
                'article_text' => $articleData['article_text'],
                'language' => $articleData['language'],
                'sentences' => $articleData['sentences'],
                'words' => $articleData['words'],
                'word_frequency' => $articleData['word_frequency'],
                'total_sentences' => $articleData['total_sentences'],
                'total_words' => $articleData['total_words'],
                'unique_words' => $articleData['unique_words'],
                'sentence_audio_urls' => $articleData['sentence_audio_urls'],
                'word_audio_urls' => $articleData['word_audio_urls'],
            ];
        } else {
            $responseData['article_data'] = [
                'total_sentences' => $articleData['total_sentences'],
                'total_words' => $articleData['total_words'],
                'unique_words' => $articleData['unique_words'],
            ];
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
