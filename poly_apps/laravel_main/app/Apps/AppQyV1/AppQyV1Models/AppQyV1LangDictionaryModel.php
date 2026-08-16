<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Concerns\QueriesDiffIdPages;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\BindsAppQyV1DynamicLanguageTable;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1TtsQueueQueries;

/**
 * Multi-Language Dictionary Model
 *
 * Operates on language-specific dictionary tables: {prefix}_{lang}_dictionaries
 * Used for TTS caching, translations, and word metadata
 * Table names are resolved through the canonical AppQyV1 table map.
 */
class AppQyV1LangDictionaryModel extends AppQyV1Model
{
    use AppQyV1TtsQueueQueries, BindsAppQyV1DynamicLanguageTable, QueriesDiffIdPages, RunsModelTransactions;

    private const QUERY_CHUNK_SIZE = 1000;


    protected $fillable = [
        'content',
        'md5',
        'translations',
        'has_translation',
        'translation_provider',
        'phonetic',
        'us_phonetic',
        'uk_phonetic',
        'tts_files',
        'audio_files',
        'tts_provider',
        'has_audio',
        'image_files',
        'image_provider',
        'word_details',
        'is_exist_local',
        'has_operations',
        'is_valid',
        'validity_checked_at',
        'validity_source',
        'validity_note',
        'query_count',
        'last_modified',
        'last_query_time',
        // TTS generation process state (queue-less coordination — the former
        // tts_queue table's job, carried on the canonical row).
        'tts_status',
        'tts_attempts',
        'tts_error',
        'tts_locked_at',
        'tts_locked_by',
        'tts_requested_at',
        'tts_completed_at',
        // Word-image generation process state (queue-less coordination — the
        // image queue's job, carried on the canonical row; mirrors tts_*).
        'image_status',
        'image_priority',
        'image_locked_at',
        'image_locked_by',
        'image_attempts',
        'image_requested_at',
        'image_completed_at',
        'image_mcp_submitted_at',
        // Full remote Bing resource URLs { images:[...], audio:'...' } for in-page
        // re-fetch of missing media without a re-translate.
        'bing_resource_urls',
    ];

    protected function casts(): array
    {
        return [
            'translations' => 'json',
            'tts_files' => 'json',
            'audio_files' => 'json',
            'image_files' => 'json',
            'word_details' => 'json',
            'bing_resource_urls' => 'json',
            'has_translation' => 'boolean',
            'has_audio' => 'boolean',
            'is_exist_local' => 'boolean',
            'has_operations' => 'boolean',
            'is_valid' => 'boolean',
            'validity_checked_at' => 'datetime',
            'query_count' => 'integer',
            'last_modified' => 'datetime',
            'last_query_time' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
            'tts_attempts' => 'integer',
            'tts_locked_at' => 'datetime',
            'tts_requested_at' => 'datetime',
            'tts_completed_at' => 'datetime',
            'image_attempts' => 'integer',
            'image_priority' => 'integer',
            'image_locked_at' => 'datetime',
            'image_requested_at' => 'datetime',
            'image_completed_at' => 'datetime',
            'image_mcp_submitted_at' => 'datetime',
        ];
    }

    protected function resolveDynamicLanguageTable(string $language): string
    {
        return AppQyV1TableMaps::getDictionaryTableName($language);
    }

    public static function initializationLanguageState(string $langCode): array
    {
        $model = self::forLanguage($langCode);
        $schema = Schema::connection($model->getConnectionName());
        $table = $model->getTable();
        $row = null;

        if (!$schema->hasTable($table)) {
            return ['exists' => false, 'total' => 0, 'translated' => 0];
        }

        $row = $model->newQuery()
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('COALESCE(SUM(CASE WHEN has_translation = true THEN 1 ELSE 0 END), 0) AS translated')
            ->first();

        return [
            'exists' => true,
            'total' => (int) ($row->total ?? 0),
            'translated' => (int) ($row->translated ?? 0),
        ];
    }

    public static function initializationTableSummary(): array
    {
        $languages = AppQyV1TableMaps::getSupportedLanguages();
        $tablesWithData = [];
        $emptyCount = 0;
        $totalTables = 0;
        $errors = [];
        $model = new self();
        $connection = $model->getConnection();
        $existingTables = array_fill_keys(
            $connection->getSchemaBuilder()->getTableListing(null, false),
            true
        );
        $languageByTable = [];
        $aggregateQuery = null;
        $table = '';
        $tableQuery = null;
        $count = 0;
        $distinctMd5 = 0;
        $rows = null;

        foreach ($languages as $language) {
            $table = self::forLanguage($language)->getTable();
            if (!isset($existingTables[$table])) {
                continue;
            }

            $languageByTable[$table] = $language;
            $tableQuery = $connection->table($table)
                ->selectRaw('?::text AS table_name', [$table])
                ->selectRaw('COUNT(*) AS total')
                ->selectRaw('COUNT(DISTINCT md5) AS distinct_md5');
            if ($aggregateQuery === null) {
                $aggregateQuery = $tableQuery;
            } else {
                $aggregateQuery->unionAll($tableQuery);
            }
        }

        $totalTables = count($languageByTable);
        if ($aggregateQuery !== null) {
            $rows = $aggregateQuery->get();
            foreach ($rows as $row) {
                $table = (string) $row->table_name;
                $count = (int) $row->total;
                $distinctMd5 = (int) $row->distinct_md5;
                if ($count === 0) {
                    $emptyCount++;
                    continue;
                }

                $tablesWithData[] = [
                    'name' => $table,
                    'code' => $languageByTable[$table],
                    'count' => $count,
                    'distinct_md5' => $distinctMd5,
                    'unique_ok' => $count === $distinctMd5,
                ];
            }
        }

        return [
            'tables_with_data' => $tablesWithData,
            'empty_count' => $emptyCount,
            'total_tables' => $totalTables,
            'errors' => $errors,
        ];
    }

    public static function findForLanguage(string $langCode, int $wordId): ?self
    {
        return self::forLanguage($langCode)->newQuery()->find($wordId);
    }

    /**
     * Cache TTL (seconds) for the per-language dashboard dictionary metrics.
     * Short window so even paths that bypass explicit invalidation self-heal.
     */
    public const METRICS_CACHE_TTL = 300;

    public const MANAGEMENT_FILTER_KEYS = [
        'all',
        'with_translation',
        'without_translation',
        'with_audio',
        'without_audio',
        'valid',
        'invalid',
    ];

    public const MANAGEMENT_SORT_KEYS = [
        'id',
        'word',
        'translation',
        'phonetic',
        'us_phonetic',
        'uk_phonetic',
        'audio',
        'queries',
        'is_valid',
    ];

    /**
     * Canonical cache key for the per-language dictionary metrics aggregate
     * surfaced on the vocabulary dashboard. Keyed by the 2-letter language code
     * so every read/write path shares one definition.
     */
    public static function metricsCacheKey(string $langCode): string
    {
        return 'appqyv1:dict_metrics:' . AppQyV1TableMaps::normalizeLangCode($langCode);
    }

    public static function coverageCacheKey(string $langCode): string
    {
        return 'appqyv1:dict_coverage:' . AppQyV1TableMaps::normalizeLangCode($langCode);
    }

