<?php

namespace App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils;

use App\Models\GlobalTask;
use Illuminate\Support\Facades\Log;

class VoiceSubtitleTaskManager
{
    private array $tasks = [];
    private string $appName = 'VoiceSubtitleV1';
    private array $stepDefinitions = [
        'input' => ['label' => 'Input Registered'],
        'image_recognition' => ['label' => 'Image/OCR'],
        'ai_rewrite' => ['label' => 'AI Rewrite'],
        'translation' => ['label' => 'Translation'],
        'tts_generation' => ['label' => 'TTS Generation'],
        'queue_append' => ['label' => 'Queue Append'],
    ];

    public function __construct()
    {
        $this->loadExistingTasks();
    }

    public function createTask(array $payload): array
    {
        $taskId = uniqid('task_', true);
        $type = $payload['type'] ?? 'text';

        $task = [
            'id' => $taskId,
            'task_id' => $taskId,
            'app_name' => $this->appName,
            'task_type' => $type,
            'status' => 'pending',
            'progress' => 0,
            'error' => null,
            'result' => null,
            'payload' => $payload,
            'steps' => $this->initializeSteps($type),
            'created_at' => now()->toDateTimeString(),
            'updated_at' => now()->toDateTimeString(),
        ];

        $this->tasks[$taskId] = $task;
        $this->recalculateProgress($taskId);
        $this->persistTaskToDatabase($taskId);

        return $task;
    }

    public function updateStatus(string $taskId, string $status): void
    {
        if (!isset($this->tasks[$taskId])) {
            return;
        }

        $this->tasks[$taskId]['status'] = $status;
        $this->tasks[$taskId]['updated_at'] = now()->toDateTimeString();
        $this->persistTaskToDatabase($taskId);
    }

    public function markStep(string $taskId, string $stepKey, string $status, ?string $message = null, array $meta = []): void
    {
        if (!isset($this->tasks[$taskId]) || !isset($this->tasks[$taskId]['steps'][$stepKey])) {
            return;
        }

        $step = &$this->tasks[$taskId]['steps'][$stepKey];
        $step['status'] = $status;
        $step['message'] = $message;
        $step['meta'] = $meta;
        $step['updated_at'] = now()->toDateTimeString();

        if (!isset($step['started_at'])) {
            $step['started_at'] = $step['updated_at'];
        }

        if ($status === 'completed' || $status === 'skipped') {
            $step['finished_at'] = $step['updated_at'];
        }

        $this->recalculateProgress($taskId);
        $this->persistTaskToDatabase($taskId);
    }

    public function completeTask(string $taskId, array $resultSummary = [], ?array $fullResult = null): void
    {
        if (!isset($this->tasks[$taskId])) {
            return;
        }

        $this->tasks[$taskId]['status'] = 'completed';
        $this->tasks[$taskId]['result'] = [
            'summary' => $resultSummary,
            'item' => $fullResult,
        ];
        if (isset($resultSummary['queue_item_id'])) {
            $this->tasks[$taskId]['queue_item_id'] = $resultSummary['queue_item_id'];
        }
        $this->tasks[$taskId]['updated_at'] = now()->toDateTimeString();
        $this->tasks[$taskId]['progress'] = 100;
        $this->persistTaskToDatabase($taskId);
    }

    public function failTask(string $taskId, string $message, ?string $stepKey = null): void
    {
        if (!isset($this->tasks[$taskId])) {
            return;
        }

        $this->tasks[$taskId]['status'] = 'failed';
        $this->tasks[$taskId]['error'] = $message;
        $this->tasks[$taskId]['updated_at'] = now()->toDateTimeString();

        if ($stepKey && isset($this->tasks[$taskId]['steps'][$stepKey])) {
            $this->tasks[$taskId]['steps'][$stepKey]['status'] = 'failed';
            $this->tasks[$taskId]['steps'][$stepKey]['message'] = $message;
            $this->tasks[$taskId]['steps'][$stepKey]['finished_at'] = now()->toDateTimeString();
        }

        $this->persistTaskToDatabase($taskId);
    }

    public function getTask(string $taskId): ?array
    {
        if (isset($this->tasks[$taskId])) {
            return $this->tasks[$taskId];
        }

        $task = GlobalTask::where('task_id', $taskId)->where('app_name', $this->appName)->first();
        if (!$task) {
            return null;
        }

        $array = $this->convertModelToArray($task);
        $this->tasks[$taskId] = $array;
        return $array;
    }

