<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use Illuminate\Support\Facades\Log;

/**
 * TTS Generation Task — legacy word-audio compatibility producer.
 *
 * The distributed Queue Center is the canonical audio execution plane. This
 * disabled-by-default timer remains only for legacy desktop word-audio flows;
 * article and sentence audio are never consumed locally here.
 *
 * Stale processing claims are reaped at the start of every run, so crashed
 * processors (this timer or external pycore workers) never strand rows.
 */
class AppQyV1TTSGenerationTask extends OctaneTimerTaskAbstract
{
    private $queueService;
    // Use intelligent batch size (dynamically adjusted based on performance)
    // null = auto-detect optimal batch size based on success rate
    private $queueBatchSize = null;

    public function __construct()
    {
        $this->queueService = new AppQyV1UnifiedTTSQueueService();
    }

    public function getName(): string
    {
        return 'appqyv1_tts_generation';
    }

    public function getInterval(): int
    {
        return 60;
    }

    public function exec(): void
    {
        try {
            // Process only the legacy pending word rows.
            $result = $this->queueService->processQueue($this->queueBatchSize);

            if ($result['processed'] > 0) {
                $this->logInfo('[TTSQueue] Processed pending TTS items', [
                    'processed' => $result['processed'],
                    'succeeded' => $result['succeeded'],
                    'failed' => $result['failed'],
                    'batch_size' => $result['batch_size'] ?? 'N/A',
                    'success_rate' => $result['success_rate'] ?? 'N/A',
                    'interval_seconds' => $result['interval_seconds'] ?? 'N/A',
                    'rate_limited' => $result['rate_limit_detected'] ?? false,
                ]);
            }
        } catch (\Throwable $e) {
            $this->logError('TTS generation processing failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    public function isEnabled(): bool
    {
        // Default OFF: Laravel no longer synthesizes TTS itself. On servers the
        // edge-tts endpoint 403s (region/rate block) and Laravel should not run an
        // external TTS engine at all -- pycore is the sole provider via the assist
        // protocol (tts/worker/claim + tts/worker/report). Flip
        // Enable the user-data setting only on a desktop where Laravel itself
        // should generate audio, such as when no pycore worker is available.
        return app(\App\Services\UserConfig\UserConfigService::class)->get('appqyv1_tts_auto_generation', false);
    }
}
