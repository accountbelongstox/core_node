<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Models;

use Closure;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1StudySourceQueries;
use App\Models\Concerns\QueriesDiffIdPages;
use App\Utils\RunsModelTransactions;

use Illuminate\Support\Facades\Schema;

class AppQyV1ArticleModel extends AppQyV1Model
{
    use AppQyV1StudySourceQueries, QueriesDiffIdPages, RunsModelTransactions;

    public const TYPE_DAILY = 'daily';
    public const SOURCE_AGENT_HISTORY = 'agent_history';

    protected const STUDY_SOURCE_KEY_COLUMN = 'article_id';
    protected const STUDY_SOURCE_COLUMNS = ['id', 'article_id', 'title', 'language', 'sentence_count'];

    
    protected ?string $appTableSuffix = 'articles';

    protected $fillable = [
        'article_id',
        'user_id',
        'title',
        'content',
        'title_md5',
        'content_md5',
        'canonical_article_id',
        'language',
        'article_type',
        'source',
        'difficulty_level',
        'word_count',
        'unique_word_count',
        'sentence_count',
        'is_daily_reading',
        'reading_date',
        'task_id',
        'tts_generated',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'is_daily_reading' => 'boolean',
            'tts_generated' => 'boolean',
            'reading_date' => 'date',
            'metadata' => 'array',
        ];
    }

    public function isAgentHistoryDaily(): bool
    {
        return $this->source === self::SOURCE_AGENT_HISTORY
            && $this->article_type === self::TYPE_DAILY;
    }

    public function isManagedDaily(): bool
    {
        return $this->isAgentHistoryDaily()
            || $this->source === self::TYPE_DAILY
            || $this->article_type === self::TYPE_DAILY
            || (bool) $this->is_daily_reading;
    }

    public static function identityHashes(string $title, string $content): array
    {
        return [
            'title_md5' => md5($title),
            'content_md5' => md5($content),
        ];
    }

    public static function migrateDailyShortTypeInPlace(): int
    {
        $model = new static();
        $schema = Schema::connection($model->getConnectionName());

        if (!$schema->hasTable($model->getTable())
            || !$schema->hasColumn($model->getTable(), 'article_type')) {
            return 0;
        }

        return static::query()
            ->where('article_type', 'daily_short')
            ->update(['article_type' => 'short']);
    }

    public static function managementPage(?string $category, int $offset, int $limit): array
    {
        $query = self::managementQuery($category);
        $canonicalQuery = null;
        $rows = null;
        $rawTotal = 0;
        $total = 0;

        $rawTotal = (clone $query)->count();
        $canonicalQuery = (clone $query)->whereNull('canonical_article_id');
        $total = (clone $canonicalQuery)->count();
        $rows = (clone $canonicalQuery)
            ->latest('id')
            ->offset($offset)
            ->limit($limit)
            ->get();

        return [
            'total' => $total,
            'raw_total' => $rawTotal,
            'statistics' => self::managementStatistics($canonicalQuery, $rawTotal),
            'rows' => $rows->all(),
        ];
    }

    private static function managementQuery(?string $category)
    {
        $query = self::query();

        if ($category !== null && $category !== '') {
            if ($category === 'daily') {
                $query->where(function ($daily): void {
                    $daily->where('source', 'daily')
                        ->orWhere('article_type', 'daily')
                        ->orWhere('is_daily_reading', true);
                });
            } else {
                $query->where('article_type', $category);
            }
        }

        return $query;
    }

    private static function managementStatistics($query, int $rawTotal): array
    {
        $rows = null;
        $total = 0;
        $multiSentence = 0;
        $rebuilt = 0;

        $rows = (clone $query)->select(['metadata'])->get();
        $total = $rows->count();
        foreach ($rows as $row) {
            $metadata = is_array($row->metadata) ? $row->metadata : [];
            if (($metadata['tts_chunked'] ?? false) === true) {
                $multiSentence++;
            }
            if (trim((string) ($metadata['audio_rebuilt_at'] ?? '')) !== '') {
                $rebuilt++;
            }
        }

        return [
            'total' => $total,
            'raw_total' => $rawTotal,
            'historical_duplicates' => max(0, $rawTotal - $total),
            'multi_sentence' => $multiSentence,
            'legacy_audio' => max(0, $total - $multiSentence),
            'rebuilt' => $rebuilt,
        ];
    }

    public static function managementCategoryRows()
    {
        return self::query()
            ->whereNull('canonical_article_id')
            ->select(['article_type', 'source', 'is_daily_reading'])
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy(['article_type', 'source', 'is_daily_reading'])
            ->get();
    }

    public static function findByArticleId(string $articleId): ?self
    {
        return self::query()->where('article_id', $articleId)->first();
    }

    public static function findAgentHistoryBySourceRecordId(string $sourceRecordId): ?self
    {
        $identityHash = hash('sha256', $sourceRecordId);
        $article = null;

        $article = self::query()
            ->where('source', self::SOURCE_AGENT_HISTORY)
            ->where('article_type', self::TYPE_DAILY)
            ->where(function ($query) use ($identityHash, $sourceRecordId): void {
                $query->where('metadata->idempotency_key_hash', $identityHash)
                    ->orWhere('metadata->source_record_id', $sourceRecordId)
                    ->orWhere('metadata->idempotency_key', $sourceRecordId)
                    ->orWhereJsonContains('metadata->source_record_ids', $sourceRecordId);
            })
            ->orderByRaw('CASE WHEN canonical_article_id IS NULL THEN 0 ELSE 1 END')
            ->latest('id')
            ->first();

        return $article !== null ? self::resolveCanonicalArticle($article) : null;
    }

    public static function findCanonicalByIdentityHashes(
        int $userId,
        string $titleMd5,
        string $contentMd5
    ): ?self {
        return self::query()
            ->where('user_id', $userId)
            ->where('title_md5', $titleMd5)
            ->where('content_md5', $contentMd5)
            ->whereNull('canonical_article_id')
            ->where(function ($query): void {
                $query->where('source', self::SOURCE_AGENT_HISTORY)
                    ->orWhere('source', self::TYPE_DAILY)
                    ->orWhere('article_type', self::TYPE_DAILY)
                    ->orWhere('is_daily_reading', true);
            })
            ->latest('id')
            ->first();
    }

    public static function resolveCanonicalArticle(self $article): self
    {
        $seen = [];
        $canonicalId = '';
        $canonical = null;

        while (trim((string) $article->canonical_article_id) !== '') {
            $canonicalId = trim((string) $article->canonical_article_id);
            if (isset($seen[$canonicalId])) {
                break;
            }
            $seen[$canonicalId] = true;
            $canonical = self::query()->where('article_id', $canonicalId)->first();
            if ($canonical === null) {
                break;
            }
            $article = $canonical;
        }

        return $article;
    }

    public static function aliasArticleToCanonical(
        self $aliasArticle,
        self $canonicalArticle,
        int $attempts = 5
    ): self {
        $model = new static();
        $aliasId = (string) $aliasArticle->article_id;
        $canonicalId = (string) self::resolveCanonicalArticle($canonicalArticle)->article_id;

        if ($aliasId === $canonicalId) {
            return self::resolveCanonicalArticle($canonicalArticle);
        }

        return $model->getConnection()->transaction(
            static function () use ($aliasId, $canonicalId): self {
                $alias = static::query()->where('article_id', $aliasId)->lockForUpdate()->firstOrFail();
                $canonical = static::query()
                    ->where('article_id', $canonicalId)
                    ->whereNull('canonical_article_id')
                    ->lockForUpdate()
                    ->firstOrFail();
                $aliasMetadata = is_array($alias->metadata) ? $alias->metadata : [];
                $canonicalMetadata = is_array($canonical->metadata) ? $canonical->metadata : [];
                $mergedMetadata = static::mergeIdentityMetadata($aliasMetadata, $canonicalMetadata);

                if ($mergedMetadata !== $canonicalMetadata) {
                    $canonical->metadata = $mergedMetadata;
                }
                if ($canonical->isDirty()) {
                    $canonical->saveRecord();
                }
                if ((string) $alias->canonical_article_id !== $canonicalId) {
                    $alias->canonical_article_id = $canonicalId;
                    $alias->saveRecord();
                }

                return $canonical;
            },
            $attempts
        );
    }

    public static function mergeIdentityMetadata(array $base, array $incoming): array
    {
        $merged = array_replace($base, $incoming);
        $sourceRecordIds = [];
        $metadataSets = [$base, $incoming];

        foreach ($metadataSets as $metadata) {
            $listedIds = is_array($metadata['source_record_ids'] ?? null)
                ? $metadata['source_record_ids']
                : [];
            foreach ($listedIds as $listedId) {
                $listedId = trim((string) $listedId);
                if ($listedId !== '') {
                    $sourceRecordIds[$listedId] = true;
                }
            }
            foreach (['source_record_id', 'idempotency_key'] as $key) {
                $sourceRecordId = trim((string) ($metadata[$key] ?? ''));
                if ($sourceRecordId !== '') {
                    $sourceRecordIds[$sourceRecordId] = true;
                }
            }
        }
        if ($sourceRecordIds !== []) {
            $merged['source_record_ids'] = array_keys($sourceRecordIds);
        }

        return $merged;
    }

    public static function replaceAgentHistorySubmission(
        string $articleId,
        array $attributes,
        array $submissionMetadata,
        int $attempts = 5
    ): array {
        $model = new static();

        return $model->getConnection()->transaction(
            static function () use ($articleId, $attributes, $submissionMetadata): array {
                $article = static::query()
                    ->where('article_id', $articleId)
                    ->lockForUpdate()
                    ->firstOrFail();
                $metadata = is_array($article->metadata) ? $article->metadata : [];
                $contentChanged = false;

                foreach ($attributes as $key => $value) {
                    if ($article->getAttribute($key) !== $value) {
                        $article->setAttribute($key, $value);
                        $contentChanged = true;
                    }
                }
                $updatedMetadata = static::mergeIdentityMetadata($metadata, $submissionMetadata);
                if ($updatedMetadata !== $metadata) {
                    $article->metadata = $updatedMetadata;
                }
                if ($article->isDirty()) {
                    $article->saveRecord();
                }

                return [
                    'article' => $article,
                    'content_changed' => $contentChanged,
                ];
            },
            $attempts
        );
    }

    public static function findByTaskId(string $taskId): ?self
    {
        return self::query()->where('task_id', $taskId)->first();
    }

    public static function mutateMetadataByArticleId(
        string $articleId,
        Closure $mutator,
        int $attempts = 5
    ): self {
        $model = new static();

        return $model->getConnection()->transaction(
            static function () use ($articleId, $mutator): self {
                $article = null;
                $metadata = [];
                $updatedMetadata = [];

                $article = static::query()
                    ->where('article_id', $articleId)
                    ->lockForUpdate()
                    ->firstOrFail();
                $metadata = is_array($article->metadata) ? $article->metadata : [];
                $updatedMetadata = $mutator($metadata, $article);

                if ($updatedMetadata !== $metadata) {
                    $article->metadata = $updatedMetadata;
                    $article->saveRecord();
                }

                return $article;
            },
            $attempts
        );
    }

    public static function chunkForLibraryBackfill(?string $articleId, Closure $callback): void
    {
        $query = self::query();

        if ($articleId !== null && $articleId !== '') {
            $query->where('article_id', $articleId);
        }

        $query->orderBy('id')->chunkById(200, $callback);
    }

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function sentenceAudioQueueEligible(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query
            ->whereNull('canonical_article_id')
            ->where(function ($eligibleQuery): void {
            $eligibleQuery
                ->whereNull('source')
                ->orWhere('source', '<>', self::SOURCE_AGENT_HISTORY)
                ->orWhereNull('article_type')
                ->orWhere('article_type', '<>', self::TYPE_DAILY);
            });
    }

    public function diffIdUpperBound(): int
    {
        return (int) ($this->newQuery()->sentenceAudioQueueEligible()->max('id') ?? 0);
    }

    public function diffIdsBetween(int $cursor, int $upperBound, int $limit): array
    {
        return $this->newQuery()
            ->sentenceAudioQueueEligible()
            ->where('id', '>', $cursor)
            ->where('id', '<=', $upperBound)
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    public function sentenceAudioScope(): string
    {
        return $this->article_type === self::TYPE_DAILY || (bool) $this->is_daily_reading
            ? self::TYPE_DAILY
            : self::SOURCE_AGENT_HISTORY;
    }

    public static function sentenceAudioQueueRowsByIds(array $ids): array
    {
        return self::query()
            ->whereIn('id', $ids)
            ->sentenceAudioQueueEligible()
            ->where('tts_generated', false)
            ->whereNotNull('content')
            ->where('content', '<>', '')
            ->where(function ($query): void {
                $query->whereNull('metadata->audio_status')
                    ->orWhere('metadata->audio_status', 'failed');
            })
            ->orderBy('id')
            ->get()
            ->all();
    }

    /**
     * Get the words associated with this article
     */
    public function articleWords()
    {
        return $this->hasMany(AppQyV1ArticleWordModel::class, 'article_id', 'article_id');
    }

}
