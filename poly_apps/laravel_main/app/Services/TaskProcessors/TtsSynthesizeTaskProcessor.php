<?php

namespace App\Services\TaskProcessors;

use App\Models\GlobalTask;
use App\Services\EdgeTTS\EdgeTTSService;

/**
 * Stores pycore's MP3 for a `tts_synthesize` task at the payload path
 * (EdgeTTSService::generateAudio queued it on a cache miss).
 */
class TtsSynthesizeTaskProcessor extends AbstractTaskProcessor
{
    protected function taskTypeRoles(): array
    {
        return [EdgeTTSService::TASK_TYPE];
    }

    public function processResult(GlobalTask $task, array $result, bool $isDemoMode): int
    {
        $inner = is_array($result['result'] ?? null) ? $result['result'] : $result;
        $binary = base64_decode((string) ($inner['audio_base64'] ?? ''), true);

        if ($isDemoMode || !is_string($binary)) {
            return 0;
        }

        return app(EdgeTTSService::class)->storeSynthesizedAudio((array) $task->payload, $binary) ? 1 : 0;
    }
}
