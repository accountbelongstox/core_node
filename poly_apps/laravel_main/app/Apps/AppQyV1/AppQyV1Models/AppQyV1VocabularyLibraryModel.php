<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Collection;
use App\Utils\RunsModelTransactions;

/**
 * Vocabulary library - the ONLY membership store after the Wave A
 * consolidation (AppQyV1_2026_06_12_15000x migrations):
 *  - word_ids: flat ordered array of per-language dictionary ids
 *    (app_qy_v1_tts_cache_{lang}.id). Libraries are single-language; the
 *    dictionary table is derived from the `language` column.
 *  - cover_*: absorbed from the dropped vocabulary_covers table.
 */
class AppQyV1VocabularyLibraryModel extends AppQyV1Model
{
    use HasFactory, RunsModelTransactions;

    public static function tableExistence(array $tableNames): array
    {
        $model = new self();
        $schema = $model->getConnection()->getSchemaBuilder();
        $results = [];

        foreach ($tableNames as $tableName) {
            $results[$tableName] = $schema->hasTable($tableName) ? 'exists' : 'missing';
        }

        return $results;
    }

    public static function sourceExists(string $source): bool
    {
        return self::query()->where('source', $source)->exists();
    }

    public static function populatedLibraryExists(): bool
    {
        return self::query()->whereNotNull('word_ids')->exists();
    }

