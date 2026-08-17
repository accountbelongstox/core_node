<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Services\UserConfig\UserConfigService;
use App\Support\QueueCenterContract;

/**
 * Word Validity Auto-Scan (invalid-word detection lane).
 *
 * Background enqueuer that pulls a batch of NOT-YET-CHECKED words
 * (validity_checked_at IS NULL — every unchecked word is verified once,
 * translated or not) and hands them to a chrome web-LLM worker
 * (word_validity / remote_validity) which classifies each as a real dictionary
 * word or nonsense AND translates the valid ones in the same pass. The
 * result-trust writeback then marks is_valid in bulk (validity_source
 * 'ai_ensure'), so the translation enqueue
 * (AppQyV1LangDictionaryModel::untranslatedRows, is_valid=true
 * filter) permanently skips the junk — no wasted translation lookups.
 *
 * Selection keys on validity_checked_at IS NULL, so a once-checked word is never
 * re-pulled (no re-classification storm). query_count DESC prioritises the words
 * users actually hit. The pile-up guard skips a language that already has a
 * pending validity batch. With no unchecked backlog the pass is a no-op (idle).
 *
 * Registered automatically by the auto-discovering OctaneTimerServiceProvider
 * (sys:init wires it in). Default ON; user-data settings can still disable it.
 */
class AppQyV1WordValidityScanTask extends DiffQueueFeederTaskAbstract
{
    private const PRIORITY_LOW = 0;
    private const MAX_RETRIES = 3;

    public function getName(): string
    {
        return 'appqyv1_word_validity_scan';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function isEnabled(): bool
    {
        return (bool) app(UserConfigService::class)->get(UserConfigService::APPQYV1_VALIDITY_SCAN, true);
    }

    public function exec(): void
    {
        $languages = AppQyV1DictionaryService::scanAvailableLanguages();
        if (empty($languages)) {
            return;
        }

        $totalCreated = 0;

        foreach ($languages as $langCode) {
            // Don't pile up: one in-flight validity batch per language is enough.
            if ($this->countPendingForLanguage($langCode) > 0) {
                continue;
            }

            $model = AppQyV1LangDictionaryModel::forLanguage($langCode)->getModel();
            $scope = 'word_validity:' . $langCode . ':' . $model->getTable();
            $batchSize = QueueCenterContract::wordValidityBatchSize();
            $page = $this->rowsForPendingPage(
                $scope,
                $model,
                $batchSize,
                static fn (array $ids): array => AppQyV1LangDictionaryModel::pendingValidityScanRows(
                    $langCode,
                    $ids
                ),
                // The validity batch size is contract-owned; the generic
                // data-segment clamp must not shrink it.
                $batchSize
            );
            if ($page['rows'] === [] && ($page['page'] ?? 0) === 0) {
                continue;
            }

            try {
                if ($page['rows'] !== []) {
                    $this->createTask($langCode, $page['rows']);
                    $totalCreated++;
                }
                $this->consumePendingPage($scope, $page);
            } catch (\Throwable $e) {
                $this->logWarning('Background word_validity page failed', [
                    'language' => $langCode,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Background word_validity tasks enqueued', [
                'total_tasks' => $totalCreated,
            ]);
        }
    }

    private function countPendingForLanguage(string $langCode): int
    {
        return GlobalTask::liveTaskCount(
            'AppQyV1',
            ['word_validity'],
            [
                GlobalTask::status('pending'),
                GlobalTask::status('assigned'),
                GlobalTask::status('processing'),
            ],
            ['language' => $langCode]
        );
    }

    private function createTask(string $langCode, array $words): void
    {
        $payload = [
            'words' => array_values($words),
            'language' => $langCode,
            // One-pass validity + translation (2.4): the worker returns a
            // verdict AND the target-language translation for every valid word.
            'target_language' => 'zh',
            'word_count' => count($words),
        ];

        // Dedicated remote_validity lane: the chrome web-LLM validity worker is
        // the only subscriber, so a word_validity task can never be fail-released
        // by a word_translation / prompt_translation worker (retry-burn). capability
        // stays null (routed purely by execution_type + task_type).
        $this->taskManager->createTask(
            'AppQyV1',
            'word_validity',
            GlobalTask::executionType('remote_validity'),
            $payload,
            600,
            self::PRIORITY_LOW,
            self::MAX_RETRIES
        );
    }
}
