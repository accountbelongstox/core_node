<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use Illuminate\Support\Facades\Log;

/**
 * Automatic Dictionary Translation Task Creator
 *
 * Automatically scans ALL language dictionaries via Octane Timer (heartbeat center)
 * and creates translation tasks for untranslated words found in ANY language.
 * Executes every 30 seconds.
 *
 * Key Features:
 * - Auto-Discovery: Scans all 91 supported language tables automatically
 * - Smart Filtering: Only processes languages with actual data in database
 * - Real Data: Backend always returns REAL untranslated words from database
 * - Worker Control: Frontend Worker decides demo mode or production mode
 * - Scalable: No hardcoded language list, fully automatic expansion
 *
 * Implementation:
 * 1. Calls AppQyV1DictionaryService::scanAvailableLanguages()
 * 2. Gets statistics for each language with data
 * 3. Creates translation tasks for languages with untranslated words
 * 4. Distributes tasks to Worker queue for processing
 */
class AppQyV1DictionaryTranslationTask extends OctaneTimerTaskAbstract
{
    private $taskManager;
    private $translationService;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
        $this->translationService = new AppQyV1TranslationTaskService($this->taskManager);
    }

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
        $languagesProcessed = 0;

        $allLanguageStats = AppQyV1DictionaryService::getAllLanguageStatistics();

        if (empty($allLanguageStats)) {
            $this->logDebug('No language dictionaries with data found');
            return;
        }

        $this->logInfo('Starting auto task creation cycle', [
            'available_languages' => count($allLanguageStats),
        ]);

        foreach ($allLanguageStats as $langCode => $stats) {
            if ($stats['untranslated'] == 0) {
                continue;
            }

            $languagesProcessed++;

            $languageName = $this->getLanguageNameFromStats($stats);

            $this->logInfo('Found untranslated words', [
                'lang_code' => $langCode,
                'language_name' => $languageName,
                'untranslated_count' => $stats['untranslated'],
                'total_words' => $stats['total_words'],
                'progress' => $stats['translation_progress'] . '%',
            ]);

            $batchSize = 10;
            $maxTasksPerLanguage = 2;
            $createdCount = 0;

            // Do not pile up: these dictionary_explanation tasks are consumed
            // only by the browser-side remote_client worker, which may be
            // offline for long stretches. Without this cap the 30s tick keeps
            // appending tasks forever (the mis-routed remote_translation
            // consumers used to drain them by failing them, masking this).
            $pendingCount = $this->countPendingForLanguage($languageName);
            if ($pendingCount >= $maxTasksPerLanguage) {
                continue;
            }

            for ($i = 0; $i < $maxTasksPerLanguage; $i++) {
                $result = $this->translationService->createDictionaryExplanationTask(
                    $languageName,
                    $batchSize
                );

                if ($result['status'] === 'no_words_needed') {
                    break;
                }

                $createdCount++;
                $totalCreated++;

                $this->logInfo('Translation task created', [
                    'lang_code' => $langCode,
                    'language_name' => $languageName,
                    'task_id' => $result['task_id'],
                    'word_count' => $result['word_count'],
                ]);

                if ($stats['untranslated'] <= $batchSize * $createdCount) {
                    break;
                }
            }

            if ($createdCount > 0) {
                $this->logInfo('Language task creation completed', [
                    'lang_code' => $langCode,
                    'tasks_created' => $createdCount,
                    'remaining_untranslated' => max(0, $stats['untranslated'] - ($batchSize * $createdCount)),
                ]);
            }
        }

        if ($totalCreated > 0) {
            $this->logInfo('Auto task creation cycle completed', [
                'total_tasks_created' => $totalCreated,
                'languages_processed' => $languagesProcessed,
            ]);
        } else {
            $this->logDebug('No tasks created in this cycle', [
                'available_languages' => count($allLanguageStats),
            ]);
        }
    }

    /**
     * Count PENDING dictionary_explanation tasks for one language so the tick
     * tops the queue up to the cap instead of growing it unboundedly.
     * createDictionaryExplanationTask stores the language NAME in the payload,
     * so match on that (json column predicate on the index-backed subset).
     */
    private function countPendingForLanguage(string $languageName): int
    {
        return GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->whereIn('task_type', ['dictionary_explanation', 'dictionary_explanation_demo'])
            ->where('status', GlobalTask::STATUS_PENDING)
            ->where('payload->language', $languageName)
            ->count();
    }

    /**
     * Extract language name from statistics array
     * @param array $stats Statistics array
     * @return string Language name
     */
    private function getLanguageNameFromStats(array $stats): string
    {
        if (isset($stats['language'])) {
            return $stats['language'];
        }

        if (isset($stats['language_code'])) {
            return $stats['language_code'];
        }

        return 'unknown';
    }
}
