<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioService;
use Illuminate\Support\Facades\Log;

/**
 * Sentence Audio Task Processor
 *
 * Write-back stage for the `sentence_audio` task type (execution_type
 * 'remote_sentence_audio' — its own dedicated pycore-only generation lane,
 * claimed by processor_type, kept OFF remote_fast so it never starves the
 * interactive lane). Advertised capability tag 'sentence_audio' (the existing
 * tag, reused) is mainly for UI/provider display. This is the GlobalTask sibling
 * of the assist-protocol sentence-audio pull path
 * (AppQyV1SentenceAudioService::report).
 *
 * Task contract (CANONICAL CONTRACT):
 *   payload : { content_id, language, ... }
 *   result  : { audio_base64 | audio_files:[{audio_base64|saved_path,...}] |
 *               saved_path, mime?, provider? }  (may be nested under
 *               result.result)
 *
 * The synthesized audio is persisted via the EXISTING sentence-audio writeback —
 * reused verbatim through AppQyV1SentenceAudioService::report, which validates
 * the MP3 magic bytes, writes it to the deterministic §6 path
 * (<sentence_sounds>/<language>/<content_id>.mp3), sets has_audio=true +
 * audio + tts_status=completed on the per-language sentence row, records the
 * provider, and clears the lease. NO second audio-writing implementation.
 * Idempotent fill-missing: a file already on disk acks already_done and is never
 * clobbered.
 *
 * Returns 1 on stored (or already-stored) audio, 0 when empty/unstorable — so
 * the result-trust layer downgrades an empty-store "completed" to 'failed'.
 */
class SentenceAudioTaskProcessor implements TaskProcessorInterface
{
    protected TaskManagerService $taskManager;

    protected AppQyV1SentenceAudioService $sentenceAudioService;

    public function __construct(TaskManagerService $taskManager, ?AppQyV1SentenceAudioService $sentenceAudioService = null)
    {
        $this->taskManager = $taskManager;
        $this->sentenceAudioService = $sentenceAudioService ?: new AppQyV1SentenceAudioService();
    }

    public function canProcess(GlobalTask $task): bool
    {
        return $task->app_name === 'AppQyV1'
            && $task->task_type === 'sentence_audio';
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        // Demo-mode tasks never touch the database (mirrors the other processors).
        if ($isDemoMode) {
            return 0;
        }

        $payload = is_array($task->payload) ? $task->payload : [];

        // The target sentence is keyed by content_id + language.
        $contentId = $payload['content_id'] ?? null;
        $language = $payload['language'] ?? null;

        if (!is_string($contentId) || $contentId === '') {
            Log::warning('[SentenceAudioTaskProcessor] Missing content_id in payload, nothing stored', [
                'task_id' => $task->task_id,
            ]);
            return 0;
        }
        if (!is_string($language) || $language === '') {
            Log::warning('[SentenceAudioTaskProcessor] Missing language in payload, nothing stored', [
                'task_id' => $task->task_id,
                'content_id' => $contentId,
            ]);
            return 0;
        }

        // Worker may nest under result.result (documented) or send flat.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $audioBase64 = $this->extractAudioBase64($inner) ?? $this->extractAudioBase64($result);
        $provider = $inner['provider'] ?? ($result['provider'] ?? null);

        if ($audioBase64 === null || $audioBase64 === '') {
            Log::warning('[SentenceAudioTaskProcessor] No audio bytes in result, nothing stored', [
                'task_id' => $task->task_id,
                'content_id' => $contentId,
                'language' => $language,
            ]);
            return 0;
        }

        $audioBinary = base64_decode($audioBase64, true);
        if ($audioBinary === false || $audioBinary === '') {
            Log::warning('[SentenceAudioTaskProcessor] audio_base64 is not valid base64, nothing stored', [
                'task_id' => $task->task_id,
                'content_id' => $contentId,
                'language' => $language,
            ]);
            return 0;
        }

        // DELEGATE to the existing sentence-audio writeback: validate MP3 + write
        // to the deterministic §6 path + flip has_audio/audio/tts_status, idempotent.
        $applied = $this->sentenceAudioService->report(
            $contentId,
            $language,
            'task:' . (string) $task->task_id,
            true,
            $audioBinary,
            is_string($provider) ? $provider : null,
            null
        );

        $status = $applied['status'] ?? null;
        if (!($applied['ok'] ?? false) || ($status !== 'completed')) {
            Log::error('[SentenceAudioTaskProcessor] Sentence-audio writeback rejected the result', [
                'task_id' => $task->task_id,
                'content_id' => $contentId,
                'language' => $language,
                'status' => $status,
                'error' => $applied['error'] ?? null,
            ]);
            return 0;
        }

        Log::info('[SentenceAudioTaskProcessor] Sentence audio stored', [
            'task_id' => $task->task_id,
            'content_id' => $contentId,
            'language' => $language,
            'already_done' => (bool) ($applied['already_done'] ?? false),
        ]);

        // Stored (or already-stored, file present) audio is a real result.
        return 1;
    }

    /**
     * Pull a base64 MP3 payload out of the worker's result shape. Accepts the
     * flat audio_base64, or the first audio_files[] entry's audio_base64 (the
     * audio_files[]/saved_path list form). saved_path alone carries no bytes the
     * server can trust, so it is not treated as storable here.
     *
     * @param array $data
     * @return string|null
     */
    private function extractAudioBase64(array $data): ?string
    {
        $direct = $data['audio_base64'] ?? null;
        if (is_string($direct) && $direct !== '') {
            return $direct;
        }

        $files = $data['audio_files'] ?? null;
        if (is_array($files)) {
            foreach ($files as $file) {
                if (is_array($file)) {
                    $b64 = $file['audio_base64'] ?? ($file['base64'] ?? null);
                    if (is_string($b64) && $b64 !== '') {
                        return $b64;
                    }
                } elseif (is_string($file) && $file !== '') {
                    return $file;
                }
            }
        }

        return null;
    }

    public function getPriority(): int
    {
        return 10;
    }
}
