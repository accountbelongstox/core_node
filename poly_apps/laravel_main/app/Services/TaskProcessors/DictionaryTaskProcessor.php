<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;
use App\Services\TaskManagerService;
use Illuminate\Support\Facades\Log;

/**
 * Dictionary Task Processor
 *
 * Handles dictionary explanation tasks for AppQyV1
 */
class DictionaryTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    protected function taskTypeRoles(): array
    {
        return ['dictionary_explanation', 'dictionary_explanation_demo'];
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        $language = $task->payload['language'] ?? 'english';
        $words = $result['words'] ?? [];

        if (empty($words)) {
            return 0;
        }

        $translationService = new AppQyV1TranslationTaskService($this->taskManager);
        $translationService->processExplanationResult(
            $task->task_id,
            $language,
            $words,
            $isDemoMode
        );

        Log::info('[DictionaryTaskProcessor] Dictionary explanation result processed', [
            'task_id' => $task->task_id,
            'word_count' => count($words),
            'demo_mode' => $isDemoMode,
            'language' => $language,
        ]);

        // The translation service persists every supplied word; report the count
        // so the result-trust layer sees a non-zero store for a real result.
        return count($words);
    }

}
