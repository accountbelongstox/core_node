<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Vocabulary;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;
use App\Constants\AppKeys;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Http\Controllers\Controller;
use App\Providers\AppTablePrefixServiceProvider;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Vocabulary page stats drill-down (dashboard).
 *
 * Paginated list endpoints that back each stat number on the Vocabulary page:
 *   - dictionary/words            -> per-language dictionary rows with filters
 *   - tts/queue/items             -> the TTS queue (wraps the unified queue)
 *   - vocabulary/language-breakdown -> per-language word/translation/audio counts
 *
 * Public, read-only, no user data — same posture as the other vocabulary
 * statistics endpoints (AppQyV1VocabularyLibraryPublicController).
 *
 * NO try-catch (trust Laravel validation); NO ?? / || (explicit if statements).
 */
class AppQyV1VocabularyStatsController extends Controller
{
    use ApiResponse;

    /**
     * UI sort key -> real dictionary DB column(s). A key absent from this map
     * falls back to the default query_count ordering, so the request can never
     * order by an arbitrary column (injection-safe: $column comes only from here).
     *   word        -> content
     *   translation -> has_translation (no scalar translation column; the text
     *                  lives in the JSON `translations`, so we group by coverage)
     *   phonetic    -> us_phonetic, then uk_phonetic, then phonetic
     *   queries     -> query_count
     *   status      -> is_valid then has_audio (mirrors the UI status badge order)
     */
    private const SORTABLE_COLUMNS = [
        'word' => ['content'],
        'translation' => ['has_translation'],
        'phonetic' => ['us_phonetic', 'uk_phonetic', 'phonetic'],
        'queries' => ['query_count'],
        'status' => ['is_valid', 'has_audio'],
    ];

