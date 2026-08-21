<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;

/**
 * Word Translation Auto-Scan
 *
 * Background half of the enqueue side. Scans each available language dictionary
 * and enqueues word_translation tasks at LOW
 * priority for untranslated words. This lets background translation proceed with
 * no frontend involvement; FE-enqueued visible words use HIGH priority and are
 * pulled first.
 *
 * Tasks created here are identical in shape to the FE ones, so both the pycore
 * Google worker and the Laravel AI self-filler consume them via atomic claim.
 *
 * The default target language is Chinese (zh); the source language is whatever
 * dictionary the words live in.
 */
class AppQyV1WordTranslationScanTask extends QueueFeederTaskAbstract
{
    // Background priority. Lower than FE-enqueued visible words (HIGH = 100).
    private const PRIORITY_LOW = 0;

    private const TARGET_LANGUAGE = 'zh';
    private const WORDS_PER_TASK = 40;
    private const MAX_TASKS_PER_LANGUAGE = 1;

    public function getInterval(): int
    {
        return 60;
    }

    public function exec(): void
    {
        $languages = AppQyV1DictionaryService::scanAvailableLanguages();
        if ($languages === []) {
            return;
        }

        $totalCreated = 0;

        foreach ($languages as $langCode) {
            // Do not pile up: skip languages that already have plenty of pending
            // background word_translation tasks waiting.
            $pendingCount = $this->liveTaskCount('word_translation', [
                'language' => AppQyV1DictionaryService::getLanguageCode($langCode),
                'target_language' => AppQyV1DictionaryService::getLanguageCode(self::TARGET_LANGUAGE),
            ]);
            if ($pendingCount >= self::MAX_TASKS_PER_LANGUAGE) {
                continue;
            }

            $words = AppQyV1LangDictionaryModel::untranslatedRows(
                $langCode,
                self::WORDS_PER_TASK
            )
                ->pluck('content')
                ->map(static fn ($word): string => trim((string) $word))
                ->filter(static fn (string $word): bool => $word !== '')
                ->values()
                ->all();
            if ($words === []) {
                continue;
            }

            try {
                $this->createTask($langCode, $words);
                $totalCreated++;
            } catch (\Throwable $e) {
                $this->logWarning('Background word_translation page failed', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background word_translation tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    private function createTask(string $language, array $words): void
    {
        $timeoutSeconds = 60 + (count($words) * 3);
        if ($timeoutSeconds > 600) {
            $timeoutSeconds = 600;
        }

        $payload = [
            'words' => array_values($words),
            // Normalized code so the DB-side pending count (countPendingForLanguage)
            // can match payload->language without PHP normalization.
            'language' => AppQyV1DictionaryService::getLanguageCode($language),
            'target_language' => self::TARGET_LANGUAGE, // already a code ('zh')
            'word_count' => count($words),
        ];

        $this->taskManager->createTask(
            'AppQyV1',
            'word_translation',
            GlobalTask::executionType('remote_translation'),
            $payload,
            $timeoutSeconds,
            self::PRIORITY_LOW,
            3
        );
    }
}
