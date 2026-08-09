<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1ImageUrl;
use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Http\Controllers\Controller;
use App\Providers\PathMapper;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

        // Over-fetch then dedup: duplicate library rows (same canonical key)
        // must collapse to one BEFORE the limit is applied, or the limit could
        // be filled entirely by duplicates of fewer than $limit real libraries.
        // The DB cap (limit * 4, floored) keeps the over-fetch bounded.
        $fetchCap = max($limit * 4, 50);

        $libraries = self::dedupLibraryCollection(
            AppQyV1VocabularyLibraryModel::query()
                ->public()
                ->forLanguage($language)
                ->where('is_recommended', true)
                ->orderByDesc('total_words')
                ->orderBy('id')
                ->limit($fetchCap)
                ->get()
        )
            ->take($limit)
            ->map(fn ($library) => $this->transformLibrary($library))
            ->values();

        return $this->success([
            'libraries' => $libraries,
        ]);
    }

    /**
     * Collapse duplicate library rows to one per canonical key.
     *
     * The canonical key is the row's `source` when present, else a derived
     * name+language slug (covers legacy rows whose source was left NULL/blank
     * before the NOT-NULL backfill migration ran). Among duplicates the SURVIVOR
     * is the row with the LOWEST id; if a later duplicate carries a larger
     * total_words it is treated as the survivor's word_count (the lowest-id row
     * is kept as the identity, but the richer count wins) so the visible count is
     * never under-reported. Input order is otherwise preserved.
     *
     * @param \Illuminate\Support\Collection $rows
     * @return \Illuminate\Support\Collection
     */
    public static function dedupLibraryCollection($rows)
    {
        $byKey = [];
        $order = [];

        foreach ($rows as $row) {
            $key = self::canonicalLibraryKey($row);

            if (!isset($byKey[$key])) {
                $byKey[$key] = $row;
                $order[] = $key;
                continue;
            }

            $kept = $byKey[$key];

            // Keep the LOWEST id as the surviving identity.
            if ((int) $row->id < (int) $kept->id) {
                // Carry the larger total_words forward onto the new survivor.
                if ((int) $kept->total_words > (int) $row->total_words) {
                    $row->total_words = (int) $kept->total_words;
                }
                $byKey[$key] = $row;
            } elseif ((int) $row->total_words > (int) $kept->total_words) {
                // Survivor stays, but adopt the larger count.
                $kept->total_words = (int) $row->total_words;
            }
        }

        $deduped = new \Illuminate\Support\Collection();
        foreach ($order as $key) {
            $deduped->push($byKey[$key]);
        }

        return $deduped;
    }

    /**
     * Canonical dedup key for a library row: lowercased, slugified `source`
     * when present, else "name|language" slugified. Mirrors the source-key
     * derivation in AppQyV1VocabularyImporter so read-side dedup and write-side
     * upsert agree on identity.
     */
    public static function canonicalLibraryKey(AppQyV1VocabularyLibraryModel $library): string
    {
        $source = trim((string) $library->source);
        if ($source !== '') {
            return mb_strtolower($source);
        }

        $name = mb_strtolower(trim((string) $library->name));
        $language = mb_strtolower(trim((string) $library->language));
        return $name . '|' . $language;
    }

    public function getStatistics(Request $request): JsonResponse
    {
        $language = $request->query('language');
        $includeWordsParam = $request->query('include_words');
        $includeWords = false;
        if ($includeWordsParam === '1' || $includeWordsParam === 'true' || $includeWordsParam === 1 || $includeWordsParam === true) {
            $includeWords = true;
        }

        // Single grouped aggregate over the (filtered) library table. The
        // top-level totals (libraries, words, distinct languages) are all derived
        // from these rows, replacing three additional COUNT/SUM/DISTINCT scans.
        $languageRows = AppQyV1VocabularyLibraryModel::publicLanguageAggregates(
            $language !== null && $language !== '' ? $language : null
        );

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
            $query->searchTextInsensitive($search);
        }

        // Dedup-then-paginate: duplicate library rows (same canonical key) must
        // collapse BEFORE slicing the page, or the total/last_page counts and the
        // page contents would both double-count. The full filtered set is fetched
        // in stable order, deduped in memory (the system catalogue is small ~tens
        // of rows), and only then sliced — so the pagination math is over the
        // DISTINCT set. word_ids is excluded from the fetch (heavy JSON, unused
        // here).
        $allRows = $query
            ->orderByDesc('is_recommended')
            ->orderBy('difficulty_level')
            ->orderByDesc('total_words')
            ->orderBy('id')
            ->get();

        $deduped = self::dedupLibraryCollection($allRows);

        $total = $deduped->count();
        $lastPage = max(1, (int) ceil($total / $perPage));

        $libraries = $deduped
            ->slice(($page - 1) * $perPage, $perPage)
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

        // On-page media prioritization (P5): bump the page's words that still
        // lack image OR audio to the FRONT of the word_media queue so the visible
        // page resolves first. Capped + non-blocking; the service swallows its
        // own failures. The dictionary rows are already hydrated, so the
        // missing-media check adds no extra queries.
        $this->bumpPageMediaToFront($dictRows, $library->languageCode());

        return $this->success([
            'library' => [
                'id' => (int) $library->id,
                'name' => $library->name,
                'total_words' => (int) $library->total_words,
                'language' => $library->language,
            ],
            'words' => $words,
            // Whole-library coverage (over the library's word_ids set, NOT just
            // this page). Cheap aggregate count queries, no full hydration.
            'stats' => self::buildLibraryWordStats($library),
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
                'has_more' => $page < $lastPage,
            ],
        ]);
    }

    /**
     * Bump the page's words that lack image OR audio to the FRONT of the
     * word_media queue (P5 on-query prioritization). Operates on the already
     * hydrated dictionary rows (no extra read), capped at MAX_PAGE_MEDIA_BUMP so
     * a large page never floods the queue. Non-blocking: per-word failures are
     * swallowed by the service.
     *
     * @param iterable $dictRows Hydrated AppQyV1LangDictionaryModel rows.
     * @param string|null $langCode Library language code (null -> skip).
     */
    private function bumpPageMediaToFront($dictRows, ?string $langCode): void
    {
        if ($langCode === null) {
            return;
        }

        $service = app(\App\Apps\AppQyV1\AppQyV1Services\AppQyV1WordMediaService::class);
        $maxBump = 50;
        $bumped = 0;

        foreach ($dictRows as $row) {
            if ($bumped >= $maxBump) {
                break;
            }
            // Invalid placeholder words are never re-queued.
            $isValid = $row->is_valid === null ? true : (bool) $row->is_valid;
            if (!$isValid) {
                continue;
            }

            $hasImage = $service->resolveImageUrl($row) !== null;
            $hasAudio = $service->resolveAudioUrl($row) !== null;
            if ($hasImage && $hasAudio) {
                continue;
            }

            // No target language at the page level; image/audio are language
            // agnostic and translation coverage is bumped by per-word lookups.
            $service->bumpQueriedWord($row, (string) $row->content, $langCode, null);
            $bumped++;
        }
    }

    /**
     * Whole-library word coverage over the library's word_ids set:
     *   { total, translated, with_audio, with_image, invalid }.
     *
     * Efficient: aggregate COUNT/SUM queries against the per-language dictionary
     * table scoped to the library's id set (chunked WHERE IN), never hydrating
     * rows. `total` is the membership count (word_ids length); the per-flag counts
     * are over the rows that actually resolve in the dictionary. Invalid words are
     * counted (they remain library-member placeholders), not excluded.
     */
    public static function buildLibraryWordStats(AppQyV1VocabularyLibraryModel $library): array
    {
        $ids = $library->getWordIdsArray();
        $stats = [
            'total' => count($ids),
            'translated' => 0,
            'with_audio' => 0,
            'with_image' => 0,
            'invalid' => 0,
        ];

        if (empty($ids)) {
            return $stats;
        }

        $langCode = $library->languageCode();
        if ($langCode === null) {
            return $stats;
        }

        $coverage = AppQyV1LangDictionaryModel::coverageMetricsForIds($langCode, $ids);
        $stats['translated'] = $coverage['translated'];
        $stats['with_audio'] = $coverage['with_audio'];
        $stats['with_image'] = $coverage['with_image'];
        $stats['invalid'] = $coverage['invalid'];

        return $stats;
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
        $hasDictionaryTable = AppQyV1LangDictionaryModel::languageTableExists($languageCode);

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
     * Shared word-entry tail built straight from a dictionary row (the contract
     * the vocab library detail page relies on): md5, translations, phonetics,
     * explanation, audio (url + available + has_audio flag), images (usable
     * URLs), and the coverage/validity flags (has_translation / has_image /
     * is_valid / validity_note).
     *
     * The audio check uses the row's own tts_files (no extra md5 lookup); images
     * resolve every image_files entry through AppQyV1ImageUrl (Bing images are
     * stored as LOCAL files, so the stored relative paths get the word-image
     * serve-route prefix; absolute http(s) URLs pass through as a defensive
     * fallback).
     *
     * INVALID words (is_valid=false) are LIBRARY MEMBERS and are KEPT here as
     * placeholders (the FE greys them); they are never filtered out of this list.
     */
    public static function buildWordEntryFromDictionaryRow(AppQyV1LangDictionaryModel $row): array
    {
        $translations = self::simpleTranslationsFromDecoded($row->translations);
        $hasTranslation = $translations !== null;

        // image_files -> usable { url } list (local relative paths mapped to the
        // word-image serve route; absolute URLs pass through defensively).
        $imageFiles = is_array($row->image_files) ? $row->image_files : [];
        $images = AppQyV1ImageUrl::listFrom($imageFiles);
        $hasImage = count($images) > 0;

        // File-first audio: only report an audio_url when the file is on disk.
        $audioUrl = null;
        $audioAvailable = false;
        if (!empty($row->tts_files)) {
            // File-first: resolve against the canonical audio base (write target
            // == serve base). PathMapper::getAppQyV1AudioBaseDir is the single
            // source of truth for the static/app_qy_v1/audio tree.
            $audioBasePath = PathMapper::getAppQyV1AudioBaseDir() . '/';
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

        // Validity is externally asserted: only an explicit is_valid=false flags
        // an invalid (placeholder) word; never-checked rows are valid.
        $isValid = $row->is_valid === null ? true : (bool) $row->is_valid;

        // Optional explanation: the dictionary has no dedicated column; when an
        // AI explanation task has filled it, it lives under word_details. Surface
        // a string explanation when present, else null.
        $explanation = null;
        if (is_array($row->word_details) && isset($row->word_details['explanation']) && is_string($row->word_details['explanation'])) {
            $explanation = $row->word_details['explanation'];
        }

        return [
            'md5' => $row->md5,
            'translations' => $translations,
            'phonetic' => $row->phonetic,
            'us_phonetic' => $row->us_phonetic,
            'uk_phonetic' => $row->uk_phonetic,
            'explanation' => $explanation,
            // word_details kept for backward compatibility (was image_files).
            'word_details' => count($imageFiles) > 0 ? $imageFiles : null,
            'images' => $images,
            'audio_url' => $audioUrl,
            'audio_available' => $audioAvailable,
            'has_translation' => $hasTranslation,
            'has_audio' => (bool) $row->has_audio,
            'has_image' => $hasImage,
            'is_valid' => $isValid,
            'validity_note' => $row->validity_note,
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

        return $this->computeDictionaryMetrics($languageName, $languageCode);
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

        $coverage = AppQyV1LangDictionaryModel::cachedCoverageMetrics($languageCode);
        if ($coverage === null) {
            return $empty;
        }

        $total = $coverage['total'];
        $withTranslation = $coverage['with_translation'];
        $withAudio = $coverage['with_audio'];
        $withImages = $coverage['with_images'];
        $invalid = $coverage['invalid_words'];
        $checked = $coverage['validity_checked'];

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

        // Align with book/poster behavior: image_url is null until the cover is
        // actually READY, so the UI cover-generation trigger (`!group.imageUrl`)
        // fires for pending libraries. Previously this fell back to the default
        // cover URL, which made every library look covered and stalled the whole
        // vocabulary-cover pipeline. The deterministic (future) URL and the
        // placeholder stay available in separate fields.
        $coverStatus = $cover['status'] ?? 'pending';
        $imageUrl = ($coverStatus === 'ready' && isset($cover['url'])) ? $cover['url'] : null;

        return [
            'id' => (int) $library->id,
            'name' => $library->name,
            'description' => $library->description,
            'word_count' => (int) $library->total_words,
            'language' => $library->language,
            'difficulty' => $library->difficulty_level ?? 'intermediate',
            'category' => $library->category ?? 'general',
            'image_url' => $imageUrl,
            'cover_url' => $cover['url'] ?? null,
            'default_cover_url' => $this->coverService->getDefaultCoverUrl(),
            'cover_status' => $coverStatus,
            'cover_error' => $cover['error'] ?? null,
            'cover_error_message' => $cover['error_message'] ?? ($cover['error'] ?? null),
            'cover_attempts' => (int) ($cover['attempts'] ?? 0),
            'is_recommended' => (bool) $library->is_recommended,
            'tags' => $library->tags ?? [],
            'cover_log' => $cover['log'] ?? null,
        ];
    }
}
