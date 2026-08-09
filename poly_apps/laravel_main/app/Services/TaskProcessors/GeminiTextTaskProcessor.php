<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1GeminiTextResultModel as AppQyV1GeminiTextResult;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Log;

/**
 * Shared web-chat text result processor (legacy class/table name retained).
 *
 * Both gemini_chat and chatgpt_chat produce the same prompt-in/answer-out
 * artifact. Their lanes and primary payload fields remain separate in
 * config/queue_center_contract.json, while this one processor owns persistence.
 *
 * Task contract:
 *   payload : { <contract prompt_payload_field>|source_text, title? }
 *   result  : { result?: { answer?, provider? }, answer?, provider? }
 *
 * The completed answer is persisted as a lightweight text record
 * (app_qy_v1_gemini_text_results); the authoritative task completion is still
 * the global_tasks row status set by submitResult — this only stores the
 * artifact.
 */
class GeminiTextTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    protected function taskTypeRoles(): array
    {
        return ['gemini_chat', 'chatgpt_chat'];
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

        $question = QueueCenterContract::taskPromptPayloadText($task->task_type, $payload);
        $answer = $inner['answer'] ?? null;
        $provider = $inner['provider'] ?? $task->task_type;
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

            Log::info('[GeminiTextTaskProcessor] Web-chat answer stored', [
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

}
