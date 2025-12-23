<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use Illuminate\Support\Facades\Log;

/**
 * TTS Queue Processing Task
 *
 * Octane timer task that processes the TTS queue.
 * The UnifiedTTSQueueService handles ALL types: word, sentence, article.
 *
 * No need for separate workers - Octane processes this task automatically.
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
            // Process TTS queue - handles word, sentence, and article tasks
            $result = $this->queueService->processQueue($this->queueBatchSize);

            if ($result['processed'] > 0) {
                $this->logInfo('[TTSQueue] Processed queue items', [
                    'processed' => $result['processed'],
                    'succeeded' => $result['succeeded'],
                    'failed' => $result['failed'],
                    'batch_size' => $result['batch_size'] ?? 'N/A',
                    'success_rate' => $result['success_rate'] ?? 'N/A',
                    'interval_seconds' => $result['interval_seconds'] ?? 'N/A',
                    'rate_limited' => $result['rate_limit_detected'] ?? false,
                ]);
            }

            // Clean old completed tasks periodically
            if ($result['processed'] > 0) {
                $this->queueService->cleanQueue(7);
            }

        } catch (\Throwable $e) {
            $this->logError('TTS queue processing failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    public function isEnabled(): bool
    {
        return env('APPQYV1_TTS_AUTO_GENERATION', true);
    }
}