    /**
     * Canonical cache key for the consolidated per-language dictionary stats
     * aggregate used by the system-initialization dashboard. Shares the same
     * language-code keying so it can be invalidated alongside dict_metrics.
     */
    public static function sysInitStatsCacheKey(string $langCode): string
    {
        return 'appqyv1:sysinit_stats:dict:' . AppQyV1TableMaps::normalizeLangCode($langCode);
    }

    /**
     * Invalidate the cached dictionary metrics for a language. Call after any
     * write that changes a metric-relevant column (row count, has_translation,
     * translations, has_audio, image_files, is_valid, validity_checked_at).
     * Safe to call with either a language name or a 2-letter code.
     */
    public static function forgetMetricsCache(string $langCode): void
    {
        Cache::forget(self::metricsCacheKey($langCode));
        Cache::forget(self::coverageCacheKey($langCode));
        // The system-init dashboard aggregate is derived from the same table,
        // so it must be dropped on the same writes.
        Cache::forget(self::sysInitStatsCacheKey($langCode));
        // The summary/audio-size dashboards roll up the same per-language data and
        // are cached separately (5 min / 30 min); drop them too so a dictionary
        // write isn't masked by a stale summary for up to their TTL.
        Cache::forget('appqyv1_system_statistics_summary');
        Cache::forget('appqyv1_audio_file_size_stats');
        app(QueueCenterRealtimeService::class)->publish(
            'dictionary',
            AppQyV1TableMaps::normalizeLangCode($langCode)
        );
    }

    /**
     * Batch-resolve dictionary rows for (word_id, language_code) reference
     * pairs - the canonical shape referenced by vocabulary_libraries.word_ids
     * and the group_word_progress JSON map (the shared resolver every
     * word-ref consumer goes through).
     *
     * One whereIn query per language (no per-row queries). Returns a map
     * keyed "{lang}:{id}" => dictionary row; pairs whose id is missing from
     * their dictionary are simply absent from the result.
     *
     * @param iterable<array{word_id:int|string, language_code:string}> $refs
     * @return array<string, self>
     */
    public static function resolveWordRefs(iterable $refs): array
    {
        $idsByLang = [];
        foreach ($refs as $ref) {
            $lang = strtolower((string) $ref['language_code']);
            $idsByLang[$lang][(int) $ref['word_id']] = true;
        }

        $resolved = [];
        foreach ($idsByLang as $lang => $idSet) {
            $ids = array_keys($idSet);
            foreach (self::rowsByIds($lang, $ids) as $row) {
                $resolved[$lang . ':' . $row->id] = $row;
            }
        }

        return $resolved;
    }

    public static function findByMd5(string $langCode, string $md5)
    {
        return self::forLanguage($langCode)
            ->where('md5', $md5)
            ->first();
    }

    public static function deleteByMd5(string $langCode, string $md5): int
    {
        return self::forLanguage($langCode)->newQuery()->where('md5', $md5)->delete();
    }

    public static function applyBatchAction(string $langCode, array $md5s, string $action): int
    {
        $query = self::forLanguage($langCode)->newQuery()->whereIn('md5', $md5s);

        if ($action === 'delete') {
            return $query->delete();
        }
        if ($action === 'mark_valid' || $action === 'mark_invalid') {
            return $query->update([
                'is_valid' => $action === 'mark_valid',
                'validity_checked_at' => now(),
                'validity_source' => 'dashboard',
                'updated_at' => now(),
            ]);
        }
        if ($action === 'requeue_tts') {
            return $query->update([
                'has_audio' => false,
                'tts_status' => 'pending',
                'tts_attempts' => 0,
                'tts_error' => null,
                'updated_at' => now(),
            ]);
        }

        return 0;
    }

    public static function managementPage(
        string $langCode,
        string $filter,
        string $validitySource,
        string $search,
        string $sortKey,
        string $order,
        int $start,
        int $limit
    ): array {
        $query = self::forLanguage($langCode)->newQuery()->managementFilter($filter);

        if ($validitySource !== '') {
            $query->where('validity_source', $validitySource);
        }
        if ($search !== '') {
            $query->contentContainsInsensitive($search);
        }

        $total = $search === '' && $validitySource === ''
            ? self::cachedManagementFilterTotal($langCode, $filter)
            : null;
        if ($total === null) {
            $total = (clone $query)->count();
        }

        $query->managementOrder($sortKey, $order);

        return [
            'total' => $total,
            'rows' => $query->skip($start)->take($limit)->get(),
        ];
    }

    public static function validitySummary(string $langCode): array
    {
        $stats = self::forLanguage($langCode)
            ->newQuery()
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) AS invalid')
            ->selectRaw('SUM(CASE WHEN validity_checked_at IS NULL THEN 1 ELSE 0 END) AS unchecked')
            ->first();
        $total = (int) ($stats->total ?? 0);
        $invalid = (int) ($stats->invalid ?? 0);
        $unchecked = (int) ($stats->unchecked ?? 0);

