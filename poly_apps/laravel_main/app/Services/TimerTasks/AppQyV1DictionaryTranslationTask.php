<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Support\QueueCenterContract;

/**
 * Automatic Dictionary Translation Task Creator
 *
 * Advances a persistent ID cursor across each available language dictionary and
 * creates translation tasks only after one bounded ID page is requested.
 * Executes every 30 seconds.
 *
 * Key Features:
 * - Auto-Discovery: Uses the cached available-language catalog
 * - Smart Filtering: Only processes languages with actual data in database
 * - Real Data: Backend always returns REAL untranslated words from database
 * - Worker Control: Frontend Worker decides demo mode or production mode
 * - Scalable: No hardcoded language list, fully automatic expansion
 *
 * Implementation:
 * 1. Calls AppQyV1DictionaryService::scanAvailableLanguages()
 * 2. Reads one persistent DIFF ID page per language with available capacity
 * 3. Materializes only that page and creates tasks for untranslated words
 * 4. Distributes tasks to Worker queue for processing
 */
class AppQyV1DictionaryTranslationTask extends DiffQueueFeederTaskAbstract
{
    private const BATCH_SIZE = 10;
    private const MAX_TASKS_PER_LANGUAGE = 2;

    /**
     * Timer interval in seconds
     * @return int Interval in seconds
     */
    public function getInterval(): int
    {
        return 30;
    }

    /**
     * Execute automatic task creation cycle
     * Automatically scans ALL language dictionaries in database
     * and creates translation tasks for untranslated words
     */
    public function exec(): void
    {
        $totalCreated = 0;
        $languages = AppQyV1DictionaryService::scanAvailableLanguages();
        if ($languages === []) {
            return;
        }

        foreach ($languages as $langCode) {
            $pendingCount = $this->liveTaskCount(
                ['dictionary_explanation', 'dictionary_explanation_demo'],
                ['language' => $langCode]
            );
            if ($pendingCount >= self::MAX_TASKS_PER_LANGUAGE) {
                continue;
            }

            $model = AppQyV1LangDictionaryModel::forLanguage($langCode)->getModel();
            $scope = 'dictionary_explanation:' . $langCode . ':' . $model->getTable();
            $limit = self::BATCH_SIZE * (self::MAX_TASKS_PER_LANGUAGE - $pendingCount);
            $page = $this->rowsForPendingPage(
                $scope,
                $model,
                $limit,
                static fn (array $ids): array => AppQyV1LangDictionaryModel::pendingTranslationRows(
                    $langCode,
                    $ids,
                    true
                )
            );

            try {
                foreach (array_chunk($page['rows'], self::BATCH_SIZE) as $words) {
                    $this->createTask($langCode, $words);
                    $totalCreated++;
                }
                $this->consumePendingPage($scope, $page);
            } catch (\Throwable $e) {
                $this->logWarning('Dictionary explanation page failed', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Auto task creation cycle completed', [
                'total_tasks_created' => $totalCreated,
            ]);
        }
    }

    private function createTask(string $language, array $words): void
    {
        $taskType = (string) QueueCenterContract::taskTypeKey('dictionary_explanation');
        $timeoutSeconds = min(600, 60 + (count($words) * 3));
        $this->taskManager->createTask(
            'AppQyV1',
            $taskType,
            (string) QueueCenterContract::taskTypeExecution($taskType),
            [
                'words' => array_values($words),
                'language' => $language,
                'word_count' => count($words),
            ],
            $timeoutSeconds,
            QueueCenterContract::taskPriority('manual'),
            3
        );
    }
}
