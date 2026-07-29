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
class SentenceAudioTaskProcessor extends AbstractTaskProcessor
{
    protected TaskManagerService $taskManager;

    protected AppQyV1SentenceAudioService $sentenceAudioService;

    public function __construct(TaskManagerService $taskManager, ?AppQyV1SentenceAudioService $sentenceAudioService = null)
    {
        $this->taskManager = $taskManager;
        $this->sentenceAudioService = $sentenceAudioService ?: new AppQyV1SentenceAudioService();
    }

    protected function taskTypeRoles(): array
    {
        return ['sentence_audio'];
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

        // Worker may nest under result.result (documented) or send flat. The
        // variant tags (variant_key/accent/gender/source/voice_type/provider)
        // ride on the same entry that carries the audio bytes.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        $audioPayload = self::extractAudioPayload($inner);
        if ($audioPayload['base64'] === null) {
            $audioPayload = self::extractAudioPayload($result);
        }

        $audioBase64 = $audioPayload['base64'];

        // Variant tags: prefer the result entry (the worker that generated the
        // audio knows which variant it made); fall back to the flat payload
        // fields for tasks created with an explicit variant request.
        $variantKey = $audioPayload['variant_key'] ?? self::strOrNull($payload['variant_key'] ?? null);
        $accent = $audioPayload['accent'] ?? self::strOrNull($payload['accent'] ?? null);
        $gender = $audioPayload['gender'] ?? self::strOrNull($payload['gender'] ?? null);
        $source = $audioPayload['source'] ?? self::strOrNull($payload['source'] ?? null);
        $voiceType = $audioPayload['voice_type'] ?? self::strOrNull($payload['voice_type'] ?? null);
        $provider = $audioPayload['provider'] ?? self::strOrNull($payload['provider'] ?? null);

        $variantMeta = array_filter([
            'accent' => $accent,
            'gender' => $gender,
            'source' => $source,
            'voice_type' => $voiceType,
        ], static fn ($v) => $v !== null && $v !== '');

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
        // Pass the variant tags so the writeback stamps the right variant entry.
        $applied = $this->sentenceAudioService->report(
            $contentId,
            $language,
            'task:' . (string) $task->task_id,
            true,
            $audioBinary,
            is_string($provider) ? $provider : null,
            null,
            $variantKey,
            $variantMeta ?: null
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
     * Pull the audio bytes + variant tags out of the worker's result shape.
     * Accepts flat audio_base64, or the first audio_files[] entry's audio_base64.
     * Captures variant_key/accent/gender/source/voice_type/provider from the
     * matched entry (or the flat fields) so the write-back stamps the right
     * variant. saved_path alone carries no trusted bytes -> base64 stays null.
     *
     * @param array $data
     * @return array{base64:?string, variant_key:?string, accent:?string, gender:?string, source:?string, voice_type:?string, provider:?string}
     */
    private static function extractAudioPayload(array $data): array
    {
        $empty = [
            'base64' => null,
            'variant_key' => null,
            'accent' => null,
            'gender' => null,
            'source' => null,
            'voice_type' => null,
            'provider' => null,
        ];

        $direct = $data['audio_base64'] ?? null;
        if (is_string($direct) && $direct !== '') {
            return array_merge($empty, [
                'base64' => $direct,
                'variant_key' => self::strOrNull($data['variant_key'] ?? null),
                'accent' => self::strOrNull($data['accent'] ?? null),
                'gender' => self::strOrNull($data['gender'] ?? null),
                'source' => self::strOrNull($data['source'] ?? null),
                'voice_type' => self::strOrNull($data['voice_type'] ?? null),
                'provider' => self::strOrNull($data['provider'] ?? null),
            ]);
        }

        $files = $data['audio_files'] ?? null;
        if (is_array($files)) {
            foreach ($files as $file) {
                if (is_array($file)) {
                    $b64 = $file['audio_base64'] ?? ($file['base64'] ?? null);
                    if (is_string($b64) && $b64 !== '') {
                        return array_merge($empty, [
                            'base64' => $b64,
                            'variant_key' => self::strOrNull($file['variant_key'] ?? null),
                            'accent' => self::strOrNull($file['accent'] ?? null),
                            'gender' => self::strOrNull($file['gender'] ?? null),
                            'source' => self::strOrNull($file['source'] ?? null),
                            'voice_type' => self::strOrNull($file['voice_type'] ?? null),
                            'provider' => self::strOrNull($file['provider'] ?? null),
                        ]);
                    }
                } elseif (is_string($file) && $file !== '') {
                    return array_merge($empty, ['base64' => $file]);
                }
            }
        }

        return $empty;
    }

    /** Trim a scalar to a non-empty string or null. */
    private static function strOrNull(mixed $v): ?string
    {
        if (!is_string($v)) {
            return null;
        }
        $v = trim($v);
        return $v !== '' ? $v : null;
    }

}
