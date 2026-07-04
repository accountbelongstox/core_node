<?php

namespace App\Services\DeveloperHistory;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Utils\LanguageDetector;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Dispatches translation assist requests for non-English prompts.
 *
 * Scans the dev-history prompt store and enqueues a `prompt_translation` global
 * task for each non-English prompt that has not yet been queued or translated.
 * Pycore (or the chrome web translator) pulls the task and the result is written
 * back by PromptTranslationTaskProcessor. State is tracked in files (assist_state
 * / prompt_translations), never a database.
 */
class DevHistoryAssistService
{
    private const ASSIST_STATE = 'assist_state.json';
    private const PER_RUN_CAP = 25;
    private const TIMEOUT_SECONDS = 600;

    /**
     * Enqueue up to $cap pending non-English prompts. Idempotent + deduped.
     *
     * @return int number of tasks enqueued this run
     */
    public function scanAndEnqueue(int $cap = self::PER_RUN_CAP): int
    {
        $svc = new DeveloperHistoryService();
        $prompts = $svc->readStore('prompts.json');
        if (!is_array($prompts) || empty($prompts)) {
            return 0;
        }

        $state = $svc->readStore(self::ASSIST_STATE);
        $state = is_array($state) ? $state : [];
        $translations = $svc->readStore('prompt_translations.json');
        $translations = is_array($translations) ? $translations : [];

        $taskManager = app(TaskManagerService::class);
        $enqueued = 0;

        foreach ($prompts as $p) {
            if ($enqueued >= $cap) {
                break;
            }
            $id = (string) ($p['id'] ?? '');
            if ($id === '' || isset($state[$id]) || isset($translations[$id])) {
                continue;
            }
            $lang = (string) ($p['lang'] ?? '');
            if ($lang === '') {
                $lang = LanguageDetector::detect((string) ($p['text'] ?? ''));
            }
            if (!in_array($lang, ['zh', 'ja', 'ko'], true)) {
                continue;
            }
            $text = (string) ($p['text'] ?? '');
            if (trim($text) === '') {
                continue;
            }

            try {
                $task = $taskManager->createTask(
                    'AppQyV1',
                    'prompt_translation',
                    GlobalTask::EXECUTION_REMOTE_TRANSLATION,
                    [
                        'prompt_id' => $id,
                        'text' => $text,
                        'source_lang' => $lang,
                        'want_audio' => true,
                        'variants' => 3,
                    ],
                    self::TIMEOUT_SECONDS,
                    0,
                    3,
                    false,
                    // No capability tag: the pycore translation worker dispatches
                    // prompt_translation by task_type. Tagging 'ai_translate' would
                    // mis-route it to the word-translation path (checked first).
                    null
                );
                $state[$id] = ['status' => 'queued', 'task_id' => $task->task_id, 'at' => date('Y-m-d H:i:s')];
                $enqueued++;
            } catch (\Throwable $e) {
                Log::warning('dev_history_assist: enqueue failed', ['prompt' => $id, 'error' => $e->getMessage()]);
            }
        }

        if ($enqueued > 0) {
            $svc->writeStore(self::ASSIST_STATE, $state);
        }
        return $enqueued;
    }

    /**
     * Summary of assist tasks for the task-center Assist Distribution panel.
     *
     * task_type is filtered here; the (task_type, status) index makes this an
     * index-only aggregate. It is polled ~5s while the panel is open, so the
     * result is cached briefly — a diagnostic count tolerates a few seconds of
     * staleness and this keeps the poll off a repeated scan.
     */
    public function summary(): array
    {
        // File store (the configured `database` default has no provisioned
        // `cache` table); persists across the single-worker php -S requests.
        return Cache::store('file')->remember('devhistory:assist:summary', 5, static function (): array {
            $byStatus = GlobalTask::query()
                ->where('task_type', 'prompt_translation')
                ->selectRaw('status, COUNT(*) as c')
                ->groupBy('status')
                ->pluck('c', 'status')
                ->toArray();

            return [
                'pending' => (int) ($byStatus['pending'] ?? 0),
                'assigned' => (int) ($byStatus['assigned'] ?? 0),
                'processing' => (int) ($byStatus['processing'] ?? 0),
                'completed' => (int) ($byStatus['completed'] ?? 0),
                'failed' => (int) ($byStatus['failed'] ?? 0),
                'total' => array_sum(array_map('intval', $byStatus)),
            ];
        });
    }

    /** Recent assist tasks (newest first) for the panel list. */
    public function recent(int $limit = 50): array
    {
        $limit = max(1, min(200, $limit));
        return Cache::store('file')->remember('devhistory:assist:recent:' . $limit, 5, static function () use ($limit): array {
            return GlobalTask::query()
                ->where('task_type', 'prompt_translation')
                ->orderByDesc('id')
                ->limit($limit)
                ->get(['task_id', 'status', 'payload', 'priority', 'retry_count', 'created_at', 'updated_at'])
                ->map(function (GlobalTask $t) {
                $payload = is_array($t->payload) ? $t->payload : [];
                return [
                    'task_id' => $t->task_id,
                    'status' => $t->status,
                    'prompt_id' => $payload['prompt_id'] ?? '',
                    'source_lang' => $payload['source_lang'] ?? '',
                    'text' => mb_substr((string) ($payload['text'] ?? ''), 0, 160),
                    'created_at' => (string) $t->created_at,
                    'updated_at' => (string) $t->updated_at,
                ];
            })
            ->all();
        });
    }
}
