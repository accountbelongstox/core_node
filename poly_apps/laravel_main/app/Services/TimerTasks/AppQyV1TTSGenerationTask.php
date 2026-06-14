<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use Illuminate\Support\Facades\Log;

/**
 * TTS Generation Task — queue-less operation.
 *
 * Octane timer task that drives TTS generation directly against the
 * canonical tables (no intermediate tts_queue table anymore):
 *   - words:    pending tts_cache_{lang} rows are claimed via
 *               AppQyV1DictionaryTTSCoordinator and generated inline;
 *   - articles: pending {lang}_article_library rows are split into
 *               sentences, generated, and written back to the article row;
 *   - sentences: stateless — generated synchronously at request time by
 *               AppQyV1UnifiedTTSQueueService::addTask, never by this timer.
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
            // Process pending word + article rows on the canonical tables.
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
        return env('APPQYV1_TTS_AUTO_GENERATION', true);
    }
}
