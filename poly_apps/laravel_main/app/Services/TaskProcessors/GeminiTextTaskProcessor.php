<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Models\AppQyV1GeminiTextResult;
use App\Services\TaskManagerService;
use Illuminate\Support\Facades\Log;

/**
 * Gemini Text Task Processor
 *
 * Write-back stage for the `gemini_chat` task type (execution_type
 * 'remote_gemini_text' — its own dedicated lane, pulled by the chrome Task
 * Center Gemini-text worker which drives the chrome_gemini MCP tool). Text-only
 * sibling of `gemini_image`: no image, no dictionary-row attachment — just a
 * prompt in, a text answer out (mirrors NotebookLmTaskProcessor).
 *
 * Task contract:
 *   payload : { question|source_text, title? }
 *   result  : { result: { answer?, provider:'gemini' } }
 *
 * The completed answer is persisted as a lightweight text record
 * (app_qy_v1_gemini_text_results); the authoritative task completion is still
 * the global_tasks row status set by submitResult — this only stores the
 * artifact.
 */
class GeminiTextTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1'
            && $task->task_type === 'gemini_chat';
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
        $provider = $inner['provider'] ?? 'gemini';
        $title = $payload['title'] ?? null;

        // Nothing usable to store — leave the task completed without a record.
        if ($answer === null || $answer === '') {
            Log::info('[GeminiTextTaskProcessor] No answer in result, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }

        try {
            AppQyV1GeminiTextResult::create([
                'task_id' => $task->task_id,
                'title' => is_string($title) ? mb_substr($title, 0, 255) : null,
                'question' => is_string($question) ? $question : null,
                'answer' => is_string($answer) ? $answer : null,
                'provider' => is_string($provider) ? mb_substr($provider, 0, 40) : 'gemini',
            ]);

            Log::info('[GeminiTextTaskProcessor] Gemini text answer stored', [
                'task_id' => $task->task_id,
                'has_answer' => true,
            ]);

            return 1;
        } catch (\Throwable $e) {
            // Never fail the worker-result transaction over the record write.
            Log::error('[GeminiTextTaskProcessor] Failed to store Gemini text answer', [
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
