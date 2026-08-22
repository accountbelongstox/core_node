<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Services\WorkerManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService;
use App\Services\UserConfig\UserConfigService;

/**
 * Word Translation AI Self-Filler
 *
 * Second consumer of the word_translation queue (the first is the pycore Google
 * worker). Registers an internal worker ("laravel-internal-ai", processor_types
 * ["remote_translation"]) and atomically claims a small batch of pending
 * word_translation tasks via TaskManagerService::pullAndAssignTasksForWorker.
 * The atomic claim is the same one pycore uses, so the two never double-process
 * a task.
 *
 * For each claimed task it translates every word to the target language via
 * AppQyV1TranslationService::translateWithFallback, which tries the configured
 * provider chain (config('AppQyV1.ai.fallback_chain'), default
 * OpenRouter -> Gemini -> DeepSeek -> pycore Google) until one succeeds. This
 * keeps the self-filler robust on weak servers: if the primary AI is down or
 * over-quota the word still gets translated by the next provider. It then
 * submits the result through TaskManagerService::submitResult, which routes back
 * into WordTranslationTaskProcessor, which writes translations[target_language]
 * into the dictionary. On total failure the task is reported failed for retry.
 */
class AppQyV1WordTranslationFillerTask extends TaskManagerTimerTaskAbstract
{
    private const WORKER_ID = 'laravel-internal-ai';
    private const WORKER_NAME = 'Laravel Internal AI Filler';

    // Claim a few tasks per cycle; keeps AI load and per-tick latency bounded.
    private const CLAIM_LIMIT = 2;

    // Translation type used for word translation. The provider order is no
    // longer hardcoded here: translateWithFallback() walks the configurable
    // chain (config AppQyV1.ai.fallback_chain) so a down/over-quota primary
    // provider transparently falls through to the next.
    private const TRANSLATION_TYPE = 'general';

    private WorkerManagerService $workerManager;

    public function __construct()
    {
        parent::__construct();
        $this->workerManager = app(WorkerManagerService::class);
    }

    public function getInterval(): int
    {
        return 45;
    }

    /**
     * Default OFF: Laravel must NOT proactively call large language models. This
     * self-filler is the only path that makes Laravel itself hit the AI gateway
     * (OpenRouter/Gemini/DeepSeek) on a timer -- the source of the recurring
     * 429 "Rate limit exceeded" errors. With it disabled, word_translation tasks
     * stay in the queue for pycore (the Google/remote worker) to claim via the
     * assist protocol, or are processed only when explicitly triggered from the
     * UI. Enable the user-data setting only where Laravel is intentionally
     * allowed to spend AI quota with no pycore worker present.
     */
    public function isEnabled(): bool
    {
        return (bool) app(UserConfigService::class)->get(
            UserConfigService::APPQYV1_WORD_TRANSLATION_FILLER_ENABLED,
            false
        );
    }

    public function exec(): void
    {
        $this->ensureWorkerRegistered();

        $tasks = $this->taskManager->pullAndAssignTasksForWorker(self::WORKER_ID, self::CLAIM_LIMIT);

        if (empty($tasks)) {
            return;
        }

        $translationService = new AppQyV1TranslationService();

        foreach ($tasks as $task) {
            if ($task->task_type !== 'word_translation') {
                // Not ours: release so a matching consumer can take it. The
                // worker is single-purpose, but guard against config drift.
                $this->taskManager->submitResult(
                    $task->task_id,
                    self::WORKER_ID,
                    'failed',
                    0,
                    null,
                    'Wrong task type for internal AI filler'
                );
                continue;
            }

            $this->processTask($translationService, $task);
        }
    }

    /**
     * Translate every word in a task payload and submit the completed result.
     */
    private function processTask(AppQyV1TranslationService $translationService, GlobalTask $task): void
    {
        $payload = $task->payload;
        $words = [];
        if (is_array($payload) && isset($payload['words']) && is_array($payload['words'])) {
            $words = $payload['words'];
        }

        $targetLanguage = 'zh';
        if (is_array($payload) && isset($payload['target_language']) && $payload['target_language'] !== '') {
            $targetLanguage = $payload['target_language'];
        }
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);

        if (empty($words)) {
            $this->taskManager->submitResult(
                $task->task_id,
                self::WORKER_ID,
                'failed',
                0,
                null,
                'No words in payload'
            );
            return;
        }

        $translations = [];
        $failures = 0;

        $usedProviders = [];

        foreach ($words as $word) {
            $result = $translationService->translateWithFallback(
                $word,
                $targetCode,
                self::TRANSLATION_TYPE,
                null,
                true
            );

            if (isset($result['success']) && $result['success'] === true && isset($result['translation'])) {
                $translations[] = [
                    'word' => $word,
                    'translation' => $result['translation'],
                ];
                if (!empty($result['provider'])) {
                    $usedProviders[$result['provider']] = true;
                }
            } else {
                $failures++;
            }
        }

        // Whole task failed (e.g. provider down): report failed so it retries.
        if (empty($translations)) {
            $this->taskManager->submitResult(
                $task->task_id,
                self::WORKER_ID,
                'failed',
                0,
                null,
                'AI translation produced no results'
            );
            $this->logWarning('Task produced no translations', [
                'task_id' => $task->task_id,
                'word_count' => count($words),
            ]);
            return;
        }

        // Provider label reflects whichever fallback link(s) actually produced
        // the translations (e.g. "openrouter" or "deepseek+google").
        $providerLabel = empty($usedProviders)
            ? 'laravel-ai'
            : implode('+', array_keys($usedProviders));

        // Submit; WordTranslationTaskProcessor performs the dictionary write-back.
        $this->taskManager->submitResult(
            $task->task_id,
            self::WORKER_ID,
            'completed',
            100,
            [
                'translations' => $translations,
                'target_language' => $targetCode,
                'provider' => $providerLabel,
            ],
            null
        );

        $this->logInfo('Task translated by internal AI filler', [
            'task_id' => $task->task_id,
            'translated' => count($translations),
            'failed' => $failures,
            'target_language' => $targetCode,
            'providers' => array_keys($usedProviders),
        ]);
    }

    /**
     * Register / refresh the internal worker so the atomic pull can assign to it.
     * Re-runs each cycle to keep the heartbeat fresh and survive worker cleanup.
     */
    private function ensureWorkerRegistered(): void
    {
        $this->workerManager->register(
            self::WORKER_ID,
            self::WORKER_NAME,
            [GlobalTask::executionType('remote_translation')],
            gethostname() ?: 'laravel',
            'laravel-octane',
            ['internal' => true, 'role' => 'word_translation_ai_filler']
        );
    }
}