    /**
     * Paginated dictionary rows for a language with a coverage filter.
     *
     * GET /api/app_qy_v1/dictionary/words
     *   ?language=&filter=all|with_translation|without_translation|invalid|with_audio|without_audio
     *   &q=&start=&limit=
     *
     * Returns { success, total, start, limit, items:[{content,md5,has_translation,
     * has_audio,is_valid,translations,us_phonetic,uk_phonetic}] }.
     */
    public function dictionaryWords(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'nullable|string',
            'filter' => 'nullable|string|in:all,with_translation,without_translation,invalid,with_audio,without_audio',
            // Narrow an `invalid` listing to a single validity_source (e.g.
            // 'region-redirect' or 'bing-assist') so the dashboard can manage
            // each class of invalid word separately.
            'validity_source' => 'nullable|string|max:64',
            'q' => 'nullable|string',
            // Server-side full-dataset sort: a whitelisted UI sort key + direction.
            'sort' => 'nullable|string|in:word,translation,phonetic,queries,status',
            'order' => 'nullable|string|in:asc,desc',
            'start' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:1000',
        ]);

        $language = 'english';
        if (isset($validated['language']) && $validated['language'] !== '') {
            $language = $validated['language'];
        }
        $filter = 'all';
        if (isset($validated['filter'])) {
            $filter = $validated['filter'];
        }
        $validitySource = '';
        if (isset($validated['validity_source'])) {
            $validitySource = trim((string) $validated['validity_source']);
        }
        $search = '';
        if (isset($validated['q'])) {
            $search = trim((string) $validated['q']);
        }
        $start = 0;
        if (isset($validated['start'])) {
            $start = (int) $validated['start'];
        }
        $limit = 100;
        if (isset($validated['limit'])) {
            $limit = (int) $validated['limit'];
        }
        $sortKey = '';
        if (isset($validated['sort'])) {
            $sortKey = $validated['sort'];
        }
        $order = 'asc';
        if (isset($validated['order']) && $validated['order'] === 'desc') {
            $order = 'desc';
        }

        $languageCode = AppQyV1VocabularyLibraryPublicController::getLanguageCode($language);

        $hasTable = AppQyV1LangDictionaryModel::languageTableExists($languageCode);
        if (!$hasTable) {
            return $this->success([
                'language' => $language,
                'language_code' => $languageCode,
                'filter' => $filter,
                'total' => 0,
                'start' => $start,
                'limit' => $limit,
                'items' => [],
            ], 'No dictionary for this language');
        }

        // forLanguage() returns a model instance bound to the language table;
        // newQuery() gives a real Builder so chained where()/clone accumulate.
        $query = AppQyV1LangDictionaryModel::forLanguage($languageCode)->newQuery();
        $this->applyDictionaryFilter($query, $filter);

        // Optional validity_source narrowing (most useful with filter=invalid):
        // 'region-redirect' = Bing region/redirect words, 'bing-assist' = no entry.
        if ($validitySource !== '') {
            $query->where('validity_source', $validitySource);
        }

        if ($search !== '') {
            $query->contentContainsInsensitive($search);
        }

        $total = (clone $query)->count();

        // Full-dataset ordering: a whitelisted `sort` drives orderBy over the
        // ENTIRE filtered set (count above uses the same $query before skip/take),
        // so pagination reflects the sorted order across all pages — not just the
        // loaded page. Falls back to the default most-queried-first ordering.
        if ($sortKey !== '' && isset(self::SORTABLE_COLUMNS[$sortKey])) {
            foreach (self::SORTABLE_COLUMNS[$sortKey] as $column) {
                $query->orderBy($column, $order);
            }
            $query->orderBy('id');
        } else {
            $query->orderByDesc('query_count')->orderBy('id');
        }

        $rows = $query
            ->skip($start)
            ->take($limit)
            ->get();

        $items = $rows->map(function (AppQyV1LangDictionaryModel $row) {
            // Reuse the canonical rich builder (translations + phonetics +
            // word_details + audio_url) so the drill-down shows the SAME detail
            // the library view does, then add the raw per-word metadata columns.
            $entry = AppQyV1VocabularyLibraryPublicController::buildWordEntryFromDictionaryRow($row);

            $hasTranslation = (bool) $row->has_translation || !empty($entry['has_translation']);

            // File-first audio path/size: mirror buildWordEntryFromDictionaryRow's
            // resolution (same canonical PathMapper base, same first-existing
            // tts_file) so the displayed SERVER PATH + SIZE refer to the exact file
            // audio_url serves. Path is stripped to the www-relative form
            // (/wwwroot/laravel_db/static/app_qy_v1/audio/<lang>/<type>/<file>);
            // null when no playable file exists on disk.
            $audioPath = null;
            $audioSize = null;
            if (!empty($row->tts_files)) {
                $audioBaseAbs = \App\Providers\PathMapper::getAppQyV1AudioBaseDir() . '/';
                $wwwRoot = rtrim(\App\Providers\PathMapper::mapWebPath('www'), '/');
                foreach ($row->tts_files as $ttsFile) {
                    if (isset($ttsFile['path'])) {
                        $fullPath = $audioBaseAbs . $ttsFile['path'];
                        if (is_file($fullPath)) {
                            $audioPath = str_starts_with($fullPath, $wwwRoot)
                                ? substr($fullPath, strlen($wwwRoot))
                                : $fullPath;
                            $size = @filesize($fullPath);
                            $audioSize = $size === false ? null : (int) $size;
                            break;
                        }
                    }
                }
            }

            return [
                'id' => (int) $row->id,
                'content' => $row->content,
                'md5' => $row->md5,
                'has_translation' => $hasTranslation,
                'has_audio' => (bool) $row->has_audio,
                'is_valid' => (bool) $row->is_valid,
                'translations' => $entry['translations'],
                'us_phonetic' => $row->us_phonetic,
                'uk_phonetic' => $row->uk_phonetic,
                'query_count' => (int) $row->query_count,
                // --- richer detail surfaced for the expandable row ---
                'phonetic' => $row->phonetic,
                'audio_url' => $entry['audio_url'],
                'audio_available' => (bool) ($entry['audio_available'] ?? false),
                'audio_path' => $audioPath,
                'audio_size' => $audioSize,
                // Real word_details column (definitions / POS / examples) — NOT the
                // builder's $entry['word_details'], which aliases image_files.
                'word_details' => $row->word_details,
                'image_files' => is_array($row->image_files) ? $row->image_files : null,
                'translation_provider' => $row->translation_provider,
                'tts_provider' => $row->tts_provider,
                'image_provider' => $row->image_provider,
                'tts_status' => $row->tts_status,
                'tts_attempts' => (int) ($row->tts_attempts ?? 0),
                'tts_error' => $row->tts_error,
                'validity_note' => $row->validity_note,
                'validity_source' => $row->validity_source,
                'validity_checked_at' => $row->validity_checked_at,
                'last_modified' => $row->last_modified,
                'last_query_time' => $row->last_query_time,
            ];
        })->values();

        return $this->success([
            'language' => $language,
            'language_code' => $languageCode,
            'filter' => $filter,
            'validity_source' => $validitySource,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => $items,
        ], 'Dictionary words retrieved');
    }

    /**
     * Validity breakdown for a language's dictionary — powers the dashboard's
     * "Word Validity" management panel.
     *
     * GET /api/app_qy_v1/dictionary/validity-summary?language=
     *
     * Returns counts: total, valid, invalid, unchecked, and the invalid rows
     * grouped by validity_source (region-redirect / bing-assist / other) so the
     * UI can show how many words each cause invalidated.
     */
    public function validitySummary(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'language' => 'nullable|string',
        ]);

        $language = 'english';
        if (isset($validated['language']) && $validated['language'] !== '') {
            $language = $validated['language'];
        }
        $languageCode = AppQyV1VocabularyLibraryPublicController::getLanguageCode($language);

        $hasTable = AppQyV1LangDictionaryModel::languageTableExists($languageCode);
        if (!$hasTable) {
            return $this->success([
                'language' => $language,
                'language_code' => $languageCode,
                'total' => 0,
                'valid' => 0,
                'invalid' => 0,
                'unchecked' => 0,
                'invalid_by_source' => [],
            ], 'No dictionary for this language');
        }

        $total = AppQyV1LangDictionaryModel::forLanguage($languageCode)->newQuery()->count();
        $invalid = AppQyV1LangDictionaryModel::forLanguage($languageCode)->newQuery()
            ->where('is_valid', false)->count();
        $unchecked = AppQyV1LangDictionaryModel::forLanguage($languageCode)->newQuery()
            ->whereNull('validity_checked_at')->count();
        $valid = $total - $invalid;

        // Group the invalid rows by validity_source (one grouped query).
        $grouped = AppQyV1LangDictionaryModel::invalidCountsBySource($languageCode);

        $invalidBySource = [];
        foreach ($grouped as $source => $count) {
            $key = (is_string($source) && $source !== '') ? $source : 'other';
            $invalidBySource[$key] = (int) $count;
        }

        return $this->success([
            'language' => $language,
            'language_code' => $languageCode,
            'total' => $total,
            'valid' => $valid,
            'invalid' => $invalid,
            'unchecked' => $unchecked,
            'invalid_by_source' => $invalidBySource,
        ], 'Validity summary retrieved');
    }

    /**
     * Example sentences from the shared sentence library that CONTAIN a word —
     * lazy-loaded when a word row is expanded in the detail view.
     *
     * GET /api/app_qy_v1/dictionary/sentences?word=&language=&limit=
     *
     * There is no word→sentence mapping table, so we word-boundary match the
     * sentence text (PostgreSQL `~*` regex `\yword\y`; LIKE fallback elsewhere).
     * Capped + ordered by occurrence so the scan stays cheap for one expand.
     */
    public function wordSentences(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'word' => 'required|string|max:128',
            'language' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:50',
        ]);

        $word = trim((string) $validated['word']);
        $language = (isset($validated['language']) && $validated['language'] !== '')
            ? $validated['language'] : 'english';
        $limit = (int) ($validated['limit'] ?? 10);

        if ($word === '') {
            return $this->success(['word' => $word, 'language' => $language, 'count' => 0, 'sentences' => []], 'No word');
        }

        // Books v3: examples live in the per-language sentence table
        // ({prefix}_sentences_{lang}), keyed by content_id. Resolve the language
        // CODE for the table (the request may send a name like 'english').
        $langCode = $this->resolveLangCode($language);
        if (!LangSentence::tableExists($langCode)) {
            return $this->success(['word' => $word, 'language' => $language, 'count' => 0, 'sentences' => []], 'No sentence library');
        }

        $rows = LangSentence::containingWordRows($langCode, $word, $limit);
        $sentences = $rows->map(static function (LangSentence $s) {
            return [
                'id' => $s->content_id ?? $s->getKey(),
                'content_id' => $s->content_id,
                'text' => $s->text,
                'explanation' => $s->explanation,
                'grammar' => $s->grammar,
                'special_usage' => $s->special_usage,
                'ai_commentary' => $s->ai_commentary,
                'audio' => $s->audio,
                'occurrence_count' => (int) ($s->occurrence_count ?? 0),
            ];
        })->values();

        return $this->success([
            'word' => $word,
            'language' => $language,
            'count' => $sentences->count(),
            'sentences' => $sentences,
        ], 'Sentences retrieved');
    }

    /**
     * Normalize a language name/code to the 2/3-letter code used by the
     * per-language sentence tables. Already-codes pass through; common full
     * names are mapped; an unknown value falls back to 'en'.
     */
    private function resolveLangCode(string $language): string
    {
        $lang = strtolower(trim($language));
        $nameToCode = [
            'english' => 'en',
            'japanese' => 'ja',
            'korean' => 'ko',
            'vietnamese' => 'vi',
            'lao' => 'lo',
            'chinese' => 'zh',
        ];
        if (isset($nameToCode[$lang])) {
            $lang = $nameToCode[$lang];
        }
        if ($lang === '' || !AppQyV1TableMaps::isLanguageSupported($lang)) {
            return 'en';
        }
        return $lang;
    }

    /**
     * Apply a coverage filter to a dictionary query.
     *
     * Boolean columns are compared with true/false so the predicate works on
     * both pgsql (real boolean) and sqlite (true/false map to 1/0). Translation
     * coverage mirrors the dashboard metric (has_translation OR non-empty
     * translations JSON).
     */
    private function applyDictionaryFilter($query, string $filter): void
    {
        if ($filter === 'with_translation') {
            $query->withTranslationCoverage();
            return;
        }

        if ($filter === 'without_translation') {
            $query->withoutTranslationCoverage();
            return;
        }

        if ($filter === 'invalid') {
            $query->where('is_valid', false);
            return;
        }

        if ($filter === 'with_audio') {
            $query->where('has_audio', true);
            return;
        }

        if ($filter === 'without_audio') {
            $query->where(function ($q) {
                $q->where('has_audio', false)
                    ->orWhereNull('has_audio');
            });
            return;
        }
        // 'all' -> no additional predicate.
    }

    /**
     * Paginated TTS queue items, served from the unified queue (canonical
     * tables). Wraps AppQyV1UnifiedTTSQueueService::getQueueSummary so the
     * status/type filters and item shape match the existing TTS queue API.
     *
     * GET /api/app_qy_v1/tts/queue/items
     *   ?status=pending|processing|completed|failed&type=word|sentence|article
     *   &start=&limit=
     *
     * Returns { success, total, start, limit, items, statistics }.
     */
    public function ttsQueueItems(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'nullable|string|in:pending,processing,completed,failed',
            'type' => 'nullable|string|in:word,sentence,article',
            'start' => 'nullable|integer|min:0',
            'limit' => 'nullable|integer|min:1|max:500',
        ]);

        $status = null;
        if (isset($validated['status'])) {
            $status = $validated['status'];
        }
        $type = null;
        if (isset($validated['type'])) {
            $type = $validated['type'];
        }
        $start = 0;
        if (isset($validated['start'])) {
            $start = (int) $validated['start'];
        }
        $limit = 50;
        if (isset($validated['limit'])) {
            $limit = (int) $validated['limit'];
        }

        // The unified queue paginates by page/per_page; translate start/limit to
        // a page window. start must be a multiple of limit for a clean page, so
        // fetch the covering page and slice the remainder.
        $perPage = $limit;
        $page = intdiv($start, max(1, $perPage)) + 1;
        $offsetInPage = $start - (($page - 1) * $perPage);

        $service = new AppQyV1UnifiedTTSQueueService();
        $summary = $service->getQueueSummary($page, $perPage + $offsetInPage, $status, $type);

        $tasks = [];
        if (isset($summary['tasks']) && is_array($summary['tasks'])) {
            $tasks = $summary['tasks'];
        }
        $items = array_slice($tasks, $offsetInPage, $limit);

        $total = 0;
        if (isset($summary['pagination']['total'])) {
            $total = (int) $summary['pagination']['total'];
        }
        $statistics = [];
        if (isset($summary['statistics']) && is_array($summary['statistics'])) {
            $statistics = $summary['statistics'];
        }

        return $this->success([
            'status' => $status,
            'type' => $type,
            'total' => $total,
            'start' => $start,
            'limit' => $limit,
            'items' => array_values($items),
            'statistics' => $statistics,
        ], 'TTS queue items retrieved');
    }

    /**
     * Per-language word/translation/audio/invalid counts, powering the
     * "Language Breakdown" panel and its per-language drilldown.
     *
     * GET /api/app_qy_v1/vocabulary/language-breakdown
     *
     * Returns { success, languages:[{language, language_code, words,
     * with_translation, with_audio, invalid}] }.
     */
    public function languageBreakdown(): JsonResponse
    {
        $languages = [];

        foreach (AppQyV1TableMaps::getAllWordTables() as $langCode => $table) {
            $metrics = AppQyV1LangDictionaryModel::languageBreakdownMetrics($langCode);
            if ($metrics === null || $metrics['words'] === 0) {
                continue;
            }

            $languageName = AppQyV1VocabularyLibraryModel::languageCodeToName($langCode);
            if ($languageName === null) {
                $languageName = $langCode;
            }

            $languages[] = [
                'language' => $languageName,
                'language_code' => $langCode,
                'words' => $metrics['words'],
                'with_translation' => $metrics['with_translation'],
                'with_audio' => $metrics['with_audio'],
                'invalid' => $metrics['invalid'],
            ];
        }

        usort($languages, fn ($a, $b) => $b['words'] <=> $a['words']);

        return $this->success([
            'languages' => $languages,
        ], 'Language breakdown retrieved');
    }
}
