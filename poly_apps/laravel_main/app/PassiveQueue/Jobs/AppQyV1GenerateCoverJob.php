<?php

namespace App\PassiveQueue\Jobs;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCoverModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\PassiveQueue\PassiveQueue;
use App\Services\GeminiClient;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class AppQyV1GenerateCoverJob implements PassiveQueueJobInterface
{
    public function handle(array $payload): void
    {
        $coverId = $payload['cover_id'] ?? null;
        if (!$coverId) {
            Log::warning('[PassiveQueue] Missing cover_id payload for AppQyV1GenerateCoverJob', $payload);
            return;
        }

        $cover = AppQyV1VocabularyCoverModel::query()->find($coverId);
        if (!$cover) {
            Log::warning('[PassiveQueue] Cover record not found', ['cover_id' => $coverId]);
            return;
        }

        $coverService = new AppQyV1VocabularyCoverService();
        $prompt = $cover->prompt ?: 'Design a modern vocabulary learning cover art';

        $gemini = new GeminiClient();
        if (!$gemini->hasApiKey()) {
            Log::warning('[PassiveQueue] Gemini API key missing, skipping cover generation');
            return;
        }

        $cover->status = 'processing';
        $cover->started_at = now();
        $cover->save();

        $result = $gemini->generateImageFromPrompt($prompt, [
            'model' => 'gemini-2.5-flash-image',
            'size' => $cover->width . 'x' . $cover->height,
        ]);

        if (!($result['success'] ?? false)) {
            $message = $result['error'] ?? 'Unknown Gemini error';
            $delay = (int) ($result['retry_after'] ?? 60);
            $this->reschedule($cover, $delay, $message);
            Log::error('[PassiveQueue] Gemini cover generation failed', [
                'cover_id' => $coverId,
                'error' => $message,
            ]);
            return;
        }

        $path = $coverService->getCoverPath($cover->cover_filename);
        File::put($path, $result['binary']);

        $cover->status = 'ready';
        $cover->error_message = null;
        $cover->last_generated_at = now();
        $cover->finished_at = now();
        $cover->width = $result['width'] ?? $cover->width;
        $cover->height = $result['height'] ?? $cover->height;
        $cover->save();

        Log::info('[PassiveQueue] Cover generated', [
            'cover_id' => $coverId,
            'file' => $path,
        ]);
    }

    private function reschedule(AppQyV1VocabularyCoverModel $cover, int $delaySeconds, string $message): void
    {
        $cover->status = 'retry';
        $cover->error_message = $message;
        $cover->finished_at = now();
        $cover->save();

        PassiveQueue::dispatch(self::class, ['cover_id' => $cover->id], $delaySeconds);
    }
}
