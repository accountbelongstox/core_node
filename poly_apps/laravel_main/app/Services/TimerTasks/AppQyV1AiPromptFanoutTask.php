<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Models\AppQyV1AiPrompt;
use App\Models\AppQyV1AiPromptRequest;
use App\Models\AppQyV1AiPromptRequestTask;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;

/**
 * AI Prompt Request Fan-Out.
 *
 * Background half of the prompt-library submission flow. Any caller inserts
 * one row into app_qy_v1_ai_prompt_requests (source_text + optional
 * prompt_keys); this task scans pending rows and, for each request, creates
 * ONE global_tasks row PER matching enabled prompt (app_qy_v1_ai_prompts) —
 * rendering the prompt's template with the request's source_text/language and
 * dispatching it onto that prompt's declared task_type lane (e.g.
 * `gemini_chat`, `notebooklm`). The app_qy_v1_ai_prompt_request_tasks ledger
 * (unique on request_id+prompt_key) makes this idempotent: a request revisited
 * on a later tick (because another of its prompts is still unresolved) can
 * never re-enqueue a prompt it already dispatched.
 *
 * Task type to lane routing comes from config/queue_center_contract.json via
 * QueueCenterContract. Extending a prompt-driven task requires a central task
 * definition plus its TaskProcessorInterface writeback
 * for that task_type in TaskManagerService::getProcessorRegistry() — no
 * changes needed here or to the inbox/ledger tables.
 */
class AppQyV1AiPromptFanoutTask extends OctaneTimerTaskAbstract
{
    private const REQUEST_BATCH_SIZE = 20;