    public function getRecentTasks(int $limit = 20): array
    {
        return GlobalTask::where('app_name', $this->appName)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function (GlobalTask $task) {
                return $this->convertModelToArray($task);
            })
            ->all();
    }

    public function getTasksByIds(array $taskIds): array
    {
        $taskIds = array_values(array_filter(array_unique($taskIds)));
        if (empty($taskIds)) {
            return [];
        }

        $tasks = GlobalTask::where('app_name', $this->appName)
            ->whereIn('task_id', $taskIds)
            ->get()
            ->mapWithKeys(function (GlobalTask $task) {
                $array = $this->convertModelToArray($task);
                return [$array['task_id'] => $array];
            });

        return array_values(array_filter(array_map(function ($taskId) use ($tasks) {
            return $tasks[$taskId] ?? null;
        }, $taskIds)));
    }

    public function deleteTasks(array $taskIds): int
    {
        $taskIds = array_values(array_filter(array_unique($taskIds)));
        if (empty($taskIds)) {
            return 0;
        }

        foreach ($taskIds as $taskId) {
            unset($this->tasks[$taskId]);
        }

        return GlobalTask::where('app_name', $this->appName)
            ->whereIn('task_id', $taskIds)
            ->delete();
    }

    private function initializeSteps(string $type): array
    {
        $steps = [];
        foreach ($this->stepDefinitions as $key => $definition) {
            $steps[$key] = [
                'label' => $definition['label'],
                'status' => $this->getInitialStatusForStep($key, $type),
                'message' => null,
                'meta' => [],
            ];
        }
        $steps['input']['status'] = 'completed';
        $steps['input']['message'] = 'Task registered';
        $steps['input']['started_at'] = now()->toDateTimeString();
        $steps['input']['finished_at'] = now()->toDateTimeString();
        return $steps;
    }

    private function getInitialStatusForStep(string $stepKey, string $type): string
    {
        $skippedFor = [
            'image_recognition' => ['text', 'url', 'voice', 'file'],
            'ai_rewrite' => ['voice'],
            'translation' => ['voice'],
            'tts_generation' => ['voice'],
        ];

        if (isset($skippedFor[$stepKey]) && in_array($type, $skippedFor[$stepKey], true)) {
            return 'skipped';
        }

        return 'pending';
    }

    private function recalculateProgress(string $taskId): void
    {
        if (!isset($this->tasks[$taskId])) {
            return;
        }

        $steps = $this->tasks[$taskId]['steps'];
        $total = count($steps);
        if ($total === 0) {
            $this->tasks[$taskId]['progress'] = 0;
            return;
        }

        $completed = 0;
        foreach ($steps as $step) {
            if (in_array($step['status'], ['completed', 'skipped'], true)) {
                $completed++;
            }
        }

        $this->tasks[$taskId]['progress'] = round(($completed / $total) * 100, 2);
    }

    private function loadExistingTasks(): void
    {
        try {
            GlobalTask::where('app_name', $this->appName)
                ->orderBy('created_at')
                ->get()
                ->each(function (GlobalTask $task) {
                    $array = $this->convertModelToArray($task);
                    $this->tasks[$array['task_id']] = $array;
                });
        } catch (\Throwable $e) {
            Log::error('[VoiceSubtitleTaskManager] Failed to load tasks from database', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function persistTaskToDatabase(string $taskId): void
    {
        if (!isset($this->tasks[$taskId])) {
            return;
        }

        $task = $this->tasks[$taskId];

        try {
            GlobalTask::updateOrCreate(
                ['task_id' => $taskId],
                [
                    'app_name' => $task['app_name'] ?? $this->appName,
                    'task_type' => $task['task_type'] ?? null,
                    'status' => $task['status'],
                    'progress' => $task['progress'] ?? 0,
                    'payload' => $task['payload'] ?? [],
                    'steps' => $task['steps'] ?? [],
                    'result' => $task['result'] ?? null,
                    'error' => $task['error'] ?? null,
                    'queue_item_id' => $task['queue_item_id'] ?? null,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('[VoiceSubtitleTaskManager] Failed to persist task', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function convertModelToArray(GlobalTask $task): array
    {
        return [
            'id' => $task->task_id,
            'task_id' => $task->task_id,
            'app_name' => $task->app_name,
            'task_type' => $task->task_type,
            'status' => $task->status,
            'progress' => (float) $task->progress,
            'error' => $task->error,
            'result' => $task->result,
            'payload' => $task->payload,
            'steps' => $task->steps ?? [],
            'queue_item_id' => $task->queue_item_id,
            'created_at' => optional($task->created_at)->toDateTimeString(),
            'updated_at' => optional($task->updated_at)->toDateTimeString(),
        ];
    }
}