        return [
            'total' => $total,
            'valid' => $total - $invalid,
            'invalid' => $invalid,
            'unchecked' => $unchecked,
        ];
    }

    public static function pendingTtsClaimRows(
        string $language,
        int $limit,
        string $pendingStatus,
        int $maximumAttempts,
        $staleBefore,
        $assistStaleBefore,
        string $assistWorkerPrefix
    ) {
        $query = self::forLanguage($language)
            ->newQuery()
            ->where('has_audio', false)
            ->where('is_valid', true)
            ->where(function ($status) use ($pendingStatus): void {
                $status->whereNull('tts_status')->orWhere('tts_status', $pendingStatus);
            })
            ->where('tts_attempts', '<', $maximumAttempts)
            ->orderByDesc('query_count');
        self::applyClaimableTtsLock($query, $staleBefore, $assistStaleBefore, $assistWorkerPrefix);

        return $query->limit($limit)->get(['id', 'content', 'md5']);
    }

    public static function claimTtsRow(
        string $language,
        int $rowId,
        string $workerId,
        string $pendingStatus,
        string $processingStatus,
        $staleBefore,
        $assistStaleBefore,
        string $assistWorkerPrefix
    ): bool {
        $model = self::forLanguage($language);
        $query = $model->newQuery()
            ->where('id', $rowId)
            ->where('has_audio', false)
            ->where(function ($status) use (
                $pendingStatus,
                $processingStatus,
                $staleBefore,
                $assistStaleBefore,
                $assistWorkerPrefix
            ): void {
                $status->whereNull('tts_status')
                    ->orWhere('tts_status', $pendingStatus)
                    ->orWhere(function ($processing) use (
                        $processingStatus,
                        $staleBefore,
                        $assistStaleBefore,
                        $assistWorkerPrefix
                    ): void {
                        $processing->where('tts_status', $processingStatus);
                        self::applyClaimableTtsLock(
                            $processing,
                            $staleBefore,
                            $assistStaleBefore,
                            $assistWorkerPrefix
                        );
                    });
            });

        return $query->update([
            'tts_status' => $processingStatus,
            'tts_locked_at' => now(),
            'tts_locked_by' => $workerId,
            'tts_requested_at' => $model->getConnection()->raw('COALESCE(tts_requested_at, CURRENT_TIMESTAMP)'),
        ]) === 1;
    }

    public static function findByContent(string $langCode, string $content)
    {
        $md5 = md5($content);
        return self::findByMd5($langCode, $md5);
    }

    public static function rowsByHashes(string $language, array $hashes, array $columns = ['*'])
    {
        return self::rowsByColumnValues($language, 'md5', $hashes, $columns);
    }

    public static function rowsByLanguageHashes(array $hashesByLanguage, array $columns = ['*']): array
    {
        $rowsByLanguage = [];

        foreach ($hashesByLanguage as $language => $hashes) {
            $rowsByLanguage[$language] = self::rowsByHashes($language, $hashes, $columns)->keyBy('md5');
        }

        return $rowsByLanguage;
    }

    public static function queriedRowsByContents(string $language, array $contents): array
    {
        $hashes = [];
        $queryCounts = [];
        $rows = null;
        $rowsByHash = [];

        foreach ($contents as $content) {
            if (is_string($content)) {
                $hash = md5($content);
                $hashes[] = $hash;
                $queryCounts[$hash] = ($queryCounts[$hash] ?? 0) + 1;
            }
        }

        $hashes = array_values(array_unique($hashes));
        if ($hashes === []) {
            return [];
        }

        $rows = self::rowsByHashes($language, $hashes);
        foreach ($rows as $row) {
            $rowsByHash[(string) $row->md5] = $row;
        }

        if ($rowsByHash !== []) {
            self::incrementQueryCounts($language, array_intersect_key($queryCounts, $rowsByHash));
        }

        return $rowsByHash;
    }

    private static function incrementQueryCounts(string $language, array $countsByHash): void
    {
        $model = self::forLanguage($language);
        $connection = $model->getConnection();
        $table = $connection->getQueryGrammar()->wrapTable($model->getTable());

        foreach (array_chunk($countsByHash, self::QUERY_CHUNK_SIZE, true) as $chunk) {
            $valueClauses = [];
            $bindings = [];

            foreach ($chunk as $hash => $count) {
                $valueClauses[] = '(?::text, ?::integer)';
                $bindings[] = $hash;
                $bindings[] = $count;
            }

            $values = implode(', ', $valueClauses);
            $connection->update(
                "UPDATE {$table} AS dictionary SET query_count = COALESCE(dictionary.query_count, 0) + requested.amount, last_query_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP FROM (VALUES {$values}) AS requested(md5, amount) WHERE dictionary.md5 = requested.md5",
                $bindings
            );
        }
    }

    public static function idMapByHashes(string $language, array $hashes): array
    {
        $map = [];
        foreach (self::rowsByHashes($language, $hashes, ['id', 'md5']) as $row) {
            $map[(string) $row->md5] = (int) $row->id;
        }

        return $map;
    }

    public static function existingHashes(string $language, array $hashes): array
    {
        $existing = [];
        foreach (array_chunk(array_values(array_unique($hashes)), self::QUERY_CHUNK_SIZE) as $chunk) {
            foreach (self::forLanguage($language)->whereIn('md5', $chunk)->pluck('md5') as $md5) {
                $existing[] = (string) $md5;
            }
        }

        return $existing;
    }

    public static function insertRows(string $language, array $rows): int
    {
        $inserted = 0;
        foreach (array_chunk($rows, 500) as $chunk) {
            $inserted += self::forLanguage($language)->newQuery()->insertOrIgnore($chunk);
        }

        return $inserted;
    }

    public static function ensureContents(string $language, array $contents): array
    {
        $contentByHash = [];
        $existingHashes = [];
        $existingLookup = [];
        $rows = [];
        $timestamp = now();
        $total = 0;
        $inserted = 0;

        foreach ($contents as $content) {
            if (!is_string($content) || $content === '') {
                continue;
            }

            $total++;
            $contentByHash[md5($content)] = $content;
        }

        if ($contentByHash === []) {
            return ['created' => 0, 'existing' => 0];
        }

        $existingHashes = self::existingHashes($language, array_keys($contentByHash));
        $existingLookup = array_fill_keys($existingHashes, true);

        foreach ($contentByHash as $hash => $content) {
            if (isset($existingLookup[$hash])) {
                continue;
            }

            $rows[] = [
                'content' => $content,
                'md5' => $hash,
                'has_translation' => false,
                'query_count' => 0,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        if ($rows !== []) {
            $inserted = self::insertRows($language, $rows);
        }
        if ($inserted > 0) {
            self::forgetMetricsCache($language);
        }

        return [
            'created' => $inserted,
            'existing' => max(0, $total - $inserted),
        ];
    }

    public static function applyExplanationResults(string $language, array $explanations, bool $isEnglish): array
    {
        $hashes = [];
        $rowsByHash = [];
        $updatesByHash = [];
        $timestamp = now();
        $processed = 0;
        $failed = 0;

        foreach ($explanations as $explanation) {
            $word = $explanation['word'] ?? null;
            $explanationText = $explanation['explanation'] ?? $explanation['translation'] ?? null;
            if (!$word || !$explanationText) {
                $failed++;
                continue;
            }

            $hashes[] = md5((string) $word);
        }

        foreach (self::rowsByHashes($language, $hashes) as $row) {
            $rowsByHash[(string) $row->md5] = $row;
        }

        foreach ($explanations as $explanation) {
            $word = $explanation['word'] ?? null;
            $explanationText = $explanation['explanation'] ?? $explanation['translation'] ?? null;
            if (!$word || !$explanationText) {
                continue;
            }

            $hash = md5((string) $word);
            $entry = $rowsByHash[$hash] ?? null;
            if (!$entry) {
                $failed++;
                continue;
            }

            $translations = $entry->translations;
            if (!is_array($translations)) {
                $translations = [];
            }

            $translations['en'] = $explanationText;
            if (!$isEnglish && isset($explanation['meaning_zh'])) {
                $translations['zh'] = $explanation['meaning_zh'];
            }

            $entry->translations = $translations;
            if ($isEnglish) {
                if (isset($explanation['us_phonetic'])) {
                    $entry->us_phonetic = $explanation['us_phonetic'];
                }
                if (isset($explanation['uk_phonetic'])) {
                    $entry->uk_phonetic = $explanation['uk_phonetic'];
                }
            } elseif (isset($explanation['pronunciation'])) {
                $entry->phonetic = $explanation['pronunciation'];
            }

            $updatesByHash[$hash] = [
                'content' => (string) $entry->content,
                'md5' => $hash,
                'translations' => json_encode($translations, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'has_translation' => true,
                'phonetic' => $entry->phonetic,
                'us_phonetic' => $entry->us_phonetic,
                'uk_phonetic' => $entry->uk_phonetic,
                'created_at' => $entry->created_at ?? $timestamp,
                'updated_at' => $timestamp,
            ];
            $processed++;
        }

        if ($updatesByHash !== []) {
            self::forLanguage($language)->newQuery()->upsert(
                array_values($updatesByHash),
                ['md5'],
                [
                    'translations', 'has_translation', 'phonetic',
                    'us_phonetic', 'uk_phonetic', 'updated_at',
                ]
            );
            self::forgetMetricsCache($language);
        }

        return ['processed' => $processed, 'failed' => $failed];
    }

    public static function rowsByIds(string $language, array $ids, array $columns = ['*'])
    {
        return self::rowsByColumnValues($language, 'id', $ids, $columns);
    }

    private static function rowsByColumnValues(
        string $language,
        string $column,
        array $values,
        array $columns
    ) {
        $model = self::forLanguage($language);
        $rows = $model->newCollection();
        $uniqueValues = array_values(array_unique($values));

        foreach (array_chunk($uniqueValues, self::QUERY_CHUNK_SIZE) as $chunk) {
            $rows = $rows->concat(
                $model->newQuery()->whereIn($column, $chunk)->get($columns)
            );
        }

        return $rows;
    }

    public static function wrappedRowsFromId(
        string $language,
        int $startId,
        int $limit,
        array $columns = ['*']
    ) {
        $rows = self::forLanguage($language)
            ->where('id', '>=', $startId)
            ->orderBy('id')
            ->limit($limit)
            ->get($columns);
        $deficit = $limit - $rows->count();

        if ($deficit > 0) {
            $rows = $rows->concat(
                self::forLanguage($language)
                    ->where('id', '<', $startId)
                    ->orderBy('id')
                    ->limit($deficit)
                    ->get($columns)
            );
        }

        return $rows;
    }

    public static function prefixRows(string $language, string $prefix, int $limit)
    {
        return self::forLanguage($language)
            ->contentStartsWithInsensitive($prefix)
            ->limit($limit)
            ->get();
    }

    public static function untranslatedContents(string $language, int $offset, int $limit): array
    {
        return self::forLanguage($language)
            ->where('has_translation', false)
            ->where('is_valid', true)
            ->orderByDesc('query_count')
            ->offset($offset)
            ->limit($limit)
            ->pluck('content')
            ->all();
    }

    public static function missingAudioCount(string $language): int
    {
        return self::forLanguage($language)->where('has_audio', false)->count();
    }

    public static function rowCount(string $language): int
    {
        return self::forLanguage($language)->count();
    }

    public static function translatedCount(string $language): int
    {
        return self::forLanguage($language)->where('has_translation', true)->count();
    }

    public static function untranslatedRows(string $language, int $limit)
    {
        return self::forLanguage($language)
            ->where('has_translation', false)
            ->where('is_valid', true)
            ->orderByDesc('query_count')
            ->limit($limit)
            ->get();
    }

    public static function idBounds(string $language): array
    {
        $row = self::forLanguage($language)
            ->newQuery()
            ->selectRaw('MIN(id) as min_id, MAX(id) as max_id')
            ->first();

        return [
            'min' => (int) ($row->min_id ?? 0),
            'max' => (int) ($row->max_id ?? 0),
        ];
    }

    public static function languageColumns(string $language, array $columns): array
    {
        return self::languageColumnAvailability($language, $columns);
    }

    public static function lockedRowsByHashes(string $language, array $hashes)
    {
        return self::forLanguage($language)
            ->newQuery()
            ->whereIn('md5', array_values(array_unique($hashes)))
            ->lockForUpdate()
            ->get()
            ->keyBy('md5');
    }

    public static function lockByHash(string $language, string $hash): ?self
    {
        return self::forLanguage($language)
            ->newQuery()
            ->where('md5', $hash)
            ->lockForUpdate()
            ->first();
    }

    public function hasTableColumn(string $column): bool
    {
        return Schema::connection($this->getConnectionName())->hasColumn($this->getTable(), $column);
    }

    public static function updateValidWordText(string $language, string $hash, string $content): int
    {
        return self::forLanguage($language)
            ->newQuery()
            ->where('md5', $hash)
            ->where(function ($valid): void {
                $valid->whereNull('is_valid')->orWhere('is_valid', true);
            })
            ->update(['content' => $content]);
    }

    public static function missingAudioBatchRows(string $language, int $limit, array $columns)
    {
        $query = self::forLanguage($language)->newQuery();

        if ($columns['has_audio']) {
            $query->where('has_audio', false);
        }
        if ($columns['is_valid']) {
            $query->where(function ($valid): void {
                $valid->where('is_valid', true)->orWhereNull('is_valid');
            });
        }
        if ($columns['tts_status']) {
            $query->where(function ($status): void {
                $status->whereNull('tts_status')->orWhere('tts_status', '!=', 'failed');
            });
        }
        if ($columns['audio_files']) {
            $query->missingAudioFiles();
        }
        if ($columns['tts_files']) {
            $query->missingTtsFiles();
        }
        if ($columns['content']) {
            $query->wordLength();
        }

        return $query->orderBy('id')->limit($limit)->get();
    }

    public static function createOrFind(string $langCode, string $content): self
    {
        $md5 = md5($content);

        $existing = self::findByMd5($langCode, $md5);
        if ($existing) {
            return $existing;
        }

        $instance = self::forLanguage($langCode);
        $instance->content = $content;
        $instance->md5 = $md5;
        $instance->has_translation = false;
        $instance->query_count = 0;
        $instance->save();

        // New row changes the dictionary count -> invalidate metrics.
        self::forgetMetricsCache($langCode);

        return $instance;
    }

    public static function storeTranslationCache(
        string $langCode,
        string $content,
        string $cacheKey,
        array $cacheValue,
        string $provider
    ): void {
        $model = self::forLanguage($langCode);
        $hash = md5($content);

        $model->getConnection()->transaction(function () use (
            $langCode,
            $content,
            $cacheKey,
            $cacheValue,
            $provider,
            $hash
        ): void {
            $entry = self::lockByHash($langCode, $hash);
            if (!$entry) {
                $entry = self::forLanguage($langCode);
                $entry->content = $content;
                $entry->md5 = $hash;
                $entry->has_audio = false;
                $entry->query_count = 0;
            }

            $translations = is_array($entry->translations) ? $entry->translations : [];
            $translations[$cacheKey] = $cacheValue;
            $entry->translations = $translations;
            $entry->has_translation = true;
            $entry->translation_provider = $provider;
            $entry->saveRecord();
        });

        self::forgetMetricsCache($langCode);
    }

    public static function newImageQueueEntry(string $langCode, string $content): self
    {
        $entry = self::forLanguage($langCode);

        $entry->content = $content;
        $entry->md5 = md5($content);
        $entry->has_translation = false;
        $entry->has_audio = false;
        $entry->is_valid = true;
        $entry->query_count = 0;

        return $entry;
    }

    public function hasImageMcpSubmissionColumn(): bool
    {
        return $this->hasTableColumn('image_mcp_submitted_at');
    }

    public function markImagePending(bool $moveToFront, int $defaultPriority): void
    {
        $isNew = !$this->exists;

        $this->image_status = 'pending';
        if ($this->hasImageMcpSubmissionColumn()) {
            $this->image_mcp_submitted_at = null;
        }
        if (!$this->image_requested_at) {
            $this->image_requested_at = now();
        }

        $this->image_attempts = 0;
        $this->image_locked_at = null;
        $this->image_locked_by = null;

        if ($moveToFront) {
            $connection = $this->getConnection();
            $table = $this->getTable();

            $connection->transaction(function () use ($connection, $table): void {
                AppQyV1TableMaps::lockTableForFrontTicket($connection, $table);
                $this->image_priority = (int) $this->newQuery()->max('image_priority') + 1;
                $this->saveRecord();
            });
        } else {
            $this->image_priority = max((int) ($this->image_priority ?? 0), $defaultPriority);
            $this->saveRecord();
        }

        if ($isNew) {
            self::forgetMetricsCache((string) $this->langCode);
        }
    }

    public static function updateWord(string $langCode, string $md5, array $data): void
    {
        self::forLanguage($langCode)
            ->where('md5', $md5)
            ->update(array_merge($data, ['updated_at' => now()]));

        self::forgetMetricsCache($langCode);
    }

    /**
     * Explicitly record a third-party validity check for a single word.
     *
     * Validity is externally asserted: rows stay valid by default and only an
     * explicit check (typically a client that verifies the word online) can mark
     * one invalid. Returns true when a matching row was updated.
     */
    public static function markValidity(string $langCode, string $md5, bool $isValid, ?string $source = null, ?string $note = null): bool
    {
        $affected = self::forLanguage($langCode)
            ->where('md5', $md5)
            ->update([
                'is_valid' => $isValid,
                'validity_checked_at' => now(),
                'validity_source' => $source,
                'validity_note' => $note,
                'updated_at' => now(),
            ]);

        if ($affected > 0) {
            self::forgetMetricsCache($langCode);
        }

        return $affected > 0;
    }

    public static function markValidities(string $langCode, array $results): array
    {
        $model = self::forLanguage($langCode);
        $connection = $model->getConnection();
        $table = $connection->getQueryGrammar()->wrapTable($model->getTable());
        $recordsByHash = [];
        $existingRecords = [];
        $existingHashes = [];
        $existingLookup = [];
        $updated = 0;
        $valid = 0;
        $invalid = 0;

        foreach ($results as $result) {
            $hash = isset($result['md5']) ? strtolower((string) $result['md5']) : '';
            if ($hash === '') {
                continue;
            }

            $recordsByHash[$hash] = [
                'is_valid' => (bool) $result['is_valid'],
                'source' => $result['source'] ?? null,
                'note' => $result['note'] ?? null,
            ];
        }

        if ($recordsByHash === []) {
            return ['updated' => 0, 'valid' => 0, 'invalid' => 0];
        }

        $existingHashes = self::existingHashes($langCode, array_keys($recordsByHash));
        $existingLookup = array_fill_keys($existingHashes, true);

        foreach ($recordsByHash as $hash => $record) {
            if (!isset($existingLookup[$hash])) {
                continue;
            }

            $existingRecords[$hash] = $record;

            if ($record['is_valid']) {
                $valid++;
            } else {
                $invalid++;
            }
        }

        foreach (array_chunk($existingRecords, self::QUERY_CHUNK_SIZE, true) as $chunk) {
            $valueClauses = [];
            $bindings = [];

            foreach ($chunk as $hash => $record) {
                $valueClauses[] = '(?::text, ?::boolean, ?::text, ?::text)';
                $bindings[] = $hash;
                $bindings[] = $record['is_valid'];
                $bindings[] = $record['source'];
                $bindings[] = $record['note'];
            }

            $values = implode(', ', $valueClauses);
            $updated += $connection->update(
                "UPDATE {$table} AS dictionary SET is_valid = validity.is_valid, validity_checked_at = CURRENT_TIMESTAMP, validity_source = validity.source, validity_note = validity.note, updated_at = CURRENT_TIMESTAMP FROM (VALUES {$values}) AS validity(md5, is_valid, source, note) WHERE dictionary.md5 = validity.md5",
                $bindings
            );
        }

        if ($updated > 0) {
            self::forgetMetricsCache($langCode);
        }

        return [
            'updated' => $updated,
            'valid' => $valid,
            'invalid' => $invalid,
        ];
    }

    /**
     * Restrict to "sentence" rows: dictionary entries whose content length
     * falls in the sentence range (50 < LENGTH(content) < 500).
     *
     * LENGTH() has no native query-builder equivalent, so the comparison stays
     * in whereRaw.
     */
    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function sentenceLength(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereRaw('LENGTH(content) > 50')
            ->whereRaw('LENGTH(content) < 500');
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function contentContainsInsensitive(\Illuminate\Database\Eloquent\Builder $query, string $value): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereLike('content', "%{$value}%", caseSensitive: false);
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function contentStartsWithInsensitive(\Illuminate\Database\Eloquent\Builder $query, string $value): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereLike('content', "{$value}%", caseSensitive: false);
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function managementFilter(\Illuminate\Database\Eloquent\Builder $query, string $filter): \Illuminate\Database\Eloquent\Builder
    {
        if ($filter === 'with_translation') {
            return $query->withTranslationCoverage();
        }
        if ($filter === 'without_translation') {
            return $query->withoutTranslationCoverage();
        }
        if ($filter === 'with_audio') {
            return $query->where('has_audio', true);
        }
        if ($filter === 'without_audio') {
            return $query->where(function ($builder) {
                $builder->where('has_audio', false)->orWhereNull('has_audio');
            });
        }
        if ($filter === 'valid') {
            return $query->valid();
        }
        if ($filter === 'invalid') {
            return $query->invalid();
        }

        return $query;
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function managementOrder(\Illuminate\Database\Eloquent\Builder $query, string $sortKey, string $direction): \Illuminate\Database\Eloquent\Builder
    {
        $order = strtolower($direction) === 'desc' ? 'desc' : 'asc';

        if ($sortKey === 'id') {
            $query->orderBy('id', $order);
        } elseif ($sortKey === 'word') {
            $query->orderBy('content', $order);
        } elseif ($sortKey === 'translation') {
            $query->orderByRaw("LOWER(COALESCE(translations::text, '')) {$order}");
        } elseif ($sortKey === 'phonetic') {
            $query->orderByRaw("LOWER(COALESCE(NULLIF(us_phonetic, ''), NULLIF(uk_phonetic, ''), NULLIF(phonetic, ''), '')) {$order}");
        } elseif ($sortKey === 'us_phonetic') {
            $query->orderBy('us_phonetic', $order);
        } elseif ($sortKey === 'uk_phonetic') {
            $query->orderBy('uk_phonetic', $order);
        } elseif ($sortKey === 'audio') {
            $query->orderBy('has_audio', $order);
        } elseif ($sortKey === 'queries') {
            $query->orderBy('query_count', $order);
        } elseif ($sortKey === 'is_valid') {
            $query->orderBy('is_valid', $order);
        } else {
            return $query->orderByDesc('query_count')->orderBy('id');
        }

        return $sortKey === 'id' ? $query : $query->orderBy('id', $order);
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function wordLength(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereRaw('LENGTH(content) <= 50');
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function missingAudioFiles(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereRaw("(audio_files IS NULL OR audio_files::jsonb = '[]'::jsonb)");
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function missingTtsFiles(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereRaw("(tts_files IS NULL OR tts_files::jsonb = '[]'::jsonb)");
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function withTranslationCoverage(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where(function ($builder) {
            $builder->where('has_translation', true)
                ->orWhereRaw("translations IS NOT NULL AND translations <> '' AND translations <> '{}' AND translations <> '[]'");
        });
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function withoutTranslationCoverage(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where(function ($builder) {
            $builder->where(function ($flagQuery) {
                $flagQuery->where('has_translation', false)->orWhereNull('has_translation');
            })->whereRaw("(translations IS NULL OR translations = '' OR translations = '{}' OR translations = '[]')");
        });
    }

    public static function cachedPendingTranslationSummary(string $langCode): array
    {
        $cacheKey = 'appqyv1:wordtrans_pending_summary:' . strtolower($langCode);

        return Cache::flexible($cacheKey, [15, 60], static function () use ($langCode): array {
            $counts = self::forLanguage($langCode)
                ->newQuery()
                ->selectRaw('count(*) as total')
                ->selectRaw('sum(case when has_translation = false and is_valid = true then 1 else 0 end) as pending')
                ->selectRaw('sum(case when has_translation = true then 1 else 0 end) as completed')
                ->selectRaw('sum(case when is_valid = false then 1 else 0 end) as failed')
                ->first();

            return [
                'pending' => (int) ($counts->pending ?? 0),
                'completed' => (int) ($counts->completed ?? 0),
                'failed' => (int) ($counts->failed ?? 0),
                'total' => (int) ($counts->total ?? 0),
            ];
        });
    }

    public static function invalidCountsBySource(string $langCode)
    {
        return self::forLanguage($langCode)
            ->newQuery()
            ->invalid()
            ->groupBy('validity_source')
            ->selectRaw('validity_source, count(*) as total')
            ->pluck('total', 'validity_source');
    }

    public static function languageBreakdownMetrics(string $langCode): ?array
    {
        $model = self::forLanguage($langCode);
        $connectionName = $model->getConnectionName();
        $table = $model->getTable();

        if (!Schema::connection($connectionName)->hasTable($table)) {
            return null;
        }

        $hasValidity = Schema::connection($connectionName)->hasColumn($table, 'is_valid');
        $selects = [
            'COUNT(*) as words',
            "SUM(CASE WHEN has_translation = true OR (translations IS NOT NULL AND translations <> '' AND translations <> '{}' AND translations <> '[]') THEN 1 ELSE 0 END) as with_translation",
            'SUM(CASE WHEN has_audio = true THEN 1 ELSE 0 END) as with_audio',
            $hasValidity ? 'SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as invalid' : '0 as invalid',
        ];
        $row = $model->newQuery()->selectRaw(implode(', ', $selects))->first();

        $words = (int) ($row->words ?? 0);
        $withTranslation = (int) ($row->with_translation ?? 0);
        $withAudio = (int) ($row->with_audio ?? 0);
        $invalid = (int) ($row->invalid ?? 0);

        return [
            'words' => $words,
            'with_translation' => $withTranslation,
            'without_translation' => max(0, $words - $withTranslation),
            'with_audio' => $withAudio,
            'without_audio' => max(0, $words - $withAudio),
            'valid' => max(0, $words - $invalid),
            'invalid' => $invalid,
        ];
    }

    public static function cachedLanguageBreakdownMetrics(string $langCode): ?array
    {
        $languageCode = AppQyV1TableMaps::normalizeLangCode($langCode);

        return Cache::flexible(
            self::metricsCacheKey($languageCode),
            [60, self::METRICS_CACHE_TTL],
            static fn () => self::languageBreakdownMetrics($languageCode)
        );
    }

    public static function cachedManagementFilterTotal(string $langCode, string $filter): ?int
    {
        $metrics = self::cachedLanguageBreakdownMetrics($langCode);
        $metricByFilter = [
            'all' => 'words',
            'with_translation' => 'with_translation',
            'without_translation' => 'without_translation',
            'with_audio' => 'with_audio',
            'without_audio' => 'without_audio',
            'valid' => 'valid',
            'invalid' => 'invalid',
        ];
        if ($metrics === null || !isset($metricByFilter[$filter])) {
            return null;
        }

        return (int) $metrics[$metricByFilter[$filter]];
    }

    public static function coverageMetrics(string $langCode): ?array
    {
        $model = self::forLanguage($langCode);
        $connectionName = $model->getConnectionName();
        $table = $model->getTable();

        if (!Schema::connection($connectionName)->hasTable($table)) {
            return null;
        }

        $hasValidity = Schema::connection($connectionName)->hasColumn($table, 'is_valid');
        $selects = [
            'COUNT(*) as total',
            "SUM(CASE WHEN has_translation = true OR (translations IS NOT NULL AND translations <> '' AND translations <> '{}' AND translations <> '[]') THEN 1 ELSE 0 END) as with_translation",
            'SUM(CASE WHEN has_audio = true THEN 1 ELSE 0 END) as with_audio',
            "SUM(CASE WHEN image_files IS NOT NULL AND image_files <> '' AND image_files <> '{}' AND image_files <> '[]' THEN 1 ELSE 0 END) as with_images",
            $hasValidity ? 'SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as invalid_words' : '0 as invalid_words',
            $hasValidity ? 'SUM(CASE WHEN validity_checked_at IS NOT NULL THEN 1 ELSE 0 END) as validity_checked' : '0 as validity_checked',
        ];
        $row = $model->newQuery()->selectRaw(implode(', ', $selects))->first();

        return [
            'total' => (int) ($row->total ?? 0),
            'with_translation' => (int) ($row->with_translation ?? 0),
            'with_audio' => (int) ($row->with_audio ?? 0),
            'with_images' => (int) ($row->with_images ?? 0),
            'invalid_words' => (int) ($row->invalid_words ?? 0),
            'validity_checked' => (int) ($row->validity_checked ?? 0),
        ];
    }

    public static function cachedCoverageMetrics(string $langCode): ?array
    {
        return Cache::flexible(
            self::coverageCacheKey($langCode),
            [60, self::METRICS_CACHE_TTL],
            static fn () => self::coverageMetrics($langCode)
        );
    }

    public static function coverageMetricsForIds(string $langCode, array $ids): array
    {
        $model = self::forLanguage($langCode);
        $connectionName = $model->getConnectionName();
        $table = $model->getTable();
        $stats = ['translated' => 0, 'with_audio' => 0, 'with_image' => 0, 'invalid' => 0];

        if (empty($ids) || !Schema::connection($connectionName)->hasTable($table)) {
            return $stats;
        }

        $hasValidity = Schema::connection($connectionName)->hasColumn($table, 'is_valid');
        $selects = [
            "SUM(CASE WHEN has_translation = true OR (translations IS NOT NULL AND translations <> '' AND translations <> '{}' AND translations <> '[]') THEN 1 ELSE 0 END) as translated",
            'SUM(CASE WHEN has_audio = true THEN 1 ELSE 0 END) as with_audio',
            "SUM(CASE WHEN image_files IS NOT NULL AND image_files <> '' AND image_files <> '{}' AND image_files <> '[]' THEN 1 ELSE 0 END) as with_image",
            $hasValidity ? 'SUM(CASE WHEN is_valid = false THEN 1 ELSE 0 END) as invalid' : '0 as invalid',
        ];

        foreach (array_chunk($ids, 1000) as $chunk) {
            $row = $model->newQuery()->whereIn('id', $chunk)->selectRaw(implode(', ', $selects))->first();
            if ($row === null) {
                continue;
            }
            $stats['translated'] += (int) $row->translated;
            $stats['with_audio'] += (int) $row->with_audio;
            $stats['with_image'] += (int) $row->with_image;
            $stats['invalid'] += (int) $row->invalid;
        }

        return $stats;
    }

    public static function cachedSystemInitStats(string $langCode, int $ttlSeconds): array
    {
        $cacheKey = self::sysInitStatsCacheKey($langCode);

        return Cache::remember($cacheKey, $ttlSeconds, static function () use ($langCode): array {
            $zero = [
                'table_exists' => false,
                'words' => 0,
                'sentences' => 0,
                'audio' => 0,
                'complete_words' => 0,
                'missing_translation' => 0,
                'missing_phonetic' => 0,
                'missing_audio' => 0,
                'missing_images' => 0,
                'complete_sentences' => 0,
                'missing_sentence_translation' => 0,
                'missing_sentence_audio' => 0,
            ];
            $model = self::forLanguage($langCode);
            $connectionName = $model->getConnectionName();
            $table = $model->getTable();

            if (!Schema::connection($connectionName)->hasTable($table)) {
                return $zero;
            }

            $isSentence = 'LENGTH(content) > 50 AND LENGTH(content) < 500';
            $hasTranslation = "(has_translation = true OR (translations IS NOT NULL AND translations <> '' AND translations <> '{}' AND translations <> '[]'))";
            $missingTranslation = "(has_translation = false OR translations IS NULL OR translations = '' OR translations = '{}' OR translations = '[]')";
            $missingPhonetic = "((us_phonetic IS NULL OR us_phonetic = '') AND (uk_phonetic IS NULL OR uk_phonetic = ''))";
            $missingAudio = "(has_audio = false OR tts_files IS NULL OR tts_files = '' OR tts_files = '{}' OR tts_files = '[]')";
            $missingImages = "(image_files IS NULL OR image_files = '' OR image_files = '{}' OR image_files = '[]')";
            $selects = implode(', ', [
                'COUNT(*) as words',
                "SUM(CASE WHEN {$isSentence} THEN 1 ELSE 0 END) as sentences",
                'SUM(CASE WHEN has_audio = true THEN 1 ELSE 0 END) as audio',
                "SUM(CASE WHEN {$hasTranslation} THEN 1 ELSE 0 END) as complete_words",
                "SUM(CASE WHEN {$missingTranslation} THEN 1 ELSE 0 END) as missing_translation",
                "SUM(CASE WHEN {$missingPhonetic} THEN 1 ELSE 0 END) as missing_phonetic",
                "SUM(CASE WHEN {$missingAudio} THEN 1 ELSE 0 END) as missing_audio",
                "SUM(CASE WHEN {$missingImages} THEN 1 ELSE 0 END) as missing_images",
                "SUM(CASE WHEN {$isSentence} AND {$hasTranslation} THEN 1 ELSE 0 END) as complete_sentences",
                "SUM(CASE WHEN {$isSentence} AND {$missingTranslation} THEN 1 ELSE 0 END) as missing_sentence_translation",
                "SUM(CASE WHEN {$isSentence} AND {$missingAudio} THEN 1 ELSE 0 END) as missing_sentence_audio",
            ]);
            $row = $model->newQuery()->selectRaw($selects)->first();

            if ($row === null) {
                return array_merge($zero, ['table_exists' => true]);
            }

            return [
                'table_exists' => true,
                'words' => (int) $row->words,
                'sentences' => (int) $row->sentences,
                'audio' => (int) $row->audio,
                'complete_words' => (int) $row->complete_words,
                'missing_translation' => (int) $row->missing_translation,
                'missing_phonetic' => (int) $row->missing_phonetic,
                'missing_audio' => (int) $row->missing_audio,
                'missing_images' => (int) $row->missing_images,
                'complete_sentences' => (int) $row->complete_sentences,
                'missing_sentence_translation' => (int) $row->missing_sentence_translation,
                'missing_sentence_audio' => (int) $row->missing_sentence_audio,
            ];
        });
    }

    /** Only words explicitly marked invalid by a third-party check. */
    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function invalid(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('is_valid', false);
    }

    /** Words that are valid (default state, i.e. not explicitly invalid). */
    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function valid(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where(function ($builder) {
            $builder->where('is_valid', true)->orWhereNull('is_valid');
        });
    }

    /** Words a third-party client has not yet checked. */
    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function validityUnchecked(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->whereNull('validity_checked_at');
    }

    public static function pendingValidityCount(string $langCode, string $search = ''): int
    {
        return (int) self::pendingValidityQuery($langCode, $search)->count();
    }

    public static function pendingValidityPageIds(
        string $langCode,
        string $search,
        int $start,
        int $limit
    ): array {
        return self::pendingValidityQuery($langCode, $search)
            ->orderByDesc('query_count')
            ->orderBy('id')
            ->offset($start)
            ->limit($limit)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    public static function pendingValidityRows(string $langCode, array $ids): array
    {
        $positions = array_flip(array_map('intval', $ids));

        return self::forLanguage($langCode)
            ->newQuery()
            ->whereIn('id', $ids)
            ->get(['id', 'content', 'md5', 'query_count', 'has_translation', 'validity_checked_at'])
            ->sortBy(static fn ($row): int => $positions[(int) $row->id] ?? PHP_INT_MAX)
            ->map(static fn ($row): array => [
                'id' => (int) $row->id,
                'word' => (string) $row->content,
                'md5' => (string) $row->md5,
                'language' => strtolower($langCode),
                'query_count' => (int) ($row->query_count ?? 0),
                'needs_validity' => $row->validity_checked_at === null,
                'needs_translation' => !(bool) $row->has_translation,
            ])
            ->values()
            ->all();
    }

    public static function pendingTranslationRows(
        string $langCode,
        array $ids,
        bool $includeQueryCount = false
    ): array {
        $columns = ['id', 'content', 'md5'];
        if ($includeQueryCount) {
            $columns[] = 'query_count';
        }

        return self::forLanguage($langCode)
            ->newQuery()
            ->whereIn('id', $ids)
            ->where('has_translation', false)
            ->where('is_valid', true)
            ->orderByDesc('query_count')
            ->get($columns)
            ->map(static function ($row) use ($includeQueryCount): array {
                $result = [
                    'word' => (string) ($row->content ?? ''),
                    'md5' => (string) ($row->md5 ?? ''),
                ];
                if ($includeQueryCount) {
                    $result['query_count'] = (int) ($row->query_count ?? 0);
                }

                return $result;
            })
            ->filter(static fn (array $row): bool => $row['word'] !== '')
            ->values()
            ->all();
    }

    public static function pendingValidityScanRows(string $langCode, array $ids): array
    {
        return self::forLanguage($langCode)
            ->newQuery()
            ->whereIn('id', $ids)
            ->where('has_translation', false)
            ->whereNull('validity_checked_at')
            ->orderByDesc('query_count')
            ->get(['id', 'content', 'md5'])
            ->map(static fn ($row): array => [
                'word' => (string) ($row->content ?? ''),
                'md5' => (string) ($row->md5 ?? ''),
            ])
            ->filter(static fn (array $row): bool => $row['word'] !== '')
            ->values()
            ->all();
    }

    public static function pendingTtsRowsByIds(
        string $langCode,
        array $ids,
        string $pendingStatus,
        int $maxAttempts,
        int $lockStaleMinutes,
        int $assistLeaseMinutes,
        string $assistWorkerPrefix
    ): array {
        $staleBefore = now()->subMinutes($lockStaleMinutes);
        $assistStaleBefore = now()->subMinutes($assistLeaseMinutes);

        return self::forLanguage($langCode)
            ->newQuery()
            ->whereIn('id', $ids)
            ->where('has_audio', false)
            ->where('is_valid', true)
            ->where(function (Builder $query) use ($pendingStatus): void {
                $query->whereNull('tts_status')->orWhere('tts_status', $pendingStatus);
            })
            ->where('tts_attempts', '<', $maxAttempts)
            ->where(function (Builder $query) use ($staleBefore, $assistStaleBefore, $assistWorkerPrefix): void {
                $query->whereNull('tts_locked_at')
                    ->orWhere('tts_locked_at', '<', $assistStaleBefore)
                    ->orWhere(function (Builder $staleQuery) use ($staleBefore, $assistWorkerPrefix): void {
                        $staleQuery->where('tts_locked_at', '<', $staleBefore)
                            ->where(function (Builder $workerQuery) use ($assistWorkerPrefix): void {
                                $workerQuery->whereNull('tts_locked_by')
                                    ->orWhere('tts_locked_by', 'not like', $assistWorkerPrefix . '%');
                            });
                    });
            })
            ->orderByDesc('query_count')
            ->get(['id', 'content', 'md5'])
            ->all();
    }

    public static function translatedWordsMissingImages(string $langCode, array $ids): array
    {
        $availability = self::languageColumnAvailability(
            $langCode,
            ['image_status', 'image_mcp_submitted_at']
        );
        $query = self::forLanguage($langCode)
            ->newQuery()
            ->whereIn('id', $ids)
            ->where('has_translation', true)
            ->where('is_valid', true);

        if ($availability['image_mcp_submitted_at'] ?? false) {
            $query->whereNull('image_mcp_submitted_at');
        } else {
            $query->where(function (Builder $imageQuery): void {
                $imageQuery->whereNull('image_files')
                    ->orWhere('image_files', '')
                    ->orWhere('image_files', '[]')
                    ->orWhere('image_files', '{}');
            });
            if ($availability['image_status'] ?? false) {
                $query->where(function (Builder $statusQuery): void {
                    $statusQuery->whereNull('image_status')
                        ->orWhereNotIn('image_status', ['completed', 'none']);
                });
            }
        }

        return $query
            ->orderByDesc('query_count')
            ->get(['content', 'md5'])
            ->map(static function ($row): ?array {
                $word = $row->content ?? null;

                return is_string($word) && $word !== ''
                    ? ['word' => $word, 'md5' => $row->md5 ?? md5($word)]
                    : null;
            })
            ->filter()
            ->values()
            ->all();
    }

    private static function pendingValidityQuery(string $langCode, string $search): Builder
    {
        $query = self::forLanguage($langCode)
            ->newQuery()
            ->where(function (Builder $builder): void {
                $builder->whereNull('validity_checked_at')
                    ->orWhere(function (Builder $untranslated): void {
                        $untranslated->where('has_translation', false)
                            ->where('is_valid', true);
                    });
            });

        if ($search !== '') {
            $query->whereLike('content', '%' . $search . '%', caseSensitive: false);
        }

        return $query;
    }

    public function incrementQueryCount(): void
    {
        // One UPDATE statement: Eloquent's increment() applies the extra columns
        // in the same query, so the counter bump and the last_query_time stamp no
        // longer cost two separate round-trips per word lookup.
        $this->increment('query_count', 1, ['last_query_time' => now()]);
    }

    public static function tableRowCount(string $table): ?int
    {
        $model = new self();
        $connectionName = $model->getConnectionName();

        if (!Schema::connection($connectionName)->hasTable($table)) {
            return null;
        }

        return (int) $model->getConnection()->table($table)->count();
    }

    public static function languageTableExists(string $langCode): bool
    {
        $model = self::forLanguage($langCode);

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function languageColumnAvailability(string $langCode, array $columns): array
    {
        $model = self::forLanguage($langCode);
        $schema = Schema::connection($model->getConnectionName());
        $table = $model->getTable();
        $availability = [];

        if (!$schema->hasTable($table)) {
            return array_fill_keys($columns, false);
        }

        foreach ($columns as $column) {
            $availability[$column] = $schema->hasColumn($table, $column);
        }

        return $availability;
    }

    public static function exportRowsByIds(string $langCode, array $ids): array
    {
        $model = self::forLanguage($langCode);
        $rowsById = [];

        foreach (array_chunk($ids, 1000) as $chunk) {
            $rows = $model->getConnection()
                ->table($model->getTable())
                ->whereIn('id', $chunk)
                ->get(['id', 'content', 'translations', 'us_phonetic', 'uk_phonetic']);

            foreach ($rows as $row) {
                $rowsById[(int) $row->id] = $row;
            }
        }

        return $rowsById;
    }

    public function addTTSFile(string $path, string $speedKey = 'p0pct', string $type = 'word'): void
    {
        $ttsFiles = $this->tts_files ?? [];

        $ttsFiles[] = [
            'path' => $path,
            'speed_key' => $speedKey,
            'type' => $type,
            'provider' => 'edge-tts',
            'created_at' => now()->toDateTimeString(),
        ];

        $this->tts_files = $ttsFiles;
        $this->tts_provider = 'edge-tts';
        $this->save();
    }

    public function getTTSFile(string $speedKey = 'p0pct'): ?array
    {
        if (empty($this->tts_files)) {
            return null;
        }

        foreach ($this->tts_files as $ttsFile) {
            if (isset($ttsFile['speed_key']) && $ttsFile['speed_key'] === $speedKey) {
                return $ttsFile;
            }
        }

        return null;
    }

    public function hasTTSFile(string $speedKey = 'p0pct'): bool
    {
        return $this->getTTSFile($speedKey) !== null;
    }

    public static function getWordsWithoutTTS(string $langCode, int $limit = 20, bool $skipQueued = true): \Illuminate\Database\Eloquent\Collection
    {
        // Queue-less coordination: "queued" now means an unstale processing
        // claim on the row itself (tts_status/tts_locked_at) — the old
        // tts_queue cross-check is gone with the table.
        $query = self::forLanguage($langCode)
            ->where('has_audio', false);

        if ($skipQueued) {
            $staleBefore = now()->subMinutes(10);
            $query->where(function ($q) use ($staleBefore) {
                $q->whereNull('tts_status')
                    ->orWhere('tts_status', 'pending')
                    ->orWhere(function ($qq) use ($staleBefore) {
                        $qq->where('tts_status', 'processing')
                            ->where('tts_locked_at', '<', $staleBefore);
                    });
            });
        }

        return $query->orderBy('query_count', 'desc')
            ->limit($limit)
            ->get();
    }
}
