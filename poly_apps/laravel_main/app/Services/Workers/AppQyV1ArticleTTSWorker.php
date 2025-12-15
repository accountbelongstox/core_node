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
use App\Models\GlobalTask;
use App\Services\EdgeTTS\EdgeTTSService;

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

        Log::info('[AppQyV1ArticleTTSWorker] Task completed successfully', [
            'task_id' => $task->task_id,
            'sentence_audio_count' => count($articleData['sentence_audio_urls']),
            'word_audio_count' => count($articleData['word_audio_urls']),
        ]);

        $task->complete([
            'message' => 'Article TTS generation completed',
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
}
