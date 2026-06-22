<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Models\AppQyV1NotebookLmResult;
use App\Services\TaskManagerService;
use Illuminate\Support\Facades\Log;

/**
 * NotebookLM Task Processor
 *
 * Write-back stage for the `notebooklm` task type (execution_type
 * 'remote_notebooklm' — its own dedicated lane, pulled by the chrome Task Center
 * NotebookLM worker which drives the chrome_notebooklm MCP tool).
 *
 * Task contract (SHARED CONTRACT v3):
 *   payload : { question|source_text, notebook_url?, title? }
 *   result  : { result: { answer?, notebook_url?, provider:'notebooklm' } }
 *
 * The completed answer is persisted as a lightweight text record
 * (app_qy_v1_notebooklm_results); the authoritative task completion is still the
 * global_tasks row status set by submitResult — this only stores the artifact.
 */
class NotebookLmTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1'
            && $task->task_type === 'notebooklm';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        // Demo-mode tasks never touch the database (mirrors the other processors).
        if ($isDemoMode) {
            return 0;
        }

        $payload = is_array($task->payload) ? $task->payload : [];

        // Worker may nest the artifact under result.result (the documented shape)
        // or send the fields flat — accept both.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $question = $payload['question'] ?? ($payload['source_text'] ?? null);
        $answer = $inner['answer'] ?? null;
        $notebookUrl = $inner['notebook_url'] ?? ($payload['notebook_url'] ?? null);
        $provider = $inner['provider'] ?? 'notebooklm';
        $title = $payload['title'] ?? null;

        // Nothing usable to store — leave the task completed without a record.
        if (($answer === null || $answer === '') && ($notebookUrl === null || $notebookUrl === '')) {
            Log::info('[NotebookLmTaskProcessor] No answer/notebook_url in result, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }

        try {
            AppQyV1NotebookLmResult::create([
                'task_id' => $task->task_id,
                'title' => is_string($title) ? mb_substr($title, 0, 255) : null,
                'question' => is_string($question) ? $question : null,
                'answer' => is_string($answer) ? $answer : null,
                'notebook_url' => is_string($notebookUrl) ? mb_substr($notebookUrl, 0, 1024) : null,
                'provider' => is_string($provider) ? mb_substr($provider, 0, 40) : 'notebooklm',
            ]);

            Log::info('[NotebookLmTaskProcessor] NotebookLM answer stored', [
                'task_id' => $task->task_id,
                'has_answer' => $answer !== null && $answer !== '',
                'has_notebook_url' => $notebookUrl !== null && $notebookUrl !== '',
            ]);

            // One artifact record stored — a real, non-empty result.
            return 1;
        } catch (\Throwable $e) {
            // Never fail the worker-result transaction over the record write.
            Log::error('[NotebookLmTaskProcessor] Failed to store NotebookLM answer', [
                'task_id' => $task->task_id,
                'error' => $e->getMessage(),
            ]);

            return 0;
        }
    }

    public function getPriority(): int
    {
        return 10;
    }
}
