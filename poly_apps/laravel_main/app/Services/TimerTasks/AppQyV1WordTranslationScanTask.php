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
class AppQyV1WordTranslationScanTask extends DiffQueueFeederTaskAbstract
{
    // Background priority. Lower than FE-enqueued visible words (HIGH = 100).
    private const PRIORITY_LOW = 0;

    private const TARGET_LANGUAGE = 'zh';
    private const WORDS_PER_TASK = 40;
    private const MAX_TASKS_PER_LANGUAGE = 2;

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
            $pendingCount = $this->countPendingForLanguage($langCode);
            if ($pendingCount >= self::MAX_TASKS_PER_LANGUAGE) {
                continue;
            }

            $model = AppQyV1LangDictionaryModel::forLanguage($langCode)->getModel();
            $scope = 'word_translation:' . $langCode . ':' . $model->getTable();
            $limit = self::WORDS_PER_TASK * (self::MAX_TASKS_PER_LANGUAGE - $pendingCount);
            $page = $this->rowsForPendingPage(
                $scope,
                $model->newQuery(),
                $limit,
                static function (array $ids) use ($model): array {
                    return $model->newQuery()
                        ->whereIn('id', $ids)
                        ->where('has_translation', false)
                        ->where('is_valid', true)
                        ->orderByDesc('query_count')
                        ->get(['id', 'content', 'md5'])
                        ->map(static fn ($row): array => [
                            'word' => (string) ($row->content ?? ''),
                            'md5' => (string) ($row->md5 ?? ''),
                        ])
                        ->all();
                }
            );
            $words = array_values(array_filter(
                $page['rows'],
                static fn (array $row): bool => $row['word'] !== ''
            ));
            if ($words === [] && ($page['page'] ?? 0) === 0) {
                continue;
            }

            $pageFailed = false;
            try {
                foreach (array_chunk(array_column($words, 'word'), self::WORDS_PER_TASK) as $chunk) {
                    $this->createTask($langCode, $chunk);
                    $totalCreated++;
                }
            } catch (\Throwable $e) {
                $pageFailed = true;
                $this->logWarning('Background word_translation page failed', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }
            if (!$pageFailed) {
                $this->consumePendingPage($scope, $page);
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background word_translation tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    private function countPendingForLanguage(string $languageCode): int
    {
        $langCode = AppQyV1DictionaryService::getLanguageCode($languageCode);
        $targetCode = AppQyV1DictionaryService::getLanguageCode(self::TARGET_LANGUAGE);

        // Count at the DB by the normalized codes stored in the JSON payload,
        // instead of loading every pending task's payload and counting in PHP
        // once per language per 60s tick. The (app_name, task_type, status)
        // predicate is index-backed; the JSON predicate runs on that subset.
        return GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', 'word_translation')
            ->whereIn('status', [
                GlobalTask::status('pending'),
                GlobalTask::status('assigned'),
                GlobalTask::status('processing'),
            ])
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
