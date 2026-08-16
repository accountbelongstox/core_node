<?php

namespace App\Traits;

use App\Services\EdgeTTS\EdgeTTSService;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Shared TTS audio-serving helper for controllers that stream files from the
 * AppQyV1 audio tree (EdgeTTSService::getAudioPath base).
 *
 * Single home for the file-read + audio/mpeg + long-cache header logic; each
 * controller keeps its own 404 style by handling the null return.
 */
trait ServesTTSAudio
{
    /**
     * Resolve a relative audio path ({lang}/{type}/[{speed}/]{file}) and
     * stream it, or return null when the file is missing.
     */
    protected function serveTTSAudioFile(EdgeTTSService $ttsService, string $relativePath): ?BinaryFileResponse
    {
        $fullPath = $ttsService->getAudioPath($relativePath);

        if (!$fullPath || !file_exists($fullPath)) {
            return null;
        }

        return response()->file($fullPath, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=31536000',
        ]);
    }
}
