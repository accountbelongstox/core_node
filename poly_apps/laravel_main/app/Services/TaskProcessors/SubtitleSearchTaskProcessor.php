<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use Illuminate\Support\Facades\Log;

/**
 * Subtitle Search Task Processor
 *
 * Write-back stage for the `subtitle_search` task type (execution_type
 * 'remote_subtitle' — its own dedicated pycore-only retrieval lane, claimed by
 * processor_type, kept OFF remote_fast so it never starves the interactive
 * lane). Advertised capability tag 'subtitle' is mainly for UI/provider display.
 *
 * Task contract (CANONICAL CONTRACT):
 *   payload : { query|title, language?, ... }
 *   result  : { results: [ { ... subtitle hit ... }, ... ] }  (may be nested
 *             under result.result)
 *
 * The authoritative completion is the global_tasks row status set by
 * submitResult, and the worker's full result is ALREADY persisted verbatim on
 * that row. There is no clean canonical subtitle "search hit" store to fan the
 * raw search results into (the App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel table holds INGESTED media,
 * keyed by source_key — not transient search candidates), so this processor
 * intentionally adds NO migration and stores NO second copy: it validates and
 * normalizes the artifact and reports the count of hits already persisted on
 * the task row.
 *
 * Returning count>=1 ONLY when results[] is non-empty lets the result-trust
 * layer downgrade an empty-store "completed" to 'failed' (a search that found
 * nothing is not a real success for this lane).
 */
class SubtitleSearchTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    public function __construct(TaskManagerService $taskManager)
    {
        $this->taskManager = $taskManager;
    }

    protected function taskTypeRoles(): array
    {
        return ['subtitle_search'];
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        // Demo-mode tasks never touch the database (mirrors the other processors).
        if ($isDemoMode) {
            return 0;
        }

        // Worker may nest the artifact under result.result (the documented shape)
        // or send the fields flat — accept both.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $results = $inner['results'] ?? ($result['results'] ?? null);
        if (!is_array($results) || $results === []) {
            Log::info('[SubtitleSearchTaskProcessor] No results[] in subtitle search, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }

        // The full result[] artifact is already persisted on the global_tasks row
        // by submitResult — nothing else to write. Report the hit count so the
        // result-trust layer treats a non-empty search as a real success.
        $count = count($results);

        Log::info('[SubtitleSearchTaskProcessor] Subtitle search results accepted', [
            'task_id' => $task->task_id,
            'hits' => $count,
        ]);

        return $count;
    }

}
