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

use Illuminate\Routing\Controller as BaseController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools\AppQyV1TranslationQueueController;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService;
use App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public\AppQyV1PersonalDictionaryQueryBasePublicController as PDQBasePublic;
use App\Apps\AppQyV1\Utils\Dict\AppQyV1DictWrap as DictWrap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
class AppQyV1WordQueryController extends BaseController
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     *
     * Dictionary reads go through AppQyV1LangDictionaryModel, which resolves
     * the canonical table app_qy_v1_tts_cache_{lang} via AppQyV1TableMaps -
     * the same table the dictionary importer populates. Real columns are
     * snake_case: content, translations, us_phonetic, uk_phonetic, tts_files,
     * image_files, query_count, is_exist_local, updated_at.
     */

    protected $storageManager;
    protected $markerManager;

    public function __construct()
    {
        $this->storageManager = new AppQyV1ExternalStorageManager();
        $this->markerManager = new AppQyV1InitializationMarkerManager();
    }

    /**
     * Normalize a translations value (json column) into a display string.
     */
    private function normalizeTranslation($value): string
    {
        if (is_string($value)) {
            return $value;
        }

        if ($value === null) {
            return '';
        }

        if (is_array($value)) {
            $parts = [];
            foreach ($value as $item) {
                if (is_array($item)) {
                    // Recurse to handle arbitrarily-nested JSON. PostgreSQL decodes
                    // the `translations` jsonb column into deeply nested arrays
                    // (the legacy SQLite value was often a flat string), so the old
                    // two-level implode() threw "Array to string conversion" on the
                    // third level. Recursion makes it depth-agnostic.
                    $nested = $this->normalizeTranslation($item);
                } else {
                    $nested = (string) $item;
                }
                if ($nested !== '') {
                    $parts[] = $nested;
                }
            }
            return implode('; ', $parts);
        }

        return (string) $value;
    }

    /**
     * Query-path priority bump. When the user actively queries a word that has no
     * translation for their target/native language, elevate that word in the
     * word_translation queue so it is translated first. Cheap + non-blocking;
     * dedup is handled inside the queue controller. Skips when no target_language
     * is supplied or it equals the source language.
     *
     * @param AppQyV1LangDictionaryModel|null $dictionary Resolved row (may be null)
     * @param string $word Queried word
     * @param string $langCode Source language code/name
     * @param string|null $targetLanguage Target/native language (code or name)
     */
    private function bumpUntranslatedQuery($dictionary, string $word, string $langCode, ?string $targetLanguage): void
    {
        if ($targetLanguage === null || trim($targetLanguage) === '') {
            return;
        }

        $sourceCode = AppQyV1DictionaryService::getLanguageCode($langCode);
        $targetCode = AppQyV1DictionaryService::getLanguageCode($targetLanguage);
        if ($sourceCode === $targetCode) {
            return;
        }

        // Already translated for this target -> nothing to enqueue.
        if ($dictionary !== null) {
            $translations = $dictionary->translations;
            if (is_array($translations) && isset($translations[$targetCode]) && $translations[$targetCode] !== '') {
                return;
            }
        }

        app(AppQyV1TranslationQueueController::class)->bumpQueriedWord($word, $langCode, $targetLanguage);
    }

    /**
     * Check if a word exists in the dictionary
     * Reference: DevOps http_controller/word_query.js
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function wordExists(Request $request)
    {
        // Check initialization first
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required. Please run /initialize endpoint first.',
                'initialization_status' => $this->markerManager->getAllMarkersStatus()
            ], 503);
        }

        $word = $request->input('word');
        $langCode = $request->input('language', 'en');
        $targetLanguage = $request->input('target_language');

        if (!$word) {
            return response()->json([
                'exists' => false,
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

        // Active single-word query: elevate it in the translation queue if it has
        // no translation for the user's target language (non-blocking, deduped).
        $this->bumpUntranslatedQuery($dictionary, $word, $langCode, $targetLanguage);

        if ($dictionary) {
            // Update the query count
            $dictionary->incrementQueryCount();

            // Convert the dictionary to an array (JSON fields are cast already)
            $dictionaryData = $dictionary->toArray();

            // Remove ID field
            unset($dictionaryData['id']);

            // Ensure translations is decoded if a raw string slipped through
            if (isset($dictionaryData['translations']) && is_string($dictionaryData['translations'])) {
                $dictionaryData['translations'] = json_decode($dictionaryData['translations'], true);
            }

            return response()->json([
                'exists' => true,
                'word' => $word,
                'data' => $dictionaryData
            ]);
        }

        return response()->json([
            'exists' => false,
            'word' => $word
        ]);
    }

    /**
     * Enhanced word query with audio and image files
     * Reference: DevOps http_controller/word_query.js, basetool/voice_tool/search_voice.js
     *
     * @param Request|string $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function queryWordEnhanced($request)
    {
        // Check initialization first
        if (!$this->markerManager->isInitializationComplete()) {
            return response()->json([
                'status' => 'initialization_required',
                'message' => 'System initialization required. Please run /initialize endpoint first.',
                'initialization_status' => $this->markerManager->getAllMarkersStatus()
            ], 503);
        }

        $targetLanguage = null;
        if (is_string($request)) {
            $word = $request;
            $langCode = 'en';
        } else {
            $word = $request->input('word');
            $langCode = $request->input('language', 'en');
            $targetLanguage = $request->input('target_language');
        }

        if (!$word) {
            return response()->json([
                'status' => 'error',
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

        // Active single-word query: elevate it in the translation queue if it has
        // no translation for the user's target language (non-blocking, deduped).
        $this->bumpUntranslatedQuery($dictionary, $word, $langCode, $targetLanguage);

        if (!$dictionary) {
            return response()->json([
                'status' => 'not_found',
                'word' => $word,
                'message' => 'Word not found in dictionary'
            ]);
        }

        // Update query count
        $dictionary->incrementQueryCount();

        // Get dictionary data (JSON fields are cast already)
        $dictionaryData = $dictionary->toArray();
        unset($dictionaryData['id']);

        // Decode JSON fields if a raw string slipped through
        if (isset($dictionaryData['translations']) && is_string($dictionaryData['translations'])) {
            $dictionaryData['translations'] = json_decode($dictionaryData['translations'], true);
        }
        if (isset($dictionaryData['tts_files']) && is_string($dictionaryData['tts_files'])) {
            $dictionaryData['tts_files'] = json_decode($dictionaryData['tts_files'], true);
        }
        if (isset($dictionaryData['image_files']) && is_string($dictionaryData['image_files'])) {
            $dictionaryData['image_files'] = json_decode($dictionaryData['image_files'], true);
        }

        // Find audio files from external storage
        // Reference: DevOps basetool/voice_tool/search_voice.js
        $audioFile = $this->storageManager->findAudioFile($word);
        $audioUrls = [];
        if ($audioFile) {
            $audioUrls['word'] = $this->storageManager->getFileUrl($audioFile);
        }

        // Find image files from external storage
        $imageFiles = $this->storageManager->findImageFiles($word);
        $imageUrls = [];
        foreach ($imageFiles as $imageFile) {
            $imageUrls[] = $this->storageManager->getFileUrl($imageFile);
        }

        $usPhonetic = '';
        if (isset($dictionaryData['us_phonetic'])) {
            $usPhonetic = $dictionaryData['us_phonetic'];
        }
        $ukPhonetic = '';
        if (isset($dictionaryData['uk_phonetic'])) {
            $ukPhonetic = $dictionaryData['uk_phonetic'];
        }
        $translationValue = null;
        if (isset($dictionaryData['translations'])) {
            $translationValue = $dictionaryData['translations'];
        }
        $lastUpdated = null;
        if (isset($dictionaryData['updated_at'])) {
            $lastUpdated = $dictionaryData['updated_at'];
        }
        $queryCount = 0;
        if (isset($dictionaryData['query_count'])) {
            $queryCount = $dictionaryData['query_count'];
        }
        $hasLocalFiles = false;
        if (isset($dictionaryData['is_exist_local'])) {
            $hasLocalFiles = $dictionaryData['is_exist_local'];
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'word' => $word,
                'translation' => $translationValue,
                'phonetic' => [
                    'us' => $usPhonetic,
                    'uk' => $ukPhonetic
                ],
                'audio' => $audioUrls,
                'images' => $imageUrls,
                'metadata' => [
                    'last_updated' => $lastUpdated,
                    'query_count' => $queryCount,
                    'source' => 'database',
                    'has_local_files' => $hasLocalFiles
                ],
                'raw_data' => $dictionaryData
            ]
        ]);
    }
    /**
     * Check if a word exists by URL path parameter
     *
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function checkWord(Request | string $request )
    {
        $targetLanguage = null;
        if(is_string($request)){
            $word = $request;
            $langCode = 'en';
        }else{
            $word = $request->input('word');
            $langCode = $request->input('language', 'en');
            $targetLanguage = $request->input('target_language');
        }

        if (!$word) {
            return response()->json([
                'exists' => false,
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

        // Active single-word query: elevate it in the translation queue if it has
        // no translation for the user's target language (non-blocking, deduped).
        $this->bumpUntranslatedQuery($dictionary, $word, $langCode, $targetLanguage);

        if ($dictionary) {
            // Update the query count
            $dictionary->incrementQueryCount();

            // Convert the dictionary to an array (JSON fields are cast already)
            $dictionaryData = $dictionary->toArray();

            // Remove ID field
            unset($dictionaryData['id']);

            // Ensure translations is decoded if a raw string slipped through
            if (isset($dictionaryData['translations']) && is_string($dictionaryData['translations'])) {
                $dictionaryData['translations'] = json_decode($dictionaryData['translations'], true);
            }

            return response()->json([
                'exists' => true,
                'word' => $word,
                'data' => $dictionaryData
            ]);
        }

        return response()->json([
            'exists' => false,
            'word' => $word
        ]);
    }

    /**
     * Batch check multiple words
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function batchWordExists(Request $request)
    {
        $words = $request->input('words', []);
        $langCode = $request->input('language', 'en');

        if (empty($words)) {
            return response()->json([
                'message' => 'No words provided',
                'results' => []
            ]);
        }

        $results = [];

        foreach ($words as $word) {
            $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

            if ($dictionary) {
                // Update query count
                $dictionary->incrementQueryCount();

                // Get dictionary data (JSON fields are cast already)
                $dictionaryData = $dictionary->toArray();

                // Remove ID field
                unset($dictionaryData['id']);

                // Ensure translations is decoded if a raw string slipped through
                if (isset($dictionaryData['translations']) && is_string($dictionaryData['translations'])) {
                    $dictionaryData['translations'] = json_decode($dictionaryData['translations'], true);
                }

                $results[] = [
                    'word' => $word,
                    'exists' => true,
                    'data' => $dictionaryData
                ];
            } else {
                $results[] = [
                    'word' => $word,
                    'exists' => false
                ];
            }
        }

        return response()->json([
            'results' => $results
        ]);
    }

    /**
     * Get daily words for learning
     *
     * Response contract is aligned with the qy_capacitor frontend
     * (ApiCenter.words.getDailyWords): `data` is a flat array of items, each
     * exposing { id, word, translation, phonetic }. The query parameter is
     * `count` (frontend sends ?count=N); `limit` is kept as a fallback.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getDailyWords(Request $request)
    {
        if (!$this->markerManager->isInitialized()) {
            return $this->error('System not initialized. Please initialize first.');
        }

        $langCode = $request->input('language', 'en');
        $limit = $request->input('count', $request->input('limit', 10));
        $limit = (int) $limit;
        if ($limit < 1) {
            $limit = 10;
        }

        // Random-window strategy (not scattered): ORDER BY RANDOM() scans+sorts
        // the whole (up to ~100k-row) dictionary table on every poll. Instead we
        // pick a random start id on the PK and read a contiguous window forward.
        // This rides the PK index and is cheap. A contiguous "random window" is an
        // acceptable approximation for daily/random words. Column list and the
        // response mapping below are unchanged.
        $selectColumns = ['id', 'content', 'translations', 'us_phonetic', 'uk_phonetic'];

        $maxId = (int) AppQyV1LangDictionaryModel::forLanguage($langCode)->max('id');
        $minId = (int) AppQyV1LangDictionaryModel::forLanguage($langCode)->min('id');

        $rows = collect();
        if ($maxId > 0) {
            // Clamp the random start so a full window of $limit rows can still
            // exist near the end (assuming dense ids); on sparse/gappy ids the
            // top-up below restores the count.
            $startUpperBound = $maxId - $limit + 1;
            if ($startUpperBound < $minId) {
                $startUpperBound = $minId;
            }

            $start = random_int($minId, $startUpperBound);

            $rows = AppQyV1LangDictionaryModel::forLanguage($langCode)
                ->where('id', '>=', $start)
                ->orderBy('id')
                ->limit($limit)
                ->get($selectColumns);

            // Sparse ids / gaps can yield fewer than $limit rows; wrap around and
            // top up from the start so we always return up to $limit rows.
            $deficit = $limit - $rows->count();
            if ($deficit > 0) {
                $topUp = AppQyV1LangDictionaryModel::forLanguage($langCode)
                    ->where('id', '<', $start)
                    ->orderBy('id')
                    ->limit($deficit)
                    ->get($selectColumns);
                $rows = $rows->concat($topUp);
            }
        }

        $words = [];
        foreach ($rows as $row) {
            $phoneticValue = $row->us_phonetic;
            if (!$phoneticValue) {
                $phoneticValue = $row->uk_phonetic;
            }
            if ($phoneticValue === null) {
                $phoneticValue = '';
            }

            $words[] = [
                'id' => $row->id,
                'word' => $row->content,
                'translation' => $this->normalizeTranslation($row->translations),
                'phonetic' => $phoneticValue,
            ];
        }

        return $this->success($words, 'Daily words retrieved successfully');
    }

    /**
     * Get the full details of a single word by its dictionary id.
     *
     * Response data matches the qy_capacitor frontend Word shape
     * (types.ts): { id, text, phonetic, translation, definition,
     * example, masteryLevel, tags, audioUrl }.
     *
     * @param Request $request
     * @param string $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getWordDetails(Request $request, $id)
    {
        $language = $request->input('language', 'en');

        $row = AppQyV1LangDictionaryModel::forLanguage($language)->find($id);

        if ($row === null) {
            return $this->notFound('Word not found');
        }

        $row->incrementQueryCount();

        $phoneticValue = $row->us_phonetic;
        if (!$phoneticValue) {
            $phoneticValue = $row->uk_phonetic;
        }
        if ($phoneticValue === null) {
            $phoneticValue = '';
        }

        $definition = '';
        $example = '';
        $details = $row->word_details;
        if (is_array($details)) {
            if (isset($details['definition'])) {
                $definition = $details['definition'];
            }
            if (isset($details['example'])) {
                $example = $details['example'];
            }
        }

        $audioUrl = null;
        $audioFile = $this->storageManager->findAudioFile($row->content);
        if ($audioFile) {
            $audioUrl = $this->storageManager->getFileUrl($audioFile);
        }

        $word = [
            'id' => (string) $row->id,
            'text' => $row->content,
            'phonetic' => $phoneticValue,
            'translation' => $this->normalizeTranslation($row->translations),
            'definition' => $definition,
            'example' => $example,
            'masteryLevel' => 0,
            'tags' => [],
            'audioUrl' => $audioUrl,
        ];

        return $this->success($word, 'Word details retrieved successfully');
    }

    /**
     * Search words by a content prefix.
     *
     * Each result matches the qy_capacitor frontend Word shape (types.ts).
     * List results do not resolve audioUrl per row for performance.
     *
     * @param Request $request
     * @param string $query
     * @return \Illuminate\Http\JsonResponse
     */
    public function searchWords(Request $request, $query)
    {
        $language = $request->input('language', 'en');

        // Case-insensitive prefix match on BOTH drivers: plain LIKE is
        // case-insensitive on sqlite but case-SENSITIVE on pgsql.
        $rows = AppQyV1LangDictionaryModel::forLanguage($language)
            ->whereRaw('LOWER(content) LIKE ?', [strtolower($query) . '%'])
            ->limit(20)
            ->get();

        $words = [];
        foreach ($rows as $row) {
            $phoneticValue = $row->us_phonetic;
            if (!$phoneticValue) {
                $phoneticValue = $row->uk_phonetic;
            }
            if ($phoneticValue === null) {
                $phoneticValue = '';
            }

            $definition = '';
            $example = '';
            $details = $row->word_details;
            if (is_array($details)) {
                if (isset($details['definition'])) {
                    $definition = $details['definition'];
                }
                if (isset($details['example'])) {
                    $example = $details['example'];
                }
            }

            $words[] = [
                'id' => (string) $row->id,
                'text' => $row->content,
                'phonetic' => $phoneticValue,
                'translation' => $this->normalizeTranslation($row->translations),
                'definition' => $definition,
                'example' => $example,
                'masteryLevel' => 0,
                'tags' => [],
                'audioUrl' => null,
            ];
        }

        return $this->success($words, 'Search results retrieved successfully');
    }

    /**
     * Toggle the favorite flag of a word for the authenticated user.
     *
     * Route: POST /api/app_qy_v1/words/{id}/favorite
     *
     * Storage: the per-user personal dictionary (personal_dicts JSON blob,
     * keyed by word text) already carries per-word learning state
     * (read/learned/reviewed/...). The favorite flag is stored there as an
     * additional integer field 'favorite' (0/1) on the word item - no new
     * column or migration is required and the storage is driver-agnostic
     * (works identically on SQLite and PostgreSQL).
     *
     * @param Request $request
     * @param string $id Dictionary word id
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleFavorite(Request $request, $id)
    {
        $language = $request->input('language', 'en');

        $row = AppQyV1LangDictionaryModel::forLanguage($language)->find($id);
        if ($row === null) {
            return $this->notFound('Word not found');
        }

        $wordText = $row->content;

        $queryResult = PDQBasePublic::queryPersonalDictionary(false, true);
        $personDictModel = $queryResult['model'];
        $personDict = $queryResult['query_result']['data'];
        $dictionariesLength = $queryResult['query_result']['dictionaries_lenght'];

        if (!isset($personDict[$wordText])) {
            $personDict[$wordText] = DictWrap::wrapDictToItem($wordText, $dictionariesLength + 1);
        }

        $currentFavorite = false;
        if (isset($personDict[$wordText]['favorite'])) {
            $currentFavorite = (bool) $personDict[$wordText]['favorite'];
        }

        $newFavorite = !$currentFavorite;
        if ($newFavorite) {
            $personDict[$wordText]['favorite'] = 1;
        } else {
            $personDict[$wordText]['favorite'] = 0;
        }

        $personDictModel->personal_dicts = json_encode($personDict);
        $personDictModel->save();

        return $this->success(
            [
                'id' => (string) $row->id,
                'word' => $wordText,
                'is_favorite' => $newFavorite,
            ],
            'Word favorite status updated successfully'
        );
    }

    /**
     * Public word lookup by content (no auth).
     *
     * A missing word is a normal public result returned with HTTP 200,
     * not an error response.
     *
     * @param Request $request
     * @param string $word
     * @return \Illuminate\Http\JsonResponse
     */
    public function publicWordLookup(Request $request, $word)
    {
        $language = $request->input('language', 'en');

        $row = AppQyV1LangDictionaryModel::findByContent($language, $word);

        if ($row === null) {
            return $this->success(['word' => $word, 'found' => false], 'Word not found');
        }

        $row->incrementQueryCount();

        $phoneticValue = $row->us_phonetic;
        if (!$phoneticValue) {
            $phoneticValue = $row->uk_phonetic;
        }
        if ($phoneticValue === null) {
            $phoneticValue = '';
        }

        $definition = '';
        $example = '';
        $details = $row->word_details;
        if (is_array($details)) {
            if (isset($details['definition'])) {
                $definition = $details['definition'];
            }
            if (isset($details['example'])) {
                $example = $details['example'];
            }
        }

        $audioUrl = null;
        $audioFile = $this->storageManager->findAudioFile($row->content);
        if ($audioFile) {
            $audioUrl = $this->storageManager->getFileUrl($audioFile);
        }

        $wordArray = [
            'id' => (string) $row->id,
            'text' => $row->content,
            'phonetic' => $phoneticValue,
            'translation' => $this->normalizeTranslation($row->translations),
            'definition' => $definition,
            'example' => $example,
            'masteryLevel' => 0,
            'tags' => [],
            'audioUrl' => $audioUrl,
        ];

        return $this->success(['word' => $word, 'found' => true, 'data' => $wordArray], 'Word found');
    }
}
