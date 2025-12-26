<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use Illuminate\Support\Facades\Log;

/**
 * TTS Queue Auto Loader Task
 *
 * Automatically loads words and articles without audio into the TTS queue
 * Runs every minute to ensure continuous TTS generation
 */
class AppQyV1TTSQueueAutoLoaderTask extends OctaneTimerTaskAbstract
{
    private $queueService;
    private $wordsPerLanguage = 1000;
    private $articlesPerLanguage = 100;

    public function __construct()
    {
        $this->queueService = new AppQyV1UnifiedTTSQueueService();
    }

    public function getName(): string
    {
        return 'appqyv1_tts_queue_auto_loader';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function exec(): void
    {
        try {
            $this->logInfo('Starting TTS queue auto-loader');

            $wordsLoaded = 0;
            $articlesLoaded = 0;
            $errors = 0;

            $languageCodes = ['en', 'ja', 'ko', 'vi', 'lo', 'zh'];

            foreach ($languageCodes as $langCode) {
                try {
                    $wordsAdded = $this->loadWordsForLanguage($langCode);
                    $wordsLoaded += $wordsAdded;

                    $articlesAdded = $this->loadArticlesForLanguage($langCode);
                    $articlesLoaded += $articlesAdded;
                } catch (\Throwable $e) {
                    $errors++;
                    $this->logError("Failed to load content for language: {$langCode}", [
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            if ($wordsLoaded > 0 || $articlesLoaded > 0 || $errors > 0) {
                $this->logInfo('TTS queue auto-loader completed', [
                    'words_loaded' => $wordsLoaded,
                    'articles_loaded' => $articlesLoaded,
                    'errors' => $errors,
                ]);
            }
        } catch (\Throwable $e) {
            $this->logError('TTS queue auto-loader task failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    private function loadWordsForLanguage(string $langCode): int
    {
        $wordsWithoutAudio = AppQyV1LangDictionaryModel::getWordsWithoutTTS(
            $langCode,
            $this->wordsPerLanguage,
            true
        );

        if ($wordsWithoutAudio->isEmpty()) {
            return 0;
        }

        $loaded = 0;

        foreach ($wordsWithoutAudio as $word) {
            try {
                $result = $this->queueService->addTask(
                    $word->content,
                    $langCode,
                    'word',
                    30
                );

                if ($result['success']) {
                    $loaded++;
                    $this->logInfo("Loaded word to queue: {$word->content} ({$langCode})");
                } else {
                    $this->logError("Failed to load word to queue: {$word->content} ({$langCode})", [
                        'error' => $result['error'] ?? 'Unknown error',
                    ]);
                }
            } catch (\Throwable $e) {
                $this->logError("Exception loading word to queue: {$word->content} ({$langCode})", [
                    'error' => $e->getMessage(),
                ]);
            }

            usleep(50000);
        }

        return $loaded;
    }

    private function loadArticlesForLanguage(string $langCode): int
    {
        $articlesWithoutAudio = AppQyV1ArticleLibraryModel::getArticlesWithoutAudio(
            $langCode,
            $this->articlesPerLanguage,
            true
        );

        if ($articlesWithoutAudio->isEmpty()) {
            return 0;
        }

        $loaded = 0;

        foreach ($articlesWithoutAudio as $article) {
            try {
                $result = $this->queueService->addTask(
                    $article->content,
                    $langCode,
                    'article',
                    20
                );

                if ($result['success']) {
                    $loaded++;
                    $title = $article->title ?? substr($article->content, 0, 50);
                    $this->logInfo("Loaded article to queue: {$title} ({$langCode})");
                } else {
                    $this->logError("Failed to load article to queue", [
                        'language' => $langCode,
                        'error' => $result['error'] ?? 'Unknown error',
                    ]);
                }
            } catch (\Throwable $e) {
                $this->logError("Exception loading article to queue", [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }

            usleep(100000);
        }

        return $loaded;
    }

    public function isEnabled(): bool
    {
        return env('APPQYV1_TTS_AUTO_LOADER', true);
    }
}