    private $taskManager;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
    }

    public function getName(): string
    {
        return 'appqyv1_ai_prompt_fanout';
    }

    public function getInterval(): int
    {
        return 5;
    }

    public function exec(): void
    {
        $requests = AppQyV1AiPromptRequest::query()
            ->where('status', AppQyV1AiPromptRequest::STATUS_PENDING)
            ->orderBy('created_at')
            ->limit(self::REQUEST_BATCH_SIZE)
            ->get();

        if ($requests->isEmpty()) {
            return;
        }

        $enabledPrompts = AppQyV1AiPrompt::query()->where('enabled', true)->get()->keyBy('prompt_key');

        foreach ($requests as $request) {
            $this->processRequest($request, $enabledPrompts);
        }
    }

    private function processRequest(AppQyV1AiPromptRequest $request, $enabledPrompts): void
    {
        $requestedKeys = is_array($request->prompt_keys) && !empty($request->prompt_keys)
            ? $request->prompt_keys
            : $enabledPrompts->keys()->all();

        $prompts = collect($requestedKeys)
            ->map(fn ($key) => $enabledPrompts->get($key))
            ->filter();

        if ($prompts->isEmpty()) {
            $request->update([
                'status' => AppQyV1AiPromptRequest::STATUS_FAILED,
                'processed_at' => now(),
                'error' => 'No enabled prompt matched the requested prompt_keys',
            ]);
            return;
        }

        $alreadyDispatched = AppQyV1AiPromptRequestTask::query()
            ->where('request_id', $request->id)
            ->pluck('prompt_key')
            ->all();

        $allDispatched = true;

        foreach ($prompts as $prompt) {
            if (in_array($prompt->prompt_key, $alreadyDispatched, true)) {
                continue;
            }

            if (!$this->dispatchPrompt($request, $prompt)) {
                $allDispatched = false;
            }
        }

        if ($allDispatched) {
            $request->update([
                'status' => AppQyV1AiPromptRequest::STATUS_PROCESSED,
                'processed_at' => now(),
            ]);
        }
    }

    /**
     * Render + enqueue one (request, prompt) pair. Returns true once the pair
     * is resolved (a global_tasks row exists and is recorded in the ledger,
     * OR a concurrent tick already reserved/resolved it) so the caller can
     * tell "resolved" from "needs another tick".
     *
     * Reservation-first: the ledger row (task_id NULL) is inserted BEFORE
     * global_tasks is created, so the unique (request_id, prompt_key)
     * constraint gates the expensive side effect instead of racing after it.
     * global_tasks lives on a DIFFERENT database connection than the AppQyV1
     * ledger tables (per-app databases — see AppTablePrefixServiceProvider),
     * so a single Laravel DB::transaction() cannot span both; reservation-
     * first is what makes this race-safe without a cross-database transaction.
     */
    private function dispatchPrompt(AppQyV1AiPromptRequest $request, AppQyV1AiPrompt $prompt): bool
    {
        $executionType = $this->executionTypeFor($prompt->task_type);
        $payloadField = QueueCenterContract::taskTypePromptPayloadField($prompt->task_type);
        if ($executionType === null) {
            $this->logWarning('Unsupported prompt task_type, skipping', [
                'prompt_key' => $prompt->prompt_key,
                'task_type' => $prompt->task_type,
            ]);
            return false;
        }

        try {
            $ledger = AppQyV1AiPromptRequestTask::create([
                'request_id' => $request->id,
                'prompt_key' => $prompt->prompt_key,
                'task_id' => null,
            ]);
        } catch (\Illuminate\Database\QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                // Another tick already reserved (or resolved) this exact
                // pair. Nothing to do here; idempotent.
                return true;
            }
            // A genuine, unexpected DB error (deadlock, transient connection
            // drop, etc.) -- NOT a dedup hit. Must NOT be treated as resolved:
            // that would mark the request 'processed' and this prompt would
            // never be retried (exec() only rescans status=pending), silently
            // losing it. Report unresolved so the request stays pending.
            $this->logError('Failed to reserve ledger slot for prompt (will retry)', [
                'request_id' => $request->id,
                'prompt_key' => $prompt->prompt_key,
                'error' => $e->getMessage(),
            ]);
            return false;
        }

        $rendered = strtr($prompt->prompt_template, [
            '{source_text}' => (string) $request->source_text,
            '{language}' => (string) ($request->language ?? ''),
            '{target_language}' => (string) ($request->target_language ?? ''),
        ]);

        try {
            $task = $this->taskManager->createTask(
                'AppQyV1',
                $prompt->task_type,
                $executionType,
                [
                    // The shared contract names the field consumed by each web
                    // worker (for example Gemini text uses question while image
                    // and ChatGPT use prompt). Change it in the JSON first so
                    // Laravel and mcp-chrome update from the same definition.
                    $payloadField => $rendered,
                    'title' => $prompt->title,
                ],
                120,
                0,
                3
            );
        } catch (\Throwable $e) {
            // No global_tasks row was created -- safe to release the
            // reservation so a later tick retries this pair cleanly.
            $ledger->delete();
            $this->logError('Failed to create task for prompt (reservation released, will retry)', [
                'request_id' => $request->id,
                'prompt_key' => $prompt->prompt_key,
                'error' => $e->getMessage(),
            ]);
            return false;
        }

        try {
            $ledger->update(['task_id' => $task->task_id]);
        } catch (\Throwable $e) {
            // The global_tasks row WAS created -- do NOT delete the
            // reservation here, that would let a later tick create a
            // DUPLICATE task for this pair. Leave the ledger row in place
            // (task_id stays NULL) and log loudly; the task itself is not
            // lost, only the ledger's task_id backlink needs reconciliation.
            $this->logError('Task created but failed to record task_id in ledger (task NOT lost, ledger needs reconciliation)', [
                'request_id' => $request->id,
                'prompt_key' => $prompt->prompt_key,
                'task_id' => $task->task_id,
                'error' => $e->getMessage(),
            ]);
        }

        return true;
    }

    /**
     * True when $e is a Postgres unique_violation (SQLSTATE 23505) -- the
     * ONLY exception that legitimately means "another tick already reserved
     * this pair". Any other QueryException is a real failure and must not be
     * silently treated as success.
     */
    private function isUniqueViolation(\Illuminate\Database\QueryException $e): bool
    {
        if ((string) $e->getCode() === '23505') {
            return true;
        }
        $errorInfo = $e->errorInfo ?? null;
        return is_array($errorInfo) && ($errorInfo[0] ?? null) === '23505';
    }

    /** Resolve the prompt task lane from the shared four-end task contract. */
    private function executionTypeFor(string $taskType): ?string
    {
        return QueueCenterContract::taskTypeExecution($taskType);
    }
}
