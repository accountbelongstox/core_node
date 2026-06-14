<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Http\Controllers\Controller;
use App\Providers\PathMapper;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AppQyV1VocabularyLibraryPublicController extends Controller
{
    use ApiResponse;

    /**
     * NO try-catch allowed - trust Laravel validation
     * NO ?? or || allowed - use explicit if statements
     */

    private AppQyV1VocabularyCoverService $coverService;

    public function __construct(AppQyV1VocabularyCoverService $coverService)
    {
        $this->coverService = $coverService;
    }

    public function getRecommended(Request $request): JsonResponse
    {
        $language = $request->query('language', 'english');
        $limit = (int) $request->query('limit', 10);
        $limit = max(1, min($limit, 50));

        $libraries = AppQyV1VocabularyLibraryModel::query()
            ->public()
            ->forLanguage($language)
            ->where('is_recommended', true)
            ->orderByDesc('total_words')
            ->limit($limit)
            ->get()
            ->map(fn ($library) => $this->transformLibrary($library))
            ->values();

        return $this->success([
            'libraries' => $libraries,
        ]);
    }

    public function getStatistics(Request $request): JsonResponse
    {
        $language = $request->query('language');
        $includeWordsParam = $request->query('include_words');
        $includeWords = false;
        if ($includeWordsParam === '1' || $includeWordsParam === 'true' || $includeWordsParam === 1 || $includeWordsParam === true) {
            $includeWords = true;
        }

        $baseQuery = AppQyV1VocabularyLibraryModel::query()->public();
        if ($language !== null && $language !== '') {
            $baseQuery->forLanguage($language);
        }

        // Single grouped aggregate over the (filtered) library table. The
        // top-level totals (libraries, words, distinct languages) are all derived
        // from these rows, replacing three additional COUNT/SUM/DISTINCT scans.
        $languageRows = (clone $baseQuery)
            ->selectRaw('language, SUM(total_words) as total_words, COUNT(*) as libraries_count')
            ->groupBy('language')
            ->orderBy('language')
            ->get();

        $totalLibraries = 0;
        $totalWords = 0;
        $totalLanguages = 0;
        foreach ($languageRows as $aggRow) {
            $totalLibraries += (int) $aggRow->libraries_count;
            $totalWords += (int) $aggRow->total_words;
            // Mirror COUNT(DISTINCT language): NULL languages are not counted.
            if ($aggRow->language !== null) {
                $totalLanguages++;
            }
        }

        $languages = [];
        $summaryDictWords = 0;
        $summaryWithTranslation = 0;
        $summaryWithoutTranslation = 0;
        $summaryValid = 0;
        $summaryInvalid = 0;
        $summaryChecked = 0;
        $summaryAudio = 0;
        $summaryImages = 0;

        foreach ($languageRows as $row) {
            $languageName = 'unknown';
            if ($row->language !== null && $row->language !== '') {
                $languageName = $row->language;
            }

            // Translation / validity / coverage all live on the canonical
            // dictionary table tts_cache_{lang}, not on the library tables.
            $metrics = $this->buildDictionaryMetrics($languageName);

            $languages[] = [
                'language' => $languageName,
                'language_code' => $metrics['language_code'],
                'total_words' => (int) $row->total_words,
                'libraries_count' => (int) $row->libraries_count,
                'dictionary_words' => $metrics['dictionary_words'],
                'with_translation' => $metrics['with_translation'],
                'without_translation' => $metrics['without_translation'],
                'valid_words' => $metrics['valid_words'],
                'invalid_words' => $metrics['invalid_words'],
                'validity_checked' => $metrics['validity_checked'],
                'validity_unchecked' => $metrics['validity_unchecked'],
                'tts_percentage' => $metrics['tts_percentage'],
                'images_percentage' => $metrics['images_percentage'],
                'review_percentage' => $metrics['review_percentage'],
            ];

            $summaryDictWords += $metrics['dictionary_words'];
            $summaryWithTranslation += $metrics['with_translation'];
            $summaryWithoutTranslation += $metrics['without_translation'];
            $summaryValid += $metrics['valid_words'];
            $summaryInvalid += $metrics['invalid_words'];
            $summaryChecked += $metrics['validity_checked'];
            $summaryAudio += $metrics['with_audio'];
            $summaryImages += $metrics['with_images'];
        }

        $summaryTtsPercentage = 0;
        if ($summaryDictWords > 0) {
            $summaryTtsPercentage = round(($summaryAudio / $summaryDictWords) * 100, 2);
        }

        $summary = [
            'total_languages' => $totalLanguages,
            'total_libraries' => (int) $totalLibraries,
            'total_words' => (int) $totalWords,
            'total_dictionary_words' => $summaryDictWords,
            'total_with_translation' => $summaryWithTranslation,
            'total_without_translation' => $summaryWithoutTranslation,
            'total_valid_words' => $summaryValid,
            'total_invalid_words' => $summaryInvalid,
            'total_validity_checked' => $summaryChecked,
            'tts_percentage' => $summaryTtsPercentage,
        ];

        $response = [
            'summary' => $summary,
            'languages' => $languages,
        ];

        if ($includeWords) {
            $languageForWords = $language;
            if ($languageForWords === null || $languageForWords === '') {
                $languageForWords = 'english';
            }

            $page = (int) $request->query('page', 1);
            if ($page < 1) {
                $page = 1;
            }
            $perPage = (int) $request->query('per_page', 100);
            if ($perPage < 1) {
                $perPage = 1;
            }
            if ($perPage > 1000) {
                $perPage = 1000;
            }

            $wordsResult = $this->buildWordsForLanguage($languageForWords, $page, $perPage);
            $response['words'] = $wordsResult['words'];
            $response['words_pagination'] = $wordsResult['pagination'];
        }

        return $this->success($response);
    }

    public function getLibraries(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min((int) $request->query('per_page', 20), 100));

        $query = AppQyV1VocabularyLibraryModel::query()
            ->public()
            ->forLanguage($request->query('language'));

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        if ($difficulty = $request->query('difficulty')) {
            $query->where('difficulty_level', $difficulty);
        }

        if ($search = $request->query('search')) {
            // Case-insensitive on BOTH drivers: plain LIKE is case-insensitive
            // on sqlite but case-SENSITIVE on pgsql.
            $searchNeedle = '%' . strtolower($search) . '%';
            $query->where(function ($q) use ($searchNeedle) {
                $q->whereRaw('LOWER(name) LIKE ?', [$searchNeedle])
                    ->orWhereRaw('LOWER(description) LIKE ?', [$searchNeedle]);
            });
        }

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));

        $libraries = $query
            ->orderByDesc('is_recommended')
            ->orderBy('difficulty_level')
            ->orderByDesc('total_words')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn ($library) => $this->transformLibrary($library))
            ->values();

        return $this->success([
            'libraries' => $libraries,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_more' => $page < $lastPage,
            ],
        ]);
    }

    public function getLibraryWords(Request $request, int $libraryId): JsonResponse
    {
        $library = AppQyV1VocabularyLibraryModel::query()
            ->public()
            ->findOrFail($libraryId);

        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min((int) $request->query('per_page', 1000), 2000));
        $offset = ($page - 1) * $perPage;

        // Membership lives in vocabulary_libraries.word_ids (ordered
        // dictionary ids): pagination slices the array, one whereIn fetches
        // the page's dictionary rows in slice order.
        $total = count($library->getWordIdsArray());
        $dictRows = $library->dictionaryWords($offset, $perPage);

        $position = 0;
        $words = $dictRows
            ->map(function (AppQyV1LangDictionaryModel $row) use ($offset, &$position) {
                $entry = array_merge(
                    [
                        'index' => $offset + $position,
                        'word' => $row->content,
                    ],
                    self::buildWordEntryFromDictionaryRow($row)
                );
                $position++;
                return $entry;
            })
            ->values();

        $lastPage = max(1, (int) ceil($total / $perPage));

        return $this->success([
            'library' => [
                'id' => (int) $library->id,
                'name' => $library->name,
                'total_words' => (int) $library->total_words,
                'language' => $library->language,
            ],
            'words' => $words,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_more' => $page < $lastPage,
            ],
        ]);
    }

    private function buildWordsForLanguage(string $language, int $page, int $perPage): array
    {
        if ($language === null || $language === '') {
            $language = 'english';
        }

        if ($page < 1) {
            $page = 1;
        }
        if ($perPage < 1) {
            $perPage = 1;
        }
        if ($perPage > 1000) {
            $perPage = 1000;
        }
        $offset = ($page - 1) * $perPage;

        $languageCode = self::getLanguageCode($language);
        $dictModel = AppQyV1LangDictionaryModel::forLanguage($languageCode);
        $hasDictionaryTable = Schema::connection($dictModel->getConnectionName())->hasTable($dictModel->getTable());

        // Membership lives in vocabulary_libraries.word_ids: build the
        // (library, word_id, in-library index) pair list for every public
        // library of the language, order by word text (the previous SQL
        // ORDER BY w.word), then resolve full dictionary rows for the page.
        $libraries = new \Illuminate\Support\Collection();
        if ($hasDictionaryTable) {
            $libraries = AppQyV1VocabularyLibraryModel::query()
                ->public()
                ->forLanguage($language)
                ->orderBy('id')
                ->get(['id', 'name', 'language', 'word_ids']);
        }

        $pairs = [];
        $allIds = [];
        foreach ($libraries as $library) {
            $index = 0;
            foreach ($library->getWordIdsArray() as $wordId) {
                $pairs[] = [$library, $wordId, $index];
                $allIds[$wordId] = true;
                $index++;
            }
        }

        $total = count($pairs);

        // Chunked id -> content lookups (light columns only) for the sort key.
        $contentById = [];
        foreach (array_chunk(array_keys($allIds), 1000) as $chunk) {
            $rows = AppQyV1LangDictionaryModel::forLanguage($languageCode)
                ->whereIn('id', $chunk)
                ->get(['id', 'content']);
            foreach ($rows as $row) {
                $contentById[(int) $row->id] = (string) $row->content;
            }
        }

        usort($pairs, function (array $a, array $b) use ($contentById) {
            $wordA = '';
            if (isset($contentById[$a[1]])) {
                $wordA = $contentById[$a[1]];
            }
            $wordB = '';
            if (isset($contentById[$b[1]])) {
                $wordB = $contentById[$b[1]];
            }
            if ($wordA !== $wordB) {
                return strcmp($wordA, $wordB);
            }
            if ($a[0]->id !== $b[0]->id) {
                return $a[0]->id <=> $b[0]->id;
            }
            return $a[2] <=> $b[2];
        });

        $pageSlice = array_slice($pairs, $offset, $perPage);

        $pageIds = [];
        foreach ($pageSlice as [$library, $wordId, $index]) {
            $pageIds[$wordId] = true;
        }

        $rowsById = [];
        if (!empty($pageIds)) {
            $rows = AppQyV1LangDictionaryModel::forLanguage($languageCode)
                ->whereIn('id', array_keys($pageIds))
                ->get();
            foreach ($rows as $row) {
                $rowsById[(int) $row->id] = $row;
            }
        }

        $words = [];
        foreach ($pageSlice as [$library, $wordId, $index]) {
            if (!isset($rowsById[$wordId])) {
                continue;
            }
            $row = $rowsById[$wordId];

            $words[] = array_merge(
                [
                    // Dictionary id: the unified word id space after the
                    // Wave A/B consolidation (was the vocabulary_words row id).
                    'id' => (int) $wordId,
                    'library_id' => (int) $library->id,
                    'library_name' => $library->name,
                    'language' => $library->language,
                    'index' => (int) $index,
                    'word' => $row->content,
                ],
                self::buildWordEntryFromDictionaryRow($row)
            );
        }

        $lastPage = 1;
        if ($perPage > 0) {
            $lastPage = (int) ceil($total / $perPage);
        }
        if ($lastPage < 1) {
            $lastPage = 1;
        }

        return [
            'language' => $language,
            'words' => $words,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_more' => $page < $lastPage,
            ],
        ];
    }

    /**
     * Shared word-entry tail built straight from a dictionary row:
     * translations / phonetics / word_details / audio. word_details carries
     * image_files (the previous SQL selected `d.image_files as word_details`),
     * and the audio check uses the row's own tts_files (no extra md5 lookup).
     */
    private static function buildWordEntryFromDictionaryRow(AppQyV1LangDictionaryModel $row): array
    {
        $translations = self::simpleTranslationsFromDecoded($row->translations);
        $hasTranslation = $translations !== null;

        $wordDetails = null;
        if (is_array($row->image_files)) {
            $wordDetails = $row->image_files;
        }

        $audioUrl = null;
        $audioAvailable = false;
        if (!empty($row->tts_files)) {
            $audioBasePath = PathMapper::getLaravelDataDir() . '/tts_data/audio/';
            foreach ($row->tts_files as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    $fullPath = $audioBasePath . $ttsFile['path'];
                    if (file_exists($fullPath)) {
                        $audioUrl = AppQyV1TtsUrl::forPath($ttsFile['path']);
                        $audioAvailable = true;
                        break;
                    }
                }
            }
        }

        return [
            'translations' => $translations,
            'us_phonetic' => $row->us_phonetic,
            'uk_phonetic' => $row->uk_phonetic,
            'word_details' => $wordDetails,
            'has_translation' => $hasTranslation,
            'audio_url' => $audioUrl,
            'audio_available' => $audioAvailable,
        ];
    }

    /**
     * Per-language dictionary metrics sourced from tts_cache_{lang}: word count,
     * translation coverage, and explicit-validity counts. A single aggregate
     * query keeps this cheap even at ~100k+ rows per language. Returns zeroed
     * metrics when the language has no dictionary table yet.
     *
     * Validity is externally asserted: invalid_words counts only rows explicitly
     * flagged is_valid = 0; everything else (including never-checked rows) is valid.
     */
    private function buildDictionaryMetrics(string $languageName): array
    {
        $languageCode = self::getLanguageCode($languageName);

        // A library group with no/blank language is relabeled 'unknown' by the
        // caller; getLanguageCode() would map that to 'en' and DOUBLE-COUNT the EN
        // dictionary into the summary. Such pseudo-languages own no dictionary of
        // their own -> return zeroed metrics (and don't cache under the EN key).
        if (trim($languageName) === '' || strtolower($languageName) === 'unknown') {
            return [
                'language_code' => $languageCode,
                'dictionary_words' => 0,
                'with_translation' => 0,
                'without_translation' => 0,
                'valid_words' => 0,
                'invalid_words' => 0,
                'validity_checked' => 0,
                'validity_unchecked' => 0,
                'with_audio' => 0,
                'with_images' => 0,
                'tts_percentage' => 0,
                'images_percentage' => 0,
                'review_percentage' => 0,
            ];
        }

        // The aggregate below scans the whole tts_cache_{lang} table (197k+ rows
        // for EN) and runs on every dashboard load, once per language. Cache the
        // result for a short window; writes to the dictionary explicitly forget
        // this key (AppQyV1LangDictionaryModel::forgetMetricsCache), and the TTL
        // is a backstop for any path that bypasses explicit invalidation.
        return Cache::remember(
            AppQyV1LangDictionaryModel::metricsCacheKey($languageCode),
            AppQyV1LangDictionaryModel::METRICS_CACHE_TTL,
            fn () => $this->computeDictionaryMetrics($languageName, $languageCode)
        );
    }

    private function computeDictionaryMetrics(string $languageName, string $languageCode): array
    {
        $empty = [
            'language_code' => $languageCode,
            'dictionary_words' => 0,
            'with_translation' => 0,
            'without_translation' => 0,
            'valid_words' => 0,
            'invalid_words' => 0,
            'validity_checked' => 0,
            'validity_unchecked' => 0,
            'with_audio' => 0,
            'with_images' => 0,
            'tts_percentage' => 0,
            'images_percentage' => 0,
            'review_percentage' => 0,
        ];

        $dictModel = AppQyV1LangDictionaryModel::forLanguage($languageCode);
        $connectionName = $dictModel->getConnectionName();
        $table = $dictModel->getTable();

        if (!Schema::connection($connectionName)->hasTable($table)) {
            return $empty;
        }

        $hasValidityColumn = Schema::connection($connectionName)->hasColumn($table, 'is_valid');

        $selects = [
            'COUNT(*) as total',
            // Booleans compared with true/false (not 1/0) so the raw SQL works on
            // both pgsql (real boolean) and sqlite (true/false map to 1/0).
            "SUM(CASE WHEN has_translation = true OR (translations IS NOT NULL AND translations <> '' AND translations <> '{}' AND translations <> '[]') THEN 1 ELSE 0 END) as with_translation",
            'SUM(CASE WHEN has_audio = true THEN 1 ELSE 0 END) as with_audio',
            "SUM(CASE WHEN image_files IS NOT NULL AND image_files <> '' AND image_files <> '{}' AND image_files <> '[]' THEN 1 ELSE 0 END) as with_images",
        ];

        if ($hasValidityColumn) {
            $selects[] = 'SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as invalid_words';
            $selects[] = 'SUM(CASE WHEN validity_checked_at IS NOT NULL THEN 1 ELSE 0 END) as validity_checked';
        } else {
            $selects[] = '0 as invalid_words';
            $selects[] = '0 as validity_checked';
        }

        $row = DB::connection($connectionName)
            ->table($table)
            ->selectRaw(implode(', ', $selects))
            ->first();

        $total = (int) $row->total;
        $withTranslation = (int) $row->with_translation;
        $withAudio = (int) $row->with_audio;
        $withImages = (int) $row->with_images;
        $invalid = (int) $row->invalid_words;
        $checked = (int) $row->validity_checked;

        $withoutTranslation = $total - $withTranslation;
        if ($withoutTranslation < 0) {
            $withoutTranslation = 0;
        }

        $valid = $total - $invalid;
        if ($valid < 0) {
            $valid = 0;
        }

        $unchecked = $total - $checked;
        if ($unchecked < 0) {
            $unchecked = 0;
        }

        $ttsPercentage = 0;
        $imagesPercentage = 0;
        $reviewPercentage = 0;
        if ($total > 0) {
            $ttsPercentage = round(($withAudio / $total) * 100, 2);
            $imagesPercentage = round(($withImages / $total) * 100, 2);
            $reviewPercentage = round(($withTranslation / $total) * 100, 2);
        }

        return [
            'language_code' => $languageCode,
            'dictionary_words' => $total,
            'with_translation' => $withTranslation,
            'without_translation' => $withoutTranslation,
            'valid_words' => $valid,
            'invalid_words' => $invalid,
            'validity_checked' => $checked,
            'validity_unchecked' => $unchecked,
            'with_audio' => $withAudio,
            'with_images' => $withImages,
            'tts_percentage' => $ttsPercentage,
            'images_percentage' => $imagesPercentage,
            'review_percentage' => $reviewPercentage,
        ];
    }

    private const LANGUAGE_NAME_TO_CODE = [
        'english' => 'en',
        'chinese' => 'zh',
        'japanese' => 'ja',
        'korean' => 'ko',
        'spanish' => 'es',
        'french' => 'fr',
        'german' => 'de',
        'russian' => 'ru',
        'arabic' => 'ar',
        'portuguese' => 'pt',
        'italian' => 'it',
        'dutch' => 'nl',
        'polish' => 'pl',
        'turkish' => 'tr',
        'vietnamese' => 'vi',
        'lao' => 'lo',
        'thai' => 'th',
        'indonesian' => 'id',
        'hindi' => 'hi',
        'bengali' => 'bn',
        'urdu' => 'ur',
    ];

    /**
     * Map a language name or 2-letter code to the dictionary language code.
     * Public static so other vocabulary controllers (e.g. export) share the
     * exact same mapping the statistics endpoints use.
     */
    public static function getLanguageCode(string $language): string
    {
        $normalizedLang = strtolower($language);

        if (isset(self::LANGUAGE_NAME_TO_CODE[$normalizedLang])) {
            return self::LANGUAGE_NAME_TO_CODE[$normalizedLang];
        }

        if (strlen($normalizedLang) === 2) {
            return $normalizedLang;
        }

        return 'en';
    }

    /**
     * Map a 2-letter code or language name to the full language NAME used in
     * vocabulary_libraries.language (e.g. 'en' -> 'english'). Unknown values
     * are returned lowercased as-is.
     */
    public static function getLanguageName(string $language): string
    {
        $normalizedLang = strtolower(trim($language));

        if (isset(self::LANGUAGE_NAME_TO_CODE[$normalizedLang])) {
            return $normalizedLang;
        }

        foreach (self::LANGUAGE_NAME_TO_CODE as $name => $code) {
            if ($code === $normalizedLang) {
                return $name;
            }
        }

        return $normalizedLang;
    }

    /**
     * Decode the tts_cache_{lang} translations JSON into the simple list shown
     * by the public word endpoints. Returns null when there is no usable
     * translation (matching the previous inline behavior exactly).
     */
    public static function decodeSimpleTranslations(?string $rawTranslations): ?array
    {
        if ($rawTranslations === null || $rawTranslations === '') {
            return null;
        }

        return self::simpleTranslationsFromDecoded(json_decode($rawTranslations, true));
    }

    /**
     * Same extraction as decodeSimpleTranslations but for an ALREADY decoded
     * translations value (Eloquent casts the dictionary's translations column
     * to array). Returns null when there is no usable translation.
     */
    public static function simpleTranslationsFromDecoded($decodedTranslations): ?array
    {
        if (!is_array($decodedTranslations)) {
            return null;
        }

        $simpleTranslations = [];
        if (isset($decodedTranslations['word_translation']) && is_array($decodedTranslations['word_translation'])) {
            foreach ($decodedTranslations['word_translation'] as $trans) {
                if (is_array($trans) && count($trans) >= 2) {
                    $simpleTranslations[] = $trans[1];
                }
            }
        }

        if (empty($simpleTranslations)) {
            return null;
        }

        return $simpleTranslations;
    }

    private function transformLibrary(AppQyV1VocabularyLibraryModel $library): array
    {
        $cover = $this->coverService->getCoverData($library);
        if (!is_array($cover)) {
            $cover = [];
        }

        $imageUrl = $this->coverService->getDefaultCoverUrl();
        if (isset($cover['url'])) {
            $imageUrl = $cover['url'];
        }

        return [
            'id' => (int) $library->id,
            'name' => $library->name,
            'description' => $library->description,
            'word_count' => (int) $library->total_words,
            'language' => $library->language,
            'difficulty' => $library->difficulty_level ?? 'intermediate',
            'category' => $library->category ?? 'general',
            'image_url' => $imageUrl,
            'cover_status' => $cover['status'] ?? 'pending',
            'cover_error' => $cover['error'] ?? null,
            'cover_error_message' => $cover['error_message'] ?? ($cover['error'] ?? null),
            'cover_attempts' => (int) ($cover['attempts'] ?? 0),
            'is_recommended' => (bool) $library->is_recommended,
            'tags' => $library->tags ?? [],
            'cover_log' => $cover['log'] ?? null,
        ];
    }
}
