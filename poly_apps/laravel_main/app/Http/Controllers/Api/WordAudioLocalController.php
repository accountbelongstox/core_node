<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AiGateway\AiSecretLoader;
use App\Services\WordAudio\WordAudioClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Local word-audio surface for laravel_main — the PHP twin of pycore's
 * /api/local/word-audio/* router.
 *
 * Same paths, same response contract, so the dashboard's Word Audio page can
 * talk to either runtime. laravel exposes 2 REAL pronunciation sources
 * (free_dictionary_api + forvo); pycore additionally reports cambridge_dictionary
 * (HTML-page audio), which this PHP client intentionally does NOT implement.
 *
 *   GET  /api/local/word-audio/status   source availability, no network calls
 *   POST /api/local/word-audio/test     { word, lang? } — real live fetch through WordAudioClient
 *
 * The Forvo key is NEVER returned; /status only reports whether it is present.
 */
class WordAudioLocalController extends Controller
{
    public function status(): JsonResponse
    {
        // Determine Forvo key presence the SAME way WordAudioClient does — a plain
        // secret lookup, no network call, and the key value never leaves this method.
        $forvoKeyPresent = trim(AiSecretLoader::getIndexed('FORVO_API_KEY')) !== '';

        return response()->json([
            'backend' => 'laravel',
            'sources' => [
                [
                    'key' => 'free_dictionary_api',
                    'label' => 'Free Dictionary API',
                    'available' => true,
                    'requires_key' => false,
                    'note' => 'English only, keyless public API',
                ],
                [
                    'key' => 'forvo',
                    'label' => 'Forvo (official API)',
                    'available' => $forvoKeyPresent,
                    'requires_key' => true,
                    'note' => 'Multi-language; requires FORVO_API_KEY',
                ],
            ],
            'forvo_key_present' => $forvoKeyPresent,
            'tts_fallback' => true,
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $word = trim((string) $request->input('word', ''));
        if ($word === '') {
            return response()->json(['success' => false, 'error' => 'word is required'], 400);
        }
        $lang = strtolower(trim((string) $request->input('lang', 'en')));
        if ($lang === '') {
            $lang = 'en';
        }

        try {
            $result = (new WordAudioClient())->findPronunciation($word, $lang);
        } catch (\Throwable $e) {
            // Degrade to a clean miss — the /test endpoint must never 500.
            $result = null;
        }

        if (is_array($result) && isset($result['binary']) && $result['binary'] !== '') {
            $binary = (string) $result['binary'];
            return response()->json([
                'success' => true,
                'provider' => (string) ($result['provider'] ?? ''),
                'mime' => (string) ($result['mime'] ?? 'audio/mpeg'),
                // Client returns RAW audio bytes — base64-encode before transport.
                'audio_base64' => base64_encode($binary),
                'source_id' => (string) ($result['meta']['audio_url'] ?? ''),
                'meta' => is_array($result['meta'] ?? null) ? $result['meta'] : [],
                'bytes' => strlen($binary),
            ]);
        }

        return response()->json([
            'success' => false,
            'provider' => null,
            'message' => "No real pronunciation found for '{$word}' ({$lang}); the TTS fallback would handle it.",
        ]);
    }
}
