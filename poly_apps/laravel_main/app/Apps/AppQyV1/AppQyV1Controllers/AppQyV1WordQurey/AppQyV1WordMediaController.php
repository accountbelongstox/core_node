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

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryTTSCoordinator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

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
     * POST /api/app_qy_v1/word/boost-priority
     *
     * Bump a word's tts_priority so it rises to the front of the audio
     * generation queue on the next missing-batch call. Move-to-front ticket:
     * the row gets MAX(tts_priority)+1 under a transaction-scoped advisory
     * lock on the table, so the newest boost always sorts strictly ahead of
     * every other row and two concurrent boosts cannot share a ticket. Safe
     * to call multiple times. Skips is_valid=false rows.
     *
     * Body: { md5, lang }
     *
     * @return JsonResponse { success, updated }
     */
    public function boostPriority(Request $request): JsonResponse
    {
        $md5 = trim((string) $request->input('md5', ''));
        $langInput = trim((string) $request->input('lang', ''));

        if ($md5 === '' || $langInput === '') {
            return response()->json([
                'success' => false,
                'message' => 'md5 and lang are required',
            ], 400);
        }

        $langCode = AppQyV1DictionaryService::getLanguageCode($langInput);
        $dictModel = AppQyV1LangDictionaryModel::forLanguage($langCode);
        $table = $dictModel->getModel()->getTable();
        // Guard the raw SQL exactly like the sentence path's tableExists(): a
        // crafted lang yields a non-existent table name and is rejected here, so
        // the interpolated identifier can never carry user input into the UPDATE.
        if (!$dictModel->getConnection()->getSchemaBuilder()->hasTable($table)) {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported language',
            ], 400);
        }
        try {
            $conn = $dictModel->getConnection();
            $boost = $conn->transaction(function () use ($conn, $table, $md5) {
                AppQyV1TableMaps::lockTableForFrontTicket($conn, $table);
                $updated = $conn->update(
                    "UPDATE {$table} SET tts_priority = (SELECT m FROM (SELECT COALESCE(MAX(tts_priority), 0) + 1 AS m FROM {$table}) x) WHERE md5 = ? AND (is_valid IS NULL OR is_valid IS TRUE)",
                    [$md5]
                );
                $row = $updated > 0
                    ? $conn->selectOne("SELECT tts_priority FROM {$table} WHERE md5 = ?", [$md5])
                    : null;
                return [
                    'updated' => $updated,
                    'priority' => (int) ($row->tts_priority ?? 0),
                ];
            });
            if ($boost['updated'] > 0) {
                AppQyV1TranslationEventModel::emit('word_audio.priority', [
                    'md5' => $md5,
                    'language' => $langCode,
                    'priority' => $boost['priority'],
                ]);
            }
            return response()->json(['success' => true] + $boost);
        } catch (\Throwable $e) {
            Log::warning('[WordMedia] boostPriority failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'DB error: ' . $e->getMessage(),
            ]);
        }
    }

    public function boostPriorityBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1|max:200',
            'items.*.md5' => 'required|string|max:64',
            'items.*.lang' => 'required|string|max:20',
        ]);
        $groups = [];
        foreach ($validated['items'] as $item) {
            $language = AppQyV1DictionaryService::getLanguageCode(trim((string) $item['lang']));
            $groups[$language][] = trim((string) $item['md5']);
        }
        $boosted = [];
        try {
            foreach ($groups as $language => $md5s) {
                $dictModel = AppQyV1LangDictionaryModel::forLanguage($language);
                $table = $dictModel->getModel()->getTable();
                if (!$dictModel->getConnection()->getSchemaBuilder()->hasTable($table)) {
                    continue;
                }
                $conn = $dictModel->getConnection();
                $rows = $conn->transaction(function () use ($conn, $table, $md5s, $language): array {
                    AppQyV1TableMaps::lockTableForFrontTicket($conn, $table);
                    $head = $conn->selectOne("SELECT COALESCE(MAX(tts_priority), 0) AS priority FROM {$table}");
                    $ticket = (int) ($head->priority ?? 0) + count($md5s);
                    $result = [];
                    foreach ($md5s as $index => $md5) {
                        $priority = $ticket - $index;
                        $updated = $conn->update(
                            "UPDATE {$table} SET tts_priority = ? WHERE md5 = ? AND (is_valid IS NULL OR is_valid IS TRUE)",
                            [$priority, $md5]
                        );
                        if ($updated > 0) {
                            $result[] = ['md5' => $md5, 'language' => $language, 'priority' => $priority];
                        }
                    }
                    return $result;
                });
                $boosted = array_merge($boosted, $rows);
            }
            if (!empty($boosted)) {
                AppQyV1TranslationEventModel::emit('word_audio.priority', [
                    'batch' => true,
                    'count' => count($boosted),
                    'items' => $boosted,
                ]);
            }
            return response()->json([
                'success' => true,
                'count' => count($boosted),
                'items' => $boosted,
            ]);
        } catch (\Throwable $e) {
            Log::warning('[WordMedia] boostPriorityBatch failed: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'DB error: ' . $e->getMessage()]);
        }
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

        $langCode = AppQyV1DictionaryService::getLanguageCode($langInput);
        try {
            $updated = AppQyV1LangDictionaryModel::forLanguage($langCode)
                ->where('md5', $md5)
                ->where(function ($q) {
                    $q->whereNull('is_valid')->orWhere('is_valid', true);
                })
                ->update(['content' => $cleanedWord]);
            Log::info('[WordMedia] fixWordText applied', [
                'language' => $langCode,
                'md5' => $md5,
                'cleaned_word' => $cleanedWord,
                'updated' => $updated,
            ]);
            return response()->json(['success' => true, 'updated' => $updated]);
        } catch (\Throwable $e) {
            Log::warning('[WordMedia] fixWordText failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'DB error: ' . $e->getMessage(),
            ]);
        }
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
        $langCode = AppQyV1DictionaryService::getLanguageCode(
            $langInput !== '' ? $langInput : 'en'
        );

        $words = [];
        try {
            $baseQuery = AppQyV1LangDictionaryModel::forLanguage($langCode);
            $model = $baseQuery->getModel();
            $dictTable = $model->getTable();
            $connName = $model->getConnectionName();
            // Guard optional columns / missing table so the endpoint never 500s.
            $hasHasAudio = Schema::connection($connName)->hasColumn($dictTable, 'has_audio');
            $hasIsValid = Schema::connection($connName)->hasColumn($dictTable, 'is_valid');
            $hasTtsStatus = Schema::connection($connName)->hasColumn($dictTable, 'tts_status');
            // The word text lives in the `content` column (the tts_cache_{lang}
            // table has no `word` column); guard it for safety.
            $hasContent = Schema::connection($connName)->hasColumn($dictTable, 'content');
            $query = AppQyV1LangDictionaryModel::forLanguage($langCode);
            if ($hasHasAudio) {
                $query->where('has_audio', false);
            }
            if ($hasIsValid) {
                // Skip backend-marked invalid words - never request audio for them.
                $query->where(function ($q) {
                    $q->where('is_valid', true)->orWhereNull('is_valid');
                });
            }
            if ($hasTtsStatus) {
                // Skip permanently-failed words so the batch doesn't cycle through
                // TTS-worker rejects that will never recover.
                $query->where(function ($q) {
                    $q->whereNull('tts_status')->orWhere('tts_status', '!=', 'failed');
                });
            }
            // Exclude words that already have at least one audio file in the JSON
            // arrays — has_audio flag can be stale. "有一个就算有" (one = covered).
            $hasAudioFilesCol = Schema::connection($connName)->hasColumn($dictTable, 'audio_files');
            $hasTtsFilesCol   = Schema::connection($connName)->hasColumn($dictTable, 'tts_files');
            $dbDriver = DB::connection($connName)->getDriverName();
            // Independent guards (NOT elseif): when both columns exist a row must be
            // excluded if EITHER array is non-empty. The old elseif checked only
            // audio_files, so a legacy row with tts_files populated but audio_files
            // still empty (promotion is read-time only) was re-served every batch.
            if ($hasAudioFilesCol) {
                if ($dbDriver === 'pgsql') {
                    $query->whereRaw("(audio_files IS NULL OR audio_files::jsonb = '[]'::jsonb)");
                } else {
                    $query->whereRaw("(audio_files IS NULL OR json_array_length(audio_files) = 0)");
                }
            }
            if ($hasTtsFilesCol) {
                if ($dbDriver === 'pgsql') {
                    $query->whereRaw("(tts_files IS NULL OR tts_files::jsonb = '[]'::jsonb)");
                } else {
                    $query->whereRaw("(tts_files IS NULL OR json_array_length(tts_files) = 0)");
                }
            }
            // Word rows only: sentences are also stored in tts_cache_{lang} (long
            // content); restrict to short content so the batch targets words.
            if ($hasContent) {
                $query->whereRaw('LENGTH(content) <= 50');
            }
            // Full model instances (need id + tts_* columns) so stale rows whose
            // audio file actually exists on disk can be self-healed and excluded.
            $rows = $query->orderBy('id')->limit($limit)->get();
            // The DB flags (has_audio / audio_files / tts_files) can lag the real
            // file on disk (crash between file write and DB save, or legacy import).
            // Reconcile every candidate against the authoritative file: rows with a
            // real file are marked completed and dropped so the batch ONLY returns
            // words that TRULY have no audio (no more "already exists" re-serving).
            if ($hasContent) {
                $rows = (new AppQyV1DictionaryTTSCoordinator())
                    ->filterTrulyMissingWords($langCode, $rows);
            }
            foreach ($rows as $row) {
                $words[] = [
                    'word' => $hasContent ? (string) $row->content : '',
                    'md5' => (string) $row->md5,
                    'language' => $langCode,
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('[WordMedia] missingBatch failed: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Internal error: ' . $e->getMessage(),
                'language' => $langCode,
                'words' => [],
            ], 200);
        }

        return response()->json([
            'success' => true,
            'language' => $langCode,
            'count' => count($words),
            'words' => $words,
        ]);
    }
}
