<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1WordQurey;

use Illuminate\Routing\Controller as BaseController;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1ExternalStorageManager;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;
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

        if (is_array($value)) {
            $parts = [];
            foreach ($value as $item) {
                if (is_array($item)) {
                    $parts[] = implode(' ', $item);
                } else {
                    $parts[] = (string) $item;
                }
            }
            return implode('; ', $parts);
        }

        if ($value === null) {
            return '';
        }

        return (string) $value;
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

        if (!$word) {
            return response()->json([
                'exists' => false,
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

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

        if (is_string($request)) {
            $word = $request;
            $langCode = 'en';
        } else {
            $word = $request->input('word');
            $langCode = $request->input('language', 'en');
        }

        if (!$word) {
            return response()->json([
                'status' => 'error',
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

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
        if(is_string($request)){
            $word = $request;
            $langCode = 'en';
        }else{
            $word = $request->input('word');
            $langCode = $request->input('language', 'en');
        }

        if (!$word) {
            return response()->json([
                'exists' => false,
                'message' => 'No word provided'
            ]);
        }

        $dictionary = AppQyV1LangDictionaryModel::findByContent($langCode, $word);

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

        $rows = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->inRandomOrder()
            ->limit($limit)
            ->get(['id', 'content', 'translations', 'us_phonetic', 'uk_phonetic']);

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

        $rows = AppQyV1LangDictionaryModel::forLanguage($language)
            ->where('content', 'like', $query . '%')
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
