<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Log;

/**
 * Edge voice synthesis through pycore's `tts/synthesize` route (pycore's TTS
 * orchestrator pinned to the edge engine). The local edge-tts binary path
 * (binary assist ON) lives in EdgeTTSService, which calls this bridge otherwise.
 */
class PycoreEdgeTTSUtil
{
    private const PROVIDER = 'edge';
    private const DEFAULT_LANGUAGE = 'en';
    private const MIN_AUDIO_BYTES = 100;

    /**
     * pycore's payload raw ({success, engine, model, cached, bytes, audio_base64, mime})
     * or a PycoreRpcException::payload() failure.
     */
    public static function synthesize(string $text, string $voice): array
    {
        try {
            return PycoreHttpClient::call('ttsSynthesize', [
                'text' => $text,
                'language' => self::languageFromVoice($voice),
                'voice' => $voice,
                'provider' => self::PROVIDER,
                'return_base64' => true,
                'enable_cache' => true,
            ]);
        } catch (PycoreRpcException $e) {
            return $e->payload();
        }
    }

    /**
     * Synthesize and write the MP3 to $outputPath.
     *
     * @return array{success: bool, error?: string}
     */
    public static function synthesizeToFile(string $text, string $voice, string $outputPath): array
    {
        $payload = self::synthesize($text, $voice);
        $binary = false;

        if (($payload['success'] ?? false) !== true) {
            Log::error('[PycoreEdgeTTS] tts/synthesize failed', ['voice' => $voice, 'error' => $payload['error'] ?? null]);

            return ['success' => false, 'error' => (string) ($payload['error'] ?? __('pycore.edge_tts_no_audio'))];
        }
        $binary = is_string($payload['audio_base64'] ?? null) ? base64_decode($payload['audio_base64'], true) : false;
        if ($binary === false || strlen($binary) < self::MIN_AUDIO_BYTES) {
            Log::error('[PycoreEdgeTTS] tts/synthesize returned no valid audio', ['voice' => $voice, 'bytes' => $payload['bytes'] ?? null]);

            return ['success' => false, 'error' => __('pycore.edge_tts_no_audio')];
        }
        if (@file_put_contents($outputPath, $binary) === false) {
            return ['success' => false, 'error' => __('pycore.edge_tts_write_failed', ['path' => $outputPath])];
        }

        return ['success' => true];
    }

    /** Language of an edge voice id (en-US-JennyNeural -> en). */
    private static function languageFromVoice(string $voice): string
    {
        $language = explode('-', $voice, 2)[0];

        return $language !== '' ? $language : self::DEFAULT_LANGUAGE;
    }
}
