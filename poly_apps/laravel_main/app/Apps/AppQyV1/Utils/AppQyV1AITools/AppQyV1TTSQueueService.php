<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use App\Services\EdgeTTS\EdgeTTSService;

/**
 * TTS Queue Service (legacy word-level surface) — queue-less edition.
 *
 * The intermediate tts_queue table is decommissioned; word TTS state lives on
 * the canonical {prefix}_tts_cache_{lang} rows (tts_status / tts_attempts /
 * tts_priority / tts_* timestamps) coordinated by
 * AppQyV1DictionaryTTSCoordinator. This class keeps the legacy method
 * surface used by AppQyV1TTSController (queueBatch / queue stats / queue
 * status endpoints) with byte-compatible response shapes.
 */
class AppQyV1TTSQueueService
{
    private $ttsService;
    private AppQyV1DictionaryTTSCoordinator $coordinator;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
        $this->coordinator = new AppQyV1DictionaryTTSCoordinator($this->ttsService);
    }

    /**
     * Request audio for a word.
     * Returns audio info if available, null after queueing for generation
     * (marking the canonical dictionary row tts_status='pending').
     */
    public function requestAudio(string $word, string $language, int $priority = 0): ?array
    {
        $language = strtolower($language);
        $md5 = md5($word);

        $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $md5);

        if ($dictEntry && isset($dictEntry->tts_files) && !empty($dictEntry->tts_files)) {
            foreach ($dictEntry->tts_files as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    $fullPath = $this->ttsService->getAudioPath($ttsFile['path']);
                    if ($fullPath) {
                        $dictEntry->incrementQueryCount();
                        return [
                            'available' => true,
                            'audio_path' => $ttsFile['path'],
                            'audio_url' => AppQyV1TtsUrl::forPath($ttsFile['path']),
                        ];
                    }
                }
            }
        }

        // Queue for generation on the canonical row (auto-create when absent).
        if (!$dictEntry) {
            $dictEntry = AppQyV1LangDictionaryModel::forLanguage($language);
            $dictEntry->content = $word;
            $dictEntry->md5 = $md5;
            $dictEntry->has_translation = false;
            $dictEntry->has_audio = false;
            $dictEntry->is_valid = true;
            $dictEntry->query_count = 0;
            AppQyV1LangDictionaryModel::forgetMetricsCache($language);
        }

        // Failed rows get a fresh retry budget on re-request (legacy addToQueue
        // re-queued failed entries that still had retries left).
        if ($dictEntry->tts_status === AppQyV1DictionaryTTSCoordinator::STATUS_FAILED) {
            $dictEntry->tts_attempts = 0;
            $dictEntry->tts_error = null;
        }

        if ($dictEntry->tts_status === null
            || $dictEntry->tts_status === AppQyV1DictionaryTTSCoordinator::STATUS_FAILED) {
            $dictEntry->tts_status = AppQyV1DictionaryTTSCoordinator::STATUS_PENDING;
        }
        if (!$dictEntry->tts_requested_at) {
            $dictEntry->tts_requested_at = now();
        }
        $dictEntry->tts_priority = max((int) ($dictEntry->tts_priority ?? 0), $priority);
        $dictEntry->save();

        return null;
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
            'priority' => (int) ($dictEntry->tts_priority ?? 0),
            'retry_count' => (int) ($dictEntry->tts_attempts ?? 0),
            'error_message' => $dictEntry->tts_error,
            'audio_path' => $audioPath,
            'requested_at' => $dictEntry->tts_requested_at,
            'started_at' => $dictEntry->tts_locked_at,
            'completed_at' => $dictEntry->tts_completed_at,
        ];
    }
}
