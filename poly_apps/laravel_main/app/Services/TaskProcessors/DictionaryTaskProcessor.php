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
class DictionaryTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1'
            && in_array($task->task_type, ['dictionary_explanation', 'dictionary_explanation_demo']);
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): void
    {
        $language = $task->payload['language'] ?? 'english';
        $words = $result['words'] ?? [];

        if (empty($words)) {
            return;
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
    }

    public function getPriority(): int
    {
        return 10;
    }
}
