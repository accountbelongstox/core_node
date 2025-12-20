<?php

namespace App\Services\TimerTasks;

use App\Services\EdgeTTS\EdgeTTSService;
use App\CallPycoreUtils\PycoreGoogleTranslateUtil;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TTSQueueService;
use App\Services\Workers\AppQyV1ArticleTTSWorker;
use App\Models\GlobalTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AppQyV1TTSGenerationTask extends OctaneTimerTaskAbstract
{
    private $ttsService;
    private $queueService;
    private $batchSize = 20;
    private $maxRetries = 3;
    private $retryDelay = 5;
    private $queueBatchSize = 10;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
        $this->queueService = new AppQyV1TTSQueueService();
    }
    
    public function getName(): string
    {
        return 'appqyv1_tts_generation';
    }
    
    public function getInterval(): int
    {
        return 60;
    }
    
    public function exec(): void
    {
        try {
            $this->processQueue();

            $this->processArticleTasks();

            $this->logInfo('Starting TTS and translation batch generation');

            $languageCodes = ['en', 'ja', 'ko', 'vi', 'lo'];
            $ttsGenerated = 0;
            $translated = 0;
            $markedInvalid = 0;
            $errors = 0;

            foreach ($languageCodes as $langCode) {
                $words = AppQyV1LangDictionaryModel::forLanguage($langCode)
                    ->where(function($query) {
                        $query->where('has_translation', false)
                            ->orWhereNull('translations')
                            ->orWhereNull('tts_files')
                            ->orWhere('tts_files', '')
                            ->orWhere('tts_files', '[]');
                    })
                    ->orderBy('query_count', 'desc')
                    ->limit($this->batchSize)
                    ->get();

                if ($words->isEmpty()) {
                    continue;
                }

                $wordsNeedingTranslation = [];
                $wordTexts = [];

                foreach ($words as $word) {
                    $content = $word->content;
                    $wordTexts[] = $content;

                    if (!$word->has_translation || empty($word->translations)) {
                        $wordsNeedingTranslation[] = [
                            'content' => $content,
                            'md5' => $word->md5,
                        ];
                    }
                }

                if (!empty($wordsNeedingTranslation)) {
                    $this->logInfo("Translating " . count($wordsNeedingTranslation) . " {$langCode} words to zh");

                    $textsToTranslate = array_column($wordsNeedingTranslation, 'content');

                    $result = PycoreGoogleTranslateUtil::translateBatch(
                        $textsToTranslate,
                        $langCode,
                        'zh',
                        true
                    );

                    if ($result['success'] && isset($result['results'])) {
                        foreach ($wordsNeedingTranslation as $index => $wordData) {
                            $translationResult = $result['results'][$index] ?? null;

                            if ($translationResult && !isset($translationResult['error'])) {
                                $originalText = $translationResult['original_text'];
                                $translatedText = $translationResult['translated_text'];

                                if (strtolower($translatedText) === strtolower($originalText)) {
                                    AppQyV1LangDictionaryModel::updateWord($langCode, $wordData['md5'], [
                                        'has_translation' => false,
                                        'translations' => json_encode(['error' => 'not_a_valid_word']),
                                    ]);

                                    $markedInvalid++;
                                    $this->logInfo("Marked as invalid word: {$originalText}");
                                } else {
                                    AppQyV1LangDictionaryModel::updateWord($langCode, $wordData['md5'], [
                                        'has_translation' => true,
                                        'translations' => json_encode([
                                            'zh' => $translatedText,
                                            'pronunciation' => $translationResult['pronunciation'] ?? null,
                                        ]),
                                        'translation_provider' => 'google:pycore',
                                    ]);

                                    $translated++;
                                    $this->logInfo("Translated: {$originalText} -> {$translatedText}");
                                }
                            } else {
                                $errors++;
                                $errorMsg = $translationResult['error'] ?? 'Unknown error';
                                $this->logError("Failed to translate: {$wordData['content']}", ['error' => $errorMsg]);
                            }

                            usleep(100000);
                        }
                    } else {
                        $errors += count($wordsNeedingTranslation);
                        $this->logError("Batch translation failed", ['error' => $result['error'] ?? 'Unknown']);
                    }
                }

                foreach ($words as $word) {
                    $ttsFiles = $word->tts_files ?? [];

                    if (!empty($ttsFiles) && count($ttsFiles) > 0) {
                        continue;
                    }

                    if (isset($word->translations['error'])) {
                        continue;
                    }

                    $result = $this->generateWithRetry($word->content, $langCode);

                    if ($result['success']) {
                        $ttsGenerated++;
                        $this->logInfo("Generated TTS for: {$word->content} ({$langCode})");
                    } else {
                        $errors++;
                        $this->logError("Failed to generate TTS for: {$word->content} ({$langCode})", [
                            'error' => $result['error'] ?? 'Unknown error'
                        ]);
                    }

                    usleep(200000);
                }
            }

            if ($ttsGenerated > 0 || $translated > 0 || $markedInvalid > 0 || $errors > 0) {
                $this->logInfo('TTS and translation batch completed', [
                    'tts_generated' => $ttsGenerated,
                    'translated' => $translated,
                    'marked_invalid' => $markedInvalid,
                    'errors' => $errors
                ]);
            }

        } catch (\Throwable $e) {
            $this->logError('TTS/Translation generation task failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
    
    private function generateWithRetry(string $word, string $langCode): array
    {
        $attempts = 0;
        
        while ($attempts < $this->maxRetries) {
            $result = $this->ttsService->generateAudio($word, $langCode, 'word');
            
            if ($result['success']) {
                return $result;
            }
            
            $attempts++;
            
            if ($attempts < $this->maxRetries) {
                $this->logInfo("TTS generation failed, retrying in {$this->retryDelay}s (attempt {$attempts}/{$this->maxRetries})", [
                    'word' => $word,
                    'language' => $langCode
                ]);
                
                sleep($this->retryDelay);
            }
        }
        
        return [
            'success' => false,
            'error' => 'Max retries reached'
        ];
    }
    
    public function isEnabled(): bool
    {
        return env('APPQYV1_TTS_AUTO_GENERATION', true);
    }

    /**
     * Process TTS queue (priority 1)
     * Process user-requested words first before auto-generation
     */
    private function processQueue(): void
    {
        $result = $this->queueService->processQueue($this->queueBatchSize);

        if ($result['processed'] > 0) {
            $this->logInfo('[TTSQueue] Processed queue items', [
                'processed' => $result['processed'],
                'succeeded' => $result['succeeded'],
                'failed' => $result['failed'],
            ]);
        }

        if ($result['processed'] > 0) {
            $this->queueService->cleanQueue(7);
        }
    }

    /**
     * Process article TTS generation tasks
     * Process one task at a time as requested
     */
    private function processArticleTasks(): void
    {
        $task = GlobalTask::where('app_name', 'AppQyV1')
            ->where('task_type', 'article_tts_generation')
            ->where('execution_type', GlobalTask::EXECUTION_LOCAL_TIMER)
            ->pending()
            ->orderBy('priority', 'desc')
            ->orderBy('created_at', 'asc')
            ->first();

        if (!$task) {
            return;
        }

        $this->logInfo('[ArticleTTS] Processing article task', [
            'task_id' => $task->task_id,
        ]);

        try {
            AppQyV1ArticleTTSWorker::process($task->task_id);

            $this->logInfo('[ArticleTTS] Article task completed', [
                'task_id' => $task->task_id,
            ]);
        } catch (\Throwable $e) {
            $this->logError('[ArticleTTS] Article task failed', [
                'task_id' => $task->task_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            $task->fail($e->getMessage());
        }
    }
}