    /**
     * Canonical language name <-> code map. Library rows store the full
     * lowercase name in `language` ('english'); dictionary tables and
     * group_words/user_word_progress rows use the 2-letter code ('en').
     */
    public const LANGUAGE_NAME_TO_CODE = [
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


    protected ?string $appTableSuffix = 'vocabulary_libraries';

    protected $fillable = [
        'name',
        'description',
        'language',
        'total_words',
        'is_public',
        'owner_user_id',
        'source',
        'difficulty_level',
        'category',
        'image_url',
        'is_recommended',
        'tags',
        'word_ids',
        'cover_filename',
        'cover_status',
        'cover_prompt',
        'cover_priority',
        'cover_attempts',
        'cover_error_message',
        'cover_width',
        'cover_height',
        'cover_last_requested_at',
        'cover_last_generated_at',
        'cover_started_at',
        'cover_finished_at',
        'cover_provider',
        'cover_model',
        'cover_latency_ms',
        'cover_mcp_submitted_at',
        'assist_claimed_at',
        'assist_claimed_by',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
            'is_recommended' => 'boolean',
            'tags' => 'array',
            'word_ids' => 'array',
            'cover_priority' => 'integer',
            'cover_attempts' => 'integer',
            'cover_width' => 'integer',
            'cover_height' => 'integer',
            'cover_last_requested_at' => 'datetime',
            'cover_last_generated_at' => 'datetime',
            'cover_started_at' => 'datetime',
            'cover_finished_at' => 'datetime',
            'cover_latency_ms' => 'integer',
            'cover_mcp_submitted_at' => 'datetime',
            'assist_claimed_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /** Map a full language name ('english') to its 2-letter code ('en'). */
    public static function languageNameToCode(string $language): ?string
    {
        $key = strtolower(trim($language));
        if (isset(self::LANGUAGE_NAME_TO_CODE[$key])) {
            return self::LANGUAGE_NAME_TO_CODE[$key];
        }
        // Already a known code ('en') - pass through.
        if (in_array($key, self::LANGUAGE_NAME_TO_CODE, true)) {
            return $key;
        }
        return null;
    }

    /** Map a 2-letter code ('en') to the canonical full name ('english'). */
    public static function languageCodeToName(string $code): ?string
    {
        $key = strtolower(trim($code));
        $flipped = array_flip(self::LANGUAGE_NAME_TO_CODE);
        if (isset($flipped[$key])) {
            return $flipped[$key];
        }
        // Already a known full name - pass through.
        if (isset(self::LANGUAGE_NAME_TO_CODE[$key])) {
            return $key;
        }
        return null;
    }

    /** 2-letter dictionary language code for this library row. */
    public function languageCode(): ?string
    {
        return self::languageNameToCode((string) $this->language);
    }

    /** word_ids as a plain int array ([] when unset/never converted). */
    public function getWordIdsArray(): array
    {
        $ids = $this->word_ids;
        if (!is_array($ids)) {
            return [];
        }
        return array_map('intval', $ids);
    }

    public static function recoverCoverMaintenance(
        int $maxRetries,
        $failedBefore,
        $leaseBefore
    ): array {
        $model = new static();

        return $model->getConnection()->transaction(static function () use (
            $maxRetries,
            $failedBefore,
            $leaseBefore
        ): array {
            $failed = self::query()
                ->whereNotNull('cover_filename')
                ->where('cover_status', 'failed')
                ->where('cover_attempts', '>=', $maxRetries)
                ->where('cover_finished_at', '<=', $failedBefore)
                ->update([
                    'cover_status' => 'pending',
                    'cover_attempts' => 0,
                    'cover_error_message' => null,
                    'assist_claimed_at' => null,
                    'assist_claimed_by' => null,
                ]);
            $processing = self::query()
                ->whereNotNull('cover_filename')
                ->where('cover_status', 'processing')
                ->where('cover_started_at', '<=', $leaseBefore)
                ->update([
                    'cover_status' => 'pending',
                    'assist_claimed_at' => null,
                    'assist_claimed_by' => null,
                ]);
            $staleLeases = self::query()
                ->whereNotNull('assist_claimed_at')
                ->where('assist_claimed_at', '<', $leaseBefore)
                ->update([
                    'assist_claimed_at' => null,
                    'assist_claimed_by' => null,
                ]);

            return [
                'failed' => (int) $failed,
                'processing' => (int) $processing,
                'stale_leases' => (int) $staleLeases,
                'total' => (int) $failed + (int) $processing + (int) $staleLeases,
            ];
        }, 1);
    }

    public static function missingPublicCovers(int $limit)
    {
        return self::query()
            ->where('is_public', true)
            ->where(function ($query): void {
                $query->whereNull('cover_filename')->orWhere('cover_filename', '');
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    /**
     * Batch-fetch a page of this library's dictionary rows.
     *
     * Slices word_ids ($offset/$limit), runs ONE whereIn on the library
     * language's tts_cache_{lang} table and returns the rows re-ordered to
     * match the slice order (whereIn does not preserve order). Ids missing
     * from the dictionary (should not happen post-conversion) are skipped.
     *
     * @return Collection<int, AppQyV1LangDictionaryModel>
     */
    public function dictionaryWords(int $offset, int $limit): Collection
    {
        $slice = array_slice($this->getWordIdsArray(), $offset, $limit);
        if (empty($slice)) {
            return new Collection();
        }

        $langCode = $this->languageCode();
        if ($langCode === null) {
            return new Collection();
        }

        $rows = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->whereIn('id', $slice)
            ->get()
            ->keyBy('id');

        $ordered = new Collection();
        foreach ($slice as $id) {
            if ($rows->has($id)) {
                $ordered->push($rows->get($id));
            }
        }
        return $ordered;
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function public(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('is_public', true);
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function forLanguage(\Illuminate\Database\Eloquent\Builder $query, ?string $language): \Illuminate\Database\Eloquent\Builder
    {
        if ($language) {
            $query->where('language', $language);
        }

        return $query;
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function searchTextInsensitive(\Illuminate\Database\Eloquent\Builder $query, string $search): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where(function (\Illuminate\Database\Eloquent\Builder $builder) use ($search): void {
            $builder->whereLike('name', "%{$search}%", caseSensitive: false)
                ->orWhereLike('description', "%{$search}%", caseSensitive: false);
        });
    }

    public static function publicLanguageAggregates(?string $language = null)
    {
        return self::query()
            ->public()
            ->forLanguage($language)
            ->selectRaw('language, SUM(total_words) as total_words, COUNT(*) as libraries_count')
            ->groupBy('language')
            ->orderBy('language')
            ->get();
    }

    public static function promotePendingCovers(array $ids, bool $all): array
    {
        return self::runInTransaction(static function () use ($ids, $all): array {
            $head = self::query()
                ->orderByDesc('cover_priority')
                ->lockForUpdate()
                ->first(['cover_priority']);
            $ticket = (int) ($head->cover_priority ?? 0) + 1;
            $query = self::query()->whereIn('cover_status', ['pending', 'retry', 'failed']);

            if (!$all) {
                $query->whereIn('id', $ids);
            }

            $promoted = $query->update([
                'cover_priority' => $ticket,
                'cover_status' => 'pending',
                'assist_claimed_by' => null,
                'assist_claimed_at' => null,
            ]);

            return ['priority' => $ticket, 'promoted' => $promoted];
        });
    }

    /**
     * Get groups that use this library (many-to-many)
     */
    public function groups()
    {
        return $this->belongsToMany(
            AppQyV1WordGroupModel::class,
            $this->appTable('group_libraries'),
            'library_id',
            'group_id',
            'id',
            'id'
        )->withTimestamps()
         ->withPivot('added_at');
    }

    public static function requireById(int $libraryId): self
    {
        return self::query()->findOrFail($libraryId);
    }

    public static function findBySource(string $source): ?self
    {
        return self::query()->where('source', $source)->first();
    }

    public static function rowsBySources(array $sources)
    {
        return self::query()
            ->whereIn('source', array_values(array_unique($sources)))
            ->get()
            ->keyBy('source');
    }

    public static function findLegacyWithoutSource(string $language, string $name): ?self
    {
        return self::query()
            ->where('language', $language)
            ->where('name', $name)
            ->where(function ($query): void {
                $query->whereNull('source')->orWhere('source', '');
            })
            ->orderBy('id')
            ->first();
    }

    public static function updateById(int $libraryId, array $attributes): int
    {
        return self::query()->whereKey($libraryId)->update($attributes);
    }

    public static function publicRecommended(?string $language, int $limit)
    {
        return self::query()
            ->public()
            ->forLanguage($language)
            ->where('is_recommended', true)
            ->orderByDesc('total_words')
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function filteredPublicRows(
        ?string $language,
        ?string $category,
        ?string $difficulty,
        ?string $search
    ) {
        $query = self::query()->public()->forLanguage($language);

        if ($category !== null && $category !== '') {
            $query->where('category', $category);
        }
        if ($difficulty !== null && $difficulty !== '') {
            $query->where('difficulty_level', $difficulty);
        }
        if ($search !== null && $search !== '') {
            $query->searchTextInsensitive($search);
        }

        return $query
            ->orderByDesc('is_recommended')
            ->orderBy('difficulty_level')
            ->orderByDesc('total_words')
            ->orderBy('id')
            ->get();
    }

    public static function findPublicById(int $libraryId, bool $required = false): ?self
    {
        $query = self::query()->public();

        return $required ? $query->findOrFail($libraryId) : $query->find($libraryId);
    }

    public static function publicForLanguage(?string $language, array $columns = ['*'])
    {
        return self::query()->public()->forLanguage($language)->orderBy('id')->get($columns);
    }

    public static function recommendationsForLanguages(array $languages)
    {
        return self::query()
            ->public()
            ->whereIn('language', $languages)
            ->orderByDesc('is_recommended')
            ->orderByDesc('total_words')
            ->get();
    }

    public static function rowsByIds(array $ids)
    {
        return self::query()
            ->whereIn('id', $ids)
            ->orderByDesc('is_recommended')
            ->orderByDesc('total_words')
            ->get();
    }

    public static function learningLibraries(int $userId, string $language): array
    {
        return [
            'public' => self::query()->public()->forLanguage($language)->orderBy('name')->get(),
            'user' => self::query()
                ->where('owner_user_id', $userId)
                ->forLanguage($language)
                ->orderByDesc('created_at')
                ->get(),
        ];
    }

    public static function coverQueuePage(?string $status, int $start, int $limit, string $search, int $leaseMinutes): array
    {
        $query = self::query()->whereNotNull('cover_filename');

        if ($status === 'pending') {
            $query->whereIn('cover_status', ['pending', 'retry']);
        } elseif ($status === 'leased') {
            $query->whereNotNull('assist_claimed_at')
                ->where('assist_claimed_at', '>=', now()->subMinutes($leaseMinutes));
        } elseif ($status === 'processing') {
            $query->where('cover_status', 'processing');
        } elseif ($status === 'completed') {
            $query->where('cover_status', 'ready');
        } elseif ($status === 'failed') {
            $query->where('cover_status', 'failed');
        }
        if ($search !== '') {
            $query->whereLike('name', '%' . $search . '%', caseSensitive: false);
        }

        return [
            'total' => (int) (clone $query)->count(),
            'rows' => $query->orderByDesc('cover_priority')->offset($start)->limit($limit)
                ->get(['id', 'name', 'language', 'cover_status', 'cover_priority', 'assist_claimed_by', 'assist_claimed_at']),
        ];
    }

    public static function activeCoverSamples(int $limit)
    {
        return self::query()
            ->whereNotNull('cover_filename')
            ->whereIn('cover_status', ['pending', 'retry', 'processing'])
            ->orderByDesc('cover_priority')
            ->limit($limit)
            ->get(['id', 'name']);
    }

    public static function recentCoverFailures(int $limit)
    {
        return self::query()->where('cover_status', 'failed')->orderByDesc('cover_finished_at')
            ->limit($limit)->get(['id', 'name', 'cover_error_message', 'cover_finished_at']);
    }

    public static function resetFailedOrStaleCovers($staleBefore): int
    {
        return self::query()
            ->whereNotNull('cover_filename')
            ->where(function ($query) use ($staleBefore): void {
                $query->where('cover_status', 'failed')
                    ->orWhere(function ($staleQuery) use ($staleBefore): void {
                        $staleQuery->where('cover_status', 'processing')
                            ->where('cover_started_at', '<', $staleBefore);
                    });
            })
            ->update([
                'cover_status' => 'pending',
                'cover_attempts' => 0,
                'cover_error_message' => null,
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);
    }

    public static function clearExpiredAssistClaims($leaseFloor): int
    {
        return self::query()
            ->whereNotNull('assist_claimed_at')
            ->where('assist_claimed_at', '<', $leaseFloor)
            ->update(['assist_claimed_at' => null, 'assist_claimed_by' => null]);
    }

    public static function coverColumnAvailable(string $column): bool
    {
        $model = new static();

        return $model->getConnection()->getSchemaBuilder()->hasColumn($model->getTable(), $column);
    }

    public static function claimCoverRows(
        string $claimer,
        int $limit,
        int $retryDelayMinutes,
        int $leaseMinutes,
        bool $mcpMarkerSupported
    ) {
        return self::runInTransaction(static function () use (
            $claimer,
            $limit,
            $retryDelayMinutes,
            $leaseMinutes,
            $mcpMarkerSupported
        ) {
            $claimedAt = now();
            $claimedBy = mb_substr($claimer, 0, 64);
            $rows = self::query()
                ->whereNotNull('cover_filename')
                ->where(function ($status) use ($retryDelayMinutes, $mcpMarkerSupported): void {
                    $status->where('cover_status', 'pending')
                        ->orWhere(function ($retry) use ($retryDelayMinutes): void {
                            $retry->where('cover_status', 'retry')
                                ->where('cover_finished_at', '<=', now()->subMinutes($retryDelayMinutes));
                        });
                    if ($mcpMarkerSupported) {
                        $status->orWhereNull('cover_mcp_submitted_at');
                    }
                })
                ->where(function ($lease) use ($leaseMinutes): void {
                    $lease->whereNull('assist_claimed_at')
                        ->orWhere('assist_claimed_at', '<', now()->subMinutes($leaseMinutes));
                })
                ->orderByDesc('cover_priority')
                ->orderBy('cover_last_requested_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            if ($rows->isNotEmpty()) {
                self::query()->whereKey($rows->modelKeys())->update([
                    'assist_claimed_at' => $claimedAt,
                    'assist_claimed_by' => $claimedBy,
                ]);
                foreach ($rows as $row) {
                    $row->assist_claimed_at = $claimedAt;
                    $row->assist_claimed_by = $claimedBy;
                }
            }

            return $rows;
        });
    }

    public static function releaseCoverClaims(array $ids, string $error): int
    {
        $query = self::query()->whereIn('id', $ids)->whereNotNull('assist_claimed_at');

        $released = (clone $query)->where('cover_status', '!=', 'ready')->update([
            'cover_status' => 'retry',
            'cover_error_message' => mb_substr($error, 0, 2000),
            'cover_finished_at' => now(),
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);
        $released += $query->where('cover_status', 'ready')->update([
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);

        return $released;
    }

    public static function retryCoverRows(array $ids, bool $all): int
    {
        $query = self::query()
            ->whereNotNull('cover_filename')
            ->whereIn('cover_status', ['failed', 'retry']);
        if (!$all) {
            $query->whereIn('id', $ids);
        }

        return $query->update([
            'cover_status' => 'pending',
            'cover_error_message' => null,
            'cover_finished_at' => null,
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);
    }

    public static function coverRows(array $ids, bool $all, bool $failedOnly)
    {
        $query = self::query()->whereNotNull('cover_filename');
        if ($failedOnly) {
            $query->whereIn('cover_status', ['failed', 'retry']);
        }
        if (!$all) {
            $query->whereIn('id', $ids);
        }

        return $query->get();
    }

    public static function resetCoverRowsByIds(array $ids, bool $clearLifecycle = false): int
    {
        $attributes = [
            'cover_status' => 'pending',
            'cover_attempts' => 0,
            'cover_error_message' => null,
            'cover_last_generated_at' => null,
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ];

        if ($clearLifecycle) {
            $attributes['cover_started_at'] = null;
            $attributes['cover_finished_at'] = null;
        }

        return self::query()->whereKey($ids)->update($attributes);
    }

    public static function eachReadyCover(\Closure $callback): void
    {
        self::query()
            ->whereNotNull('cover_filename')
            ->where('cover_status', 'ready')
            ->select([
                'id', 'cover_filename', 'cover_status', 'cover_attempts',
                'cover_error_message', 'cover_last_generated_at',
                'assist_claimed_at', 'assist_claimed_by',
            ])
            ->chunkById(100, $callback);
    }

    public static function coverStatusTotals()
    {
        return self::query()
            ->whereNotNull('cover_filename')
            ->groupBy('cover_status')
            ->selectRaw('cover_status, count(*) as total')
            ->pluck('total', 'cover_status');
    }

    public static function leasedCoverCount($leaseFloor): int
    {
        return self::query()
            ->whereNotNull('cover_filename')
            ->whereIn('cover_status', ['pending', 'retry'])
            ->where('assist_claimed_at', '>=', $leaseFloor)
            ->count();
    }

    public static function systemImportedRows(?string $languageCode = null): array
    {
        $languageName = null;
        $query = self::query()->whereNull('owner_user_id');

        if ($languageCode !== null && $languageCode !== '') {
            $languageName = self::languageCodeToName($languageCode);
            if ($languageName !== null) {
                $query->where('language', $languageName);
            }
        }

        return $query->orderBy('name')->get()->toArray();
    }
}
