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

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AudioGateway;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Log;

/**
 * Word-media on-demand resolution surface (P2 of the word-media pipeline).
 *
 * GET /api/app_qy_v1/word/{lang}/{word}/media
 *
 * FILE-FIRST: image_url / audio_url are returned ONLY when the resolved file is
 * on disk. On a miss the word is enqueued for image work and the audio gateway
 * inserts or moves its global task to the word_audio queue head.
 *
 * All file resolution and queue ordering lives in
 * AppQyV1WordMediaService so the resolve endpoint, the smart image-serve route
 * and the on-query hooks share one implementation.
 */
class AppQyV1WordMediaController extends Controller
{
    public function audio(Request $request, string $lang, string $word): JsonResponse
    {
        $word = trim(urldecode($word));
        if ($word === '') {
            return response()->json(['success' => false, 'error' => 'word_required'], 400);
        }

        $accent = $request->query('accent');
        $accent = is_string($accent) && in_array(strtolower(trim($accent)), ['us', 'uk'], true)
            ? strtolower(trim($accent))
            : null;
        $data = (new AppQyV1AudioGateway())->requestWord(
            $word,
            $lang,
            $accent,
            !$request->boolean('passive'),
            true
        );

        return response()->json(['success' => (bool) $data['success'], 'data' => $data]);
    }

    public function moveAudioToHead(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'words' => 'required|array|min:1|max:100',
            'words.*' => 'required|string|max:255',
            'language' => 'required|string|max:20',
        ]);
        $results = (new AppQyV1AudioGateway())->requestWordBatch(
            $validated['words'],
            $validated['language']
        );

        return response()->json([
            'success' => !in_array(false, array_map(
                static fn (array $item): bool => (bool) ($item['success'] ?? false),
                $results
            ), true),
            'data' => [
                'queued' => count(array_filter(
                    $results,
                    static fn (array $item): bool => ($item['audio_status'] ?? null) !== 'ready'
                )),
                'total' => count($results),
                'results' => $results,
            ],
        ]);
    }

    /**
     * GET /api/app_qy_v1/word/{lang}/{word}/media
     *
     * Optional query param: target_language (translation target to prioritize).
     * Optional query param: passive=1 reads current state without queue writes.
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
        $passive = $request->boolean('passive');

        $data = (new AppQyV1WordMediaService())->resolve(
            $word,
            $lang,
            $targetLanguage,
            !$passive,
            $accent,
            true,
            !$passive
        );

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * POST /api/app_qy_v1/word/audio/upload
     *
     * Persist frontend-generated word audio (e.g. Puter.js txt2speech) for a
     * dictionary row matched by (lang, md5). Fill-missing: a row that already
     * has audio is left untouched. The bytes are validated (size + MP3 magic)
     * and re-verified on disk before the row is flipped, reusing the exact
     * path/disk logic of the worker report (storeWordAudioBytes).
     *
     * Body: { md5, lang, audio_base64, provider?, accent? }
     *
     * @return JsonResponse { success, data: { stored, md5, language } }
     */
    public function uploadAudio(Request $request): JsonResponse
    {
        $md5 = trim((string) $request->input('md5', ''));
        $langInput = trim((string) $request->input('lang', ''));
        $audioBase64 = (string) $request->input('audio_base64', '');
        $provider = (string) $request->input('provider', 'puter') ?: 'puter';
        // Optional cleaned-word notification: when the FE/pycore cleaned the word
        // (HTML entities / special chars -> '-') before synth, it sends the cleaned
        // form so the backend can fix the dictionary row. Empty when no cleaning.
        $cleanedWord = trim((string) $request->input('cleaned_word', ''));

        if ($md5 === '' || $langInput === '' || $audioBase64 === '') {
            return response()->json([
                'success' => false,
                'message' => 'md5, lang and audio_base64 are required',
            ], 400);
        }

        $bytes = base64_decode($audioBase64, true);
        if ($bytes === false
            || strlen($bytes) < 100
            || !AppQyV1DictionaryTTSCoordinator::looksLikeMp3($bytes)
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid audio payload (must be a valid MP3 >= 100 bytes)',
            ], 422);
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($langInput);
        $coordinator = new AppQyV1DictionaryTTSCoordinator();
        $result = $coordinator->storeWordAudioBytesDetailed($langCode, $md5, $bytes, $provider);
        $stored = $result['stored'];
        $reason = $result['reason'];

        // Notify (log) when the FE/pycore cleaned the word before synth. We do NOT
        // mutate the row's word/md5 here - changing either would break the
        // md5-keyed audio path (the audio is stored under the original md5). The
        // cleaning's effect is the audio itself speaking the clean form.
        if ($cleanedWord !== '') {
            Log::info('[WordMedia] word cleaned before synth', [
                'language' => $langCode,
                'md5' => $md5,
                'cleaned_word' => $cleanedWord,
            ]);
        }

        // Row-not-found is a genuine error the FE must surface (do NOT mark done);
        // exists/stored/io_error/invalid are reported with an explicit status so the
        // FE can mark-done ('exists','stored') vs retry/flag the rest.
        if ($reason === 'not_found') {
            return response()->json([
                'success' => false,
                'message' => 'No dictionary row for the given md5/lang',
                'data' => [
                    'stored' => false,
                    'status' => 'not_found',
                    'md5' => $md5,
                    'language' => $langCode,
                ],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'stored' => $stored,
                'status' => $reason,
                'md5' => $md5,
                'language' => $langCode,
                'cleaned_word' => $cleanedWord !== '' ? $cleanedWord : null,
            ],
        ]);
    }

    /**
     * POST /api/app_qy_v1/word/fix-text
     *
     * Update the content (word text) of a dictionary row that was found to
     * contain garbled text or HTML markup during browser-side audio generation.
     * The cleaned form (HTML entities decoded, non-word chars replaced with '-')
     * is written back so future audio, TTS and display all use the clean text.
     *
     * Body: { md5, lang, cleaned_word }
     *
     * Skips is_valid=false rows (they are marked bad for other reasons and the
     * batch already excludes them). Idempotent — calling twice with the same
     * cleaned_word is safe.
     *
     * @return JsonResponse { success, updated }
     */
    public function fixWordText(Request $request): JsonResponse
    {
        $md5 = trim((string) $request->input('md5', ''));
        $langInput = trim((string) $request->input('lang', ''));
        $cleanedWord = trim((string) $request->input('cleaned_word', ''));

        if ($md5 === '' || $langInput === '' || $cleanedWord === '') {
            return response()->json([
                'success' => false,
                'message' => 'md5, lang and cleaned_word are required',
            ], 400);
        }

        $result = (new AppQyV1WordMediaService())->fixWordText(
            $md5,
            $langInput,
            $cleanedWord
        );

        return response()->json($result);
    }

    /**
     * GET /api/app_qy_v1/word/audio/missing-batch?limit=1000&language=en
     *
     * Returns up to ``limit`` words that have NO audio (has_audio=false) for the
     * browser-side Puter.js batch generator to synthesize + upload. Words the
     * backend marked invalid (is_valid=false) are EXCLUDED - never request them.
     * Ordered by id (oldest first) so backfill is stable across calls.
     *
     * @return JsonResponse { success, language, count, words:[{word,md5,language}] }
     */
    public function missingBatch(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', 1000);
        $limit = max(1, min($limit, 100000)); // supports 1000/5000/10000/all
        $langInput = trim((string) $request->query('language', ''));
        $result = (new AppQyV1WordMediaService())->missingAudioBatch(
            $langInput !== '' ? $langInput : 'en',
            $limit
        );

        return response()->json($result);
    }
}
