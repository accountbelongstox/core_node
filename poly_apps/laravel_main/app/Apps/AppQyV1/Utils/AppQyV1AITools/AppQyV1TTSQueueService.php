<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioGateway;
use App\Services\EdgeTTS\EdgeTTSService;

/**
 * TTS Queue Service (legacy word-level surface) — queue-less edition.
 *
 * The intermediate tts_queue table is decommissioned; word TTS state lives on
 * the canonical {prefix}_tts_cache_{lang} rows and the shared word-audio
 * gateway coordinated by
 * AppQyV1DictionaryTTSCoordinator. This class keeps the legacy method
 * surface used by AppQyV1TTSController (queueBatch / queue stats / queue
 * status endpoints) with byte-compatible response shapes.
 */
class AppQyV1TTSQueueService
{
    private $ttsService;
    private AppQyV1DictionaryTTSCoordinator $coordinator;
    private AppQyV1AudioGateway $audioGateway;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
        $this->coordinator = new AppQyV1DictionaryTTSCoordinator($this->ttsService);
        $this->audioGateway = new AppQyV1AudioGateway();
    }

    /**
     * Request audio for a word.
     * Returns audio info if available, null after queueing for generation
     * (marking the canonical dictionary row tts_status='pending').
     */
    public function requestAudio(string $word, string $language): ?array
    {
        $result = $this->audioGateway->requestWord($word, $language, null, true, true);
        if (($result['audio_url'] ?? null) === null) {
            return null;
        }

        return [
            'available' => true,
            'audio_path' => null,
            'audio_url' => $result['audio_url'],
        ];
    }

    /**
     * Process queue items (legacy entry point) — delegates to the unified
     * queue-less processor.
     */
    public function processQueue(int $batchSize = 10): array
    {
        $result = (new AppQyV1UnifiedTTSQueueService())->processQueue($batchSize);

        return [
            'processed' => $result['processed'],
            'succeeded' => $result['succeeded'],
            'failed' => $result['failed'],
        ];
    }

    /**
     * Get queue statistics (legacy flat shape).
     */
    public function getQueueStats(): array
    {
        $stats = $this->coordinator->statistics();

        return [
            'pending' => $stats['by_status']['pending'],
            'processing' => $stats['by_status']['processing'],
            'completed' => $stats['by_status']['completed'],
            'failed' => $stats['by_status']['failed'],
            'total' => $stats['total'],
        ];
    }

    /**
     * Clean old completed items — NO-OP (no intermediate queue to prune;
     * completed state IS the canonical data). Kept for caller compatibility.
     */
    public function cleanQueue(int $days = 7): int
    {
        return 0;
    }

    /**
     * Get queue status for a specific word from its canonical row.
     * Returns null when the word was never queued (no row, or no TTS
     * tracking state) — callers treat null as "not in queue".
     */
    public function getQueueStatus(string $word, string $language): ?array
    {
        $language = strtolower($language);
        $md5 = md5($word);

        $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $md5);

        if (!$dictEntry || $dictEntry->tts_status === null) {
            return null;
        }

        $audioPath = null;
        if (is_array($dictEntry->tts_files)) {
            foreach ($dictEntry->tts_files as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    $audioPath = $ttsFile['path'];
                    break;
                }
            }
        }

        return [
            'word' => $dictEntry->content,
            'language' => $language,
            'status' => AppQyV1DictionaryTTSCoordinator::statusOf($dictEntry),
            'retry_count' => (int) ($dictEntry->tts_attempts ?? 0),
            'error_message' => $dictEntry->tts_error,
            'audio_path' => $audioPath,
            'requested_at' => $dictEntry->tts_requested_at,
            'started_at' => $dictEntry->tts_locked_at,
            'completed_at' => $dictEntry->tts_completed_at,
        ];
    }
}
