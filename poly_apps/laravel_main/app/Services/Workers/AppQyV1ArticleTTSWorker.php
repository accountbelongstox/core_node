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


namespace App\Services\Workers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Str;
use App\Models\GlobalTask;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1Article;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleWord;

class AppQyV1ArticleTTSWorker
{
    protected $ttsService;

    public function __construct(EdgeTTSService $ttsService)
    {
        $this->ttsService = $ttsService;
    }

    /**
     * Process article TTS generation task
     *
     * @param GlobalTask $task
     * @return void
     */
    public function processTask(GlobalTask $task): void
    {
        $this->ensureTablesExist();

        Log::info('[AppQyV1ArticleTTSWorker] Starting task processing', [
            'task_id' => $task->task_id,
        ]);

        $task->startProcessing();

        $cacheKey = "article_task:{$task->task_id}";
        $articleData = Cache::get($cacheKey);

        if (!$articleData) {
            $errorMessage = 'Article data not found in cache';
            Log::error('[AppQyV1ArticleTTSWorker] ' . $errorMessage, [
                'task_id' => $task->task_id,
                'cache_key' => $cacheKey,
            ]);
            $task->fail($errorMessage);
            return;
        }

        $language = $articleData['language'];
        $sentences = $articleData['sentences'];
        $words = $articleData['words'];
        $generateSentenceAudio = $articleData['generate_sentence_audio'];
        $generateWordAudio = $articleData['generate_word_audio'];

        $langCode = $this->mapLanguageToCode($language);

        $totalSteps = 0;
        if ($generateSentenceAudio) {
            $totalSteps += count($sentences);
        }
        if ($generateWordAudio) {
            $totalSteps += count($words);
        }

        if ($totalSteps === 0) {
            Log::info('[AppQyV1ArticleTTSWorker] No audio generation requested', [
                'task_id' => $task->task_id,
            ]);
            $task->complete([
                'message' => 'No audio generation requested',
            ]);
            return;
        }

        $currentStep = 0;

        if ($generateSentenceAudio) {
            Log::info('[AppQyV1ArticleTTSWorker] Generating sentence audio', [
                'task_id' => $task->task_id,
                'sentence_count' => count($sentences),
            ]);

            $sentenceAudioUrls = [];
            foreach ($sentences as $index => $sentence) {
                $result = $this->ttsService->generateAudio($sentence, $langCode, 'sentence');
                $result = $this->fixAudioUrl($result);

                if ($result['success']) {
                    $sentenceAudioUrls[] = [
                        'sentence' => $sentence,
                        'audio_url' => $result['audio_url'],
                    ];
                } else {
                    Log::warning('[AppQyV1ArticleTTSWorker] Failed to generate sentence audio', [
                        'task_id' => $task->task_id,
                        'sentence_index' => $index,
                        'error' => $result['error'],
                    ]);
                }

                $currentStep++;
                $progress = ($currentStep / $totalSteps) * 100;
                $task->progress = $progress;
                $task->save();
            }

            $articleData['sentence_audio_urls'] = $sentenceAudioUrls;
            Cache::put($cacheKey, $articleData, 3600);
        }

        if ($generateWordAudio) {
            Log::info('[AppQyV1ArticleTTSWorker] Generating word audio', [
                'task_id' => $task->task_id,
                'word_count' => count($words),
            ]);

            $wordAudioUrls = [];
            foreach ($words as $index => $word) {
                $result = $this->ttsService->generateAudio($word, $langCode, 'word');
                $result = $this->fixAudioUrl($result);

                if ($result['success']) {
                    $wordAudioUrls[] = [
                        'word' => $word,
                        'audio_url' => $result['audio_url'],
                    ];
                } else {
                    Log::warning('[AppQyV1ArticleTTSWorker] Failed to generate word audio', [
                        'task_id' => $task->task_id,
                        'word_index' => $index,
                        'error' => $result['error'],
                    ]);
                }

                $currentStep++;
                $progress = ($currentStep / $totalSteps) * 100;
                $task->progress = $progress;
                $task->save();
            }

            $articleData['word_audio_urls'] = $wordAudioUrls;
            Cache::put($cacheKey, $articleData, 3600);
        }

        $articleId = 'article_' . Str::uuid();

        try {
            $article = AppQyV1Article::createFromTaskData($articleId, $task->task_id, $articleData);

            AppQyV1ArticleWord::createFromArticleWords(
                $articleId,
                $articleData['words'],
                $articleData['word_frequency'],
                $language
            );

            Log::info('[AppQyV1ArticleTTSWorker] Article saved to database', [
                'task_id' => $task->task_id,
                'article_id' => $articleId,
            ]);
        } catch (\Throwable $e) {
            Log::error('[AppQyV1ArticleTTSWorker] Failed to save article to database', [
                'task_id' => $task->task_id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::info('[AppQyV1ArticleTTSWorker] Task completed successfully', [
            'task_id' => $task->task_id,
            'article_id' => $articleId,
            'sentence_audio_count' => count($articleData['sentence_audio_urls']),
            'word_audio_count' => count($articleData['word_audio_urls']),
        ]);

        $task->complete([
            'message' => 'Article TTS generation completed',
            'article_id' => $articleId,
            'sentence_audio_count' => count($articleData['sentence_audio_urls']),
            'word_audio_count' => count($articleData['word_audio_urls']),
        ]);
    }

    /**
     * Map language name to Edge TTS language code
     *
     * @param string $language
     * @return string
     */
    private function mapLanguageToCode(string $language): string
    {
        $languageMap = [
            'english' => 'en',
            'chinese' => 'zh',
            'spanish' => 'es',
            'french' => 'fr',
            'german' => 'de',
            'japanese' => 'ja',
            'korean' => 'ko',
        ];

        if (isset($languageMap[$language])) {
            return $languageMap[$language];
        }

        return 'en';
    }

    /**
     * Static method to process task (for timer integration)
     *
     * @param string $taskId
     * @return void
     */
    public static function process(string $taskId): void
    {
        $task = GlobalTask::where('task_id', $taskId)->first();

        if (!$task) {
            Log::error('[AppQyV1ArticleTTSWorker] Task not found', [
                'task_id' => $taskId,
            ]);
            return;
        }

        $ttsService = app(EdgeTTSService::class);
        $worker = new self($ttsService);
        $worker->processTask($task);
    }

    /**
     * Ensure article tables exist
     *
     * @return void
     */
    private function ensureTablesExist(): void
    {
        $connection = 'AppQyV1';

        if (!Schema::connection($connection)->hasTable('app_qy_v1_articles')) {
            Schema::connection($connection)->create('app_qy_v1_articles', function (Blueprint $table) {
                $table->id();
                $table->string('article_id', 64)->unique()->comment('Unique article identifier');
                $table->unsignedBigInteger('user_id')->comment('User ID who created this article');
                $table->string('title')->nullable()->comment('Article title');
                $table->text('content')->comment('Article content');
                $table->string('language', 20)->default('english')->comment('Article language');
                $table->string('article_type', 50)->default('general')->comment('Article type for categorization');
                $table->string('source')->nullable()->comment('Source of the article');
                $table->string('difficulty_level', 20)->nullable()->comment('Difficulty level');
                $table->integer('word_count')->default(0)->comment('Total word count');
                $table->integer('unique_word_count')->default(0)->comment('Unique word count');
                $table->integer('sentence_count')->default(0)->comment('Total sentence count');
                $table->boolean('is_daily_reading')->default(false)->comment('Is daily reading article');
                $table->date('reading_date')->nullable()->comment('Date for daily reading');
                $table->string('task_id', 64)->nullable()->comment('Associated task ID');
                $table->boolean('tts_generated')->default(false)->comment('TTS audio generated');
                $table->json('metadata')->nullable()->comment('Additional metadata');
                $table->timestamps();

                $table->index('article_id');
                $table->index('user_id');
                $table->index('language');
                $table->index('article_type');
                $table->index('is_daily_reading');
                $table->index('reading_date');
                $table->index('task_id');
            });

            Log::info('[AppQyV1ArticleTTSWorker] Created app_qy_v1_articles table');
        }

        if (!Schema::connection($connection)->hasTable('app_qy_v1_article_words')) {
            Schema::connection($connection)->create('app_qy_v1_article_words', function (Blueprint $table) {
                $table->id();
                $table->string('article_id', 64)->comment('Article ID reference');
                $table->string('word_md5', 32)->comment('Word MD5 from dictionary');
                $table->string('word', 255)->comment('The actual word text');
                $table->string('language', 20)->comment('Word language');
                $table->integer('frequency')->default(1)->comment('Frequency in article');
                $table->boolean('is_new_for_user')->default(false)->comment('Is new word for user');
                $table->timestamps();

                $table->index('article_id');
                $table->index('word_md5');
                $table->index('language');
                $table->unique(['article_id', 'word_md5']);
            });

            Log::info('[AppQyV1ArticleTTSWorker] Created app_qy_v1_article_words table');
        }
    }

    /**
     * Fix audio_url path to use AppQyV1 route prefix
     * Convert /tts/audio/... to /api/app_qy_v1/ai_tools/tts/audio/...
     */
    private function fixAudioUrl(array $result): array
    {
        if (isset($result['audio_url'])) {
            if (strpos($result['audio_url'], '/tts/audio/') === 0) {
                $result['audio_url'] = str_replace('/tts/audio/', '/api/app_qy_v1/ai_tools/tts/audio/', $result['audio_url']);
            }
        }

        return $result;
    }
}
