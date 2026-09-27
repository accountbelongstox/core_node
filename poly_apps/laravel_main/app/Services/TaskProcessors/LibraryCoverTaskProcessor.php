<?php

namespace App\Services\TaskProcessors;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Log;

/**
 * Library Cover Task Processor
 *
 * Write-back stage for the vocabulary-library cover task types declared in the
 * contract library_cover block (AI generate on remote_gemini, web image search
 * on remote_poster). Both are explicit user requests, so the bytes go through
 * AppQyV1AssistService::submitCover with force=true: an existing ready cover is
 * overwritten (the assist claim pipeline keeps its fill-missing semantics).
 *
 * Task contract:
 *   payload : { library_id, mode, name, language, category, description,
 *               prompt?, search_query }
 *   result  : { image_base64, mime, provider, model?, latency_ms?, source_url?,
 *               prompt? }  (may be nested under result.result)
 *
 * Returns 1 when the cover was stored, 0 otherwise, so the result-trust layer
 * downgrades an unstorable "completed" to failed.
 */
class LibraryCoverTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    protected AppQyV1AssistService $assistService;

    public function __construct(TaskManagerService $taskManager, ?AppQyV1AssistService $assistService = null)
    {
        $this->taskManager = $taskManager;
        $this->assistService = $assistService ?: new AppQyV1AssistService();
    }

    protected function taskTypeRoles(): array
    {
        return array_values(QueueCenterContract::libraryCoverTaskTypes());
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        if ($isDemoMode) {
            return 0;
        }

        $payload = is_array($task->payload) ? $task->payload : [];
        $libraryId = $payload['library_id'] ?? null;
        if (!is_numeric($libraryId) || (int) $libraryId <= 0) {
            Log::warning('[LibraryCoverTaskProcessor] Missing/invalid library_id in payload, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }

        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;
        $imageBase64 = $inner['image_base64'] ?? ($result['image_base64'] ?? null);
        $mime = $inner['mime'] ?? ($result['mime'] ?? null);
        $provider = $inner['provider'] ?? ($result['provider'] ?? null);
        $model = $inner['model'] ?? ($result['model'] ?? null);
        $latencyMs = $inner['latency_ms'] ?? ($result['latency_ms'] ?? null);

        if (!is_string($imageBase64) || $imageBase64 === '') {
            Log::warning('[LibraryCoverTaskProcessor] No image_base64 in result, nothing stored', [
                'task_id' => $task->task_id,
                'library_id' => (int) $libraryId,
            ]);
            return 0;
        }

        $applied = $this->assistService->submitCover(
            (int) $libraryId,
            $imageBase64,
            is_string($mime) ? $mime : null,
            is_string($provider) ? $provider : null,
            is_string($model) ? $model : null,
            is_numeric($latencyMs) ? (int) $latencyMs : null,
            true
        );

        if (!($applied['ok'] ?? false)) {
            Log::error('[LibraryCoverTaskProcessor] Cover writeback rejected the result', [
                'task_id' => $task->task_id,
                'library_id' => (int) $libraryId,
                'status' => $applied['status'] ?? null,
                'error' => $applied['error'] ?? null,
            ]);
            return 0;
        }

        Log::info('[LibraryCoverTaskProcessor] Library cover stored', [
            'task_id' => $task->task_id,
            'task_type' => $task->task_type,
            'library_id' => (int) $libraryId,
            'provider' => $provider,
        ]);

        return 1;
    }
}
