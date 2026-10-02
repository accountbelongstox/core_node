<?php

namespace App\Services\TimerTasks;

use App\Apps\McpV1\VoiceSubtitleV1\VoiceSubtitleV1Utils\VoiceSubtitleV1PipelineRunner;

/**
 * Advances accepted voice-subtitle tasks in the background lane (AI calls and
 * pycore TTS/OCR waits never hold a request worker).
 */
final class VoiceSubtitleV1PipelineTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 3;

    public function getExecutionMode(): string
    {
        return self::EXECUTION_BACKGROUND;
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function exec(): void
    {
        (new VoiceSubtitleV1PipelineRunner())->tick();
    }
}
