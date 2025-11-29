<?php

namespace App\Services\TimerTasks;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyCoverModel;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Services\GeminiClient;
use Illuminate\Support\Facades\File;

class AppQyV1CoverGenerationTask extends OctaneTimerTaskAbstract
{
    private GeminiClient $gemini;
    private AppQyV1VocabularyCoverService $coverService;
    private int $batchSize = 2;

    public function __construct()
    {
        $this->gemini = new GeminiClient();
        $this->coverService = new AppQyV1VocabularyCoverService();
    }

    public function isEnabled(): bool
    {
        return $this->gemini->hasApiKey();
    }

    public function getInterval(): int
    {
        return 180;
    }

    public function exec(): void
    {
        $covers = AppQyV1VocabularyCoverModel::query()
            ->whereIn('status', ['pending', 'retry'])
            ->orderByDesc('priority')
            ->orderBy('updated_at')
            ->limit($this->batchSize)
            ->get();

        if ($covers->isEmpty()) {
            return;
        }

        foreach ($covers as $cover) {
            $cover->status = 'processing';
            $cover->save();

            $prompt = $cover->prompt ?: 'Design a modern vocabulary library cover art';
            $result = $this->gemini->generateImage($prompt, [
                'model' => 'gemini-2.0-flash-exp',
                'size' => '1280x720',
            ]);

            if (!($result['success'] ?? false)) {
                $cover->status = 'retry';
                $cover->error_message = $result['error'] ?? 'Unknown error';
                $cover->save();
                $this->logError('Gemini cover generation failed', [
                    'library_id' => $cover->library_id,
                    'error' => $cover->error_message,
                ]);
                continue;
            }

            $path = $this->coverService->getCoverPath($cover->cover_filename);
            File::put($path, $result['binary']);

            $cover->status = 'ready';
            $cover->error_message = null;
            $cover->last_generated_at = now();
            $cover->width = $result['width'] ?? 1280;
            $cover->height = $result['height'] ?? 720;
            $cover->save();

            $this->logInfo('Generated cover', [
                'library_id' => $cover->library_id,
                'filename' => $cover->cover_filename,
            ]);
        }
    }
}
