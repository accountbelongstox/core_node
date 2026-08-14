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
use App\Models\Concerns\QueriesDiffIdPages;
use App\Utils\RunsModelTransactions;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\Schema;

class AppQyV1ArticleModel extends Model
{
    use QueriesDiffIdPages, RunsModelTransactions;

    public const TYPE_DAILY = 'daily';
    public const SOURCE_AGENT_HISTORY = 'agent_history';

    protected $appKey = AppKeys::APPQYV1;
    protected $table;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'articles');
    }

    protected $fillable = [
        'article_id',
        'user_id',
        'title',
        'content',
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

    protected $casts = [
        'is_daily_reading' => 'boolean',
        'tts_generated' => 'boolean',
        'reading_date' => 'date',
        'metadata' => 'array',
    ];

    public function isAgentHistoryDaily(): bool
    {
        return $this->source === self::SOURCE_AGENT_HISTORY
            && $this->article_type === self::TYPE_DAILY;
    }

    public static function studyMarkerColumnsReady(): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())
            ->hasColumn($model->getTable(), 'study_gen_status');
    }

    public static function studySourceCount(?string $search): int
    {
        $query = self::query();
        if ($search !== null && $search !== '') {
            $query->where('title', 'like', '%' . $search . '%');
        }

        return $query->count();
    }

    public static function studySourceRows(?string $search, int $offset, int $limit): EloquentCollection
    {
        $columns = ['id', 'article_id', 'title', 'language', 'sentence_count'];
        if (self::studyMarkerColumnsReady()) {
            $columns[] = 'study_gen_status';
            $columns[] = 'study_gen_progress';
        }

        $query = self::query();
        if ($search !== null && $search !== '') {
            $query->where('title', 'like', '%' . $search . '%');
        }

        return $query->select($columns)->orderBy('id')->skip($offset)->take($limit)->get();
    }

    public static function sourceMetadata(string $articleId): mixed
    {
        return self::query()->where('article_id', $articleId)->value('metadata');
    }

    public static function sourceLanguage(string $articleId): string
    {
        return (string) (self::query()->where('article_id', $articleId)->value('language') ?? '');
    }

    public static function updateStudyMarker(string $articleId, array $attributes): int
    {
        return self::query()->where('article_id', $articleId)->update($attributes);
    }

    public static function managementPage(?string $category, int $offset, int $limit): array
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

        return [
            'total' => (clone $query)->count(),
            'rows' => $query->latest('id')->offset($offset)->limit($limit)->get(),
        ];
    }

    public static function managementCategoryRows()
    {
        return self::query()
            ->select(['article_type', 'source', 'is_daily_reading'])
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy(['article_type', 'source', 'is_daily_reading'])
            ->get();
    }

    public static function findByArticleId(string $articleId): ?self
    {
        return self::query()->where('article_id', $articleId)->first();
    }

    public static function findByTaskId(string $taskId): ?self
    {
        return self::query()->where('task_id', $taskId)->first();
    }

    public static function createRecord(array $attributes): self
    {
        return self::query()->create($attributes);
    }

    public static function chunkForLibraryBackfill(?string $articleId, Closure $callback): void
    {
        $query = self::query();

        if ($articleId !== null && $articleId !== '') {
            $query->where('article_id', $articleId);
        }

        $query->orderBy('id')->chunkById(200, $callback);
    }

    public function scopeSentenceAudioQueueEligible($query)
    {
        return $query->where(function ($eligibleQuery): void {
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
