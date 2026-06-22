<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use Illuminate\Support\Facades\Log;

/**
 * Poster Task Processor
 *
 * Write-back stage for the `poster` task type (execution_type 'remote_poster' —
 * its own dedicated pycore-only generation lane, claimed by processor_type, kept
 * OFF remote_fast so it never starves the interactive lane). Advertised
 * capability tag 'poster' (DISTINCT from 'image' = word art) is mainly for
 * UI/provider display. This is the GlobalTask sibling of the assist-protocol
 * poster pull path (AppQyV1AssistService::submitPoster).
 *
 * Task contract (CANONICAL CONTRACT):
 *   payload : { media_type:'book'|'subtitle', id, ... }
 *   result  : { image_base64|poster_base64, mime?, provider?, source_id?,
 *               poster_url|image_url? }  (may be nested under result.result)
 *
 * The poster bytes are persisted via the EXISTING MoviePosterStore writeback —
 * reused verbatim through AppQyV1AssistService::submitPoster, which decodes +
 * magic-byte validates the base64, writes the file under the canonical posters
 * tree, flips the poster_* columns (status='ready', filename=source_key.ext,
 * provider, source_id, fetched_at) on the Book / Subtitle row, and clears the
 * assist lease. NO second poster-writing implementation. Fill-missing /
 * idempotent: a row already 'ready' with a file is acknowledged, not clobbered.
 *
 * Returns 1 on a stored (or already-stored) poster, 0 when empty/unstorable —
 * so the result-trust layer downgrades an empty-store "completed" to 'failed'.
 */
class PosterTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    protected AppQyV1AssistService $assistService;

    public function __construct(TaskManagerService $taskManager, ?AppQyV1AssistService $assistService = null)
    {
        $this->taskManager = $taskManager;
        $this->assistService = $assistService ?: new AppQyV1AssistService();
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1'
            && $task->task_type === 'poster';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        // Demo-mode tasks never touch the database (mirrors the other processors).
        if ($isDemoMode) {
            return 0;
        }

        $payload = is_array($task->payload) ? $task->payload : [];

        // The target media row this poster belongs to.
        $mediaType = $payload['media_type'] ?? ($payload['type'] ?? null);
        $id = $payload['id'] ?? ($payload['media_id'] ?? null);

        if (!is_string($mediaType) || ($mediaType !== 'book' && $mediaType !== 'subtitle')) {
            Log::warning('[PosterTaskProcessor] Missing/invalid media_type in payload, nothing stored', [
                'task_id' => $task->task_id,
                'media_type' => $mediaType,
            ]);
            return 0;
        }
        if (!is_numeric($id)) {
            Log::warning('[PosterTaskProcessor] Missing/invalid id in payload, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }

        // Worker may nest under result.result (documented) or send flat.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $imageBase64 = $inner['image_base64']
            ?? ($inner['poster_base64'] ?? ($result['image_base64'] ?? ($result['poster_base64'] ?? null)));
        $mime = $inner['mime'] ?? ($result['mime'] ?? null);
        $provider = $inner['provider'] ?? ($result['provider'] ?? null);
        $sourceId = $inner['source_id'] ?? ($result['source_id'] ?? null);

        if (!is_string($imageBase64) || $imageBase64 === '') {
            Log::warning('[PosterTaskProcessor] No poster bytes in result, nothing stored', [
                'task_id' => $task->task_id,
                'media_type' => $mediaType,
                'id' => (int) $id,
            ]);
            return 0;
        }

        // DELEGATE to the existing poster writeback (MoviePosterStore via the
        // assist service): decode + validate + write file + set poster_* columns,
        // fill-missing idempotent.
        $applied = $this->assistService->submitPoster(
            $mediaType,
            (int) $id,
            $imageBase64,
            is_string($mime) ? $mime : null,
            is_string($provider) ? $provider : null,
            is_string($sourceId) ? $sourceId : null
        );

        if (!($applied['ok'] ?? false)) {
            Log::error('[PosterTaskProcessor] Poster writeback rejected the result', [
                'task_id' => $task->task_id,
                'media_type' => $mediaType,
                'id' => (int) $id,
                'status' => $applied['status'] ?? null,
                'error' => $applied['error'] ?? null,
            ]);
            return 0;
        }

        Log::info('[PosterTaskProcessor] Poster stored', [
            'task_id' => $task->task_id,
            'media_type' => $mediaType,
            'id' => (int) $id,
            'already_done' => (bool) ($applied['already_done'] ?? false),
        ]);

        // A stored (or already-stored, file present) poster is a real result.
        return 1;
    }

    public function getPriority(): int
    {
        return 10;
    }
}
