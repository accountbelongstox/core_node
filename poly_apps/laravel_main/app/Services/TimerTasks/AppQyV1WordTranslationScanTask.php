<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;

/**
 * Word Translation Auto-Scan
 *
 * Background half of the enqueue side. Scans every language dictionary that has
 * data (AppQyV1DictionaryService::getAllLanguageStatistics, now driven by the
 * full supported-language list) and enqueues word_translation tasks at LOW
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
class AppQyV1WordTranslationScanTask extends OctaneTimerTaskAbstract
{
    // Background priority. Lower than FE-enqueued visible words (HIGH = 100).
    private const PRIORITY_LOW = 0;

    private const TARGET_LANGUAGE = 'zh';
    private const WORDS_PER_TASK = 40;
    private const MAX_TASKS_PER_LANGUAGE = 2;

    private $taskManager;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function exec(): void
    {
        $allLanguageStats = AppQyV1DictionaryService::getAllLanguageStatistics();

        if (empty($allLanguageStats)) {
            return;
        }

        $totalCreated = 0;

        foreach ($allLanguageStats as $langCode => $stats) {
            $untranslated = $stats['untranslated'] ?? 0;
            if ($untranslated <= 0) {
                continue;
            }

            // Resolve a language name the dictionary service understands; the
            // hardened getLanguageCode() maps either name or code back to a code.
            $languageName = $stats['language'] ?? $langCode;

            // Do not pile up: skip languages that already have plenty of pending
            // background word_translation tasks waiting.
            $pendingCount = $this->countPendingForLanguage($languageName);
            if ($pendingCount >= self::MAX_TASKS_PER_LANGUAGE) {
                continue;
            }

            $words = AppQyV1DictionaryService::getUntranslatedWords(
                $languageName,
                self::WORDS_PER_TASK * (self::MAX_TASKS_PER_LANGUAGE - $pendingCount)
            );

            if (empty($words)) {
                continue;
            }

            $wordStrings = [];
            foreach ($words as $word) {
                if (isset($word['word']) && $word['word'] !== '') {
                    $wordStrings[] = $word['word'];
                }
            }

            foreach (array_chunk($wordStrings, self::WORDS_PER_TASK) as $chunk) {
                $this->createTask($languageName, $chunk);
                $totalCreated++;
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background word_translation tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    private function countPendingForLanguage(string $languageName): int
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($languageName);
        $targetCode = AppQyV1DictionaryService::getLanguageCode(self::TARGET_LANGUAGE);

        // Count at the DB by the normalized codes stored in the JSON payload,
        // instead of loading every pending task's payload and counting in PHP
        // once per language per 60s tick. The (app_name, task_type, status)
        // predicate is index-backed; the JSON predicate runs on that subset.
        return GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->where('status', GlobalTask::status('pending'))
            ->where('payload->language', $langCode)
            ->where('payload->target_language', $targetCode)
            ->count();
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
