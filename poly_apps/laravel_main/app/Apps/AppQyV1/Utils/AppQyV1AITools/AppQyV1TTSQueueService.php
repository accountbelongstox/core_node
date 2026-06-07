<?php

namespace App\Apps\AppQyV1\Utils\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TTSQueueModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Support\Facades\Log;

/**
 * TTS Queue Service
 *
 * Manages TTS audio generation queue for on-demand word audio requests
 */
class AppQyV1TTSQueueService
{
    private $ttsService;

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
    }

    /**
     * Request audio for a word
     * Returns audio path if available, null if queued for generation
     */
    public function requestAudio(string $word, string $language, int $priority = 0): ?array
    {
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

        AppQyV1TTSQueueModel::addToQueue($word, $language, $priority);

        return null;
    }

    /**
     * Process queue items (called by timer task)
     */
    public function processQueue(int $batchSize = 10): array
    {
        $items = AppQyV1TTSQueueModel::getNextBatch($batchSize);

        $processed = 0;
        $succeeded = 0;
        $failed = 0;

        foreach ($items as $item) {
            $item->markAsProcessing();

            try {
                $result = $this->ttsService->generateAudio(
                    $item->word,
                    $item->language,
                    'word'
                );

                if ($result['success']) {
                    $item->markAsCompleted($result['audio_path']);
                    $succeeded++;

                    Log::info('[TTSQueue] Generated audio for word', [
                        'word' => $item->word,
                        'language' => $item->language,
                        'audio_path' => $result['audio_path'],
                    ]);
                } else {
                    $errorMsg = $result['error'] ?? 'Unknown error';

                    if ($item->canRetry()) {
                        $item->status = AppQyV1TTSQueueModel::STATUS_PENDING;
                        $item->retry_count++;
                        $item->error_message = $errorMsg;
                        $item->save();

                        Log::warning('[TTSQueue] Audio generation failed, will retry', [
                            'word' => $item->word,
                            'language' => $item->language,
                            'retry_count' => $item->retry_count,
                            'error' => $errorMsg,
                        ]);
                    } else {
                        $item->markAsFailed($errorMsg);
                        $failed++;

                        Log::error('[TTSQueue] Audio generation permanently failed', [
                            'word' => $item->word,
                            'language' => $item->language,
                            'error' => $errorMsg,
                        ]);
                    }
                }

                $processed++;

                usleep(200000);

            } catch (\Throwable $e) {
                $errorMsg = $e->getMessage();

                if ($item->canRetry()) {
                    $item->status = AppQyV1TTSQueueModel::STATUS_PENDING;
                    $item->retry_count++;
                    $item->error_message = $errorMsg;
                    $item->save();
                } else {
                    $item->markAsFailed($errorMsg);
                    $failed++;
                }

                Log::error('[TTSQueue] Exception during audio generation', [
                    'word' => $item->word,
                    'language' => $item->language,
                    'error' => $errorMsg,
                    'trace' => $e->getTraceAsString(),
                ]);

                $processed++;
            }
        }

        return [
            'processed' => $processed,
            'succeeded' => $succeeded,
            'failed' => $failed,
        ];
    }

    /**
     * Get queue statistics
     */
    public function getQueueStats(): array
    {
        return AppQyV1TTSQueueModel::getStats();
    }

    /**
     * Clean old completed items
     */
    public function cleanQueue(int $days = 7): int
    {
        return AppQyV1TTSQueueModel::cleanCompleted($days);
    }

    /**
     * Get queue status for specific word
     */
    public function getQueueStatus(string $word, string $language): ?array
    {
        $md5 = md5($word);

        $queueItem = AppQyV1TTSQueueModel::where('word_md5', $md5)
            ->where('language', $language)
            ->first();

        if (!$queueItem) {
            return null;
        }

        return [
            'word' => $queueItem->word,
            'language' => $queueItem->language,
            'status' => $queueItem->status,
            'priority' => $queueItem->priority,
            'retry_count' => $queueItem->retry_count,
            'error_message' => $queueItem->error_message,
            'audio_path' => $queueItem->audio_path,
            'requested_at' => $queueItem->requested_at,
            'started_at' => $queueItem->started_at,
            'completed_at' => $queueItem->completed_at,
        ];
    }
}
