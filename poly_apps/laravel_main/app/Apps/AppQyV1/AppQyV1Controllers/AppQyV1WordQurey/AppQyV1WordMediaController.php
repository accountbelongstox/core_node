<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

/**
 * Word-media on-demand resolution surface (P2 of the word-media pipeline).
 *
 * GET /api/app_qy_v1/word/{lang}/{word}/media
 *
 * FILE-FIRST: image_url / audio_url are returned ONLY when the resolved file is
 * on disk. On a miss the word is enqueued (image queue + TTS queue) and a
 * 'word_media' global task is ensured/bumped to the front, and the relevant
 * status flips to 'pending'. The active query also moves the word to the FRONT
 * of every queue layer (on-query prioritization).
 *
 * All file resolution + enqueue + prioritization lives in
 * AppQyV1WordMediaService so the resolve endpoint, the smart image-serve route
 * and the on-query hooks share one implementation.
 */
class AppQyV1WordMediaController extends BaseController
{
    /**
     * GET /api/app_qy_v1/word/{lang}/{word}/media
     *
     * Optional query param: target_language (translation target to prioritize).
     *
     * @return JsonResponse { success, data: { word, md5, language,
     *   image_url|null, audio_url|null, image_status, audio_status,
     *   translations:[], explanation, phonetic, us_phonetic, uk_phonetic } }
     */
    public function media(Request $request, string $lang, string $word): JsonResponse
    {
        $word = trim(urldecode($word));
        if ($word === '') {
            return response()->json([
                'success' => false,
                'message' => 'No word provided',
            ], 400);
        }

        $targetLanguage = $request->query('target_language');
        if (!is_string($targetLanguage) || $targetLanguage === '') {
            $targetLanguage = null;
        }

        // Preferred English accent ("us"|"uk") from the FE voiceAccent setting
        // (target #4): threaded into the word_audio task payload so pycore
        // generates the requested accent. Anything else / unset = no preference.
        $accent = $request->query('accent');
        if (!is_string($accent) || !in_array(strtolower(trim($accent)), ['us', 'uk'], true)) {
            $accent = null;
        }

        $data = (new AppQyV1WordMediaService())->resolve($word, $lang, $targetLanguage, true, $accent);

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
