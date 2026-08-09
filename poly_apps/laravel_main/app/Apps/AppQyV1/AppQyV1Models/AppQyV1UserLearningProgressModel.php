<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1UserLearningProgressModel extends Model
{
    use HasFactory, SoftDeletes;

    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppQyV1TableMaps::getTableName('USER_LEARNING_PROGRESS');
    }

    protected $fillable = [
        'user_id',
        'lang_code',
        'word_md5',
        'word_content',
        'learning_status',
        'review_count',
        'correct_count',
        'wrong_count',
        'last_reviewed_at',
        'next_review_at',
        'familiarity_level',
        'review_history',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'review_count' => 'integer',
        'correct_count' => 'integer',
        'wrong_count' => 'integer',
        'familiarity_level' => 'integer',
        'review_history' => 'json',
        'last_reviewed_at' => 'datetime',
        'next_review_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public static function getWordsForLearning(int $userId, string $langCode, int $limit = 100)
    {
        return self::where('user_id', $userId)
            ->where('lang_code', $langCode)
            ->where(function ($query) {
                $query->where('learning_status', 'new')
                    ->orWhere(function ($q) {
                        $q->whereIn('learning_status', ['learning', 'reviewing'])
                            ->where('next_review_at', '<=', now());
                    });
            })
            ->orderBy('learning_status')
            ->orderBy('next_review_at')
            ->limit($limit)
            ->get();
    }

    public function scopeDueFirst($query)
    {
        return $query->orderByRaw('next_review_at IS NULL, next_review_at ASC');
    }

    public static function socialStatsForUserIds(array $userIds, $since = null, bool $reviewedOnly = false)
    {
        $query = self::query()->whereIn('user_id', $userIds);

        if ($since !== null) {
            $query->where('updated_at', '>=', $since);
        }
        if ($reviewedOnly) {
            $query->where('review_count', '>', 0);
        }

        return $query
            ->groupBy('user_id')
            ->selectRaw('user_id')
            ->selectRaw("SUM(CASE WHEN learning_status IN ('learning', 'reviewing', 'learned') THEN 1 ELSE 0 END) as learned_count")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) as mastered_count")
            ->selectRaw('MAX(updated_at) as last_activity_at')
            ->get()
            ->keyBy('user_id');
    }

    public static function aggregateProgressStats(?array $userIds = null, $since = null)
    {
        $query = self::query();

        if ($userIds !== null) {
            $query->whereIn('user_id', $userIds);
        }
        if ($since !== null) {
            $query->where('updated_at', '>=', $since);
        }

        return $query
            ->groupBy('user_id')
            ->selectRaw('user_id')
            ->selectRaw('COUNT(*) as total_words')
            ->selectRaw("SUM(CASE WHEN learning_status IN ('learning', 'reviewing', 'learned') THEN 1 ELSE 0 END) as learned_words")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) as mastered_words")
            ->selectRaw('SUM(correct_count) as correct_answers')
            ->get();
    }

    public static function recentlyStudyingUserIds(array $userIds, int $windowMinutes): array
    {
        $normalizedIds = [];

        $normalizedIds = array_values(array_unique(array_map('intval', $userIds)));
        if (empty($normalizedIds)) {
            return [];
        }

        return static::query()
            ->whereIn('user_id', $normalizedIds)
            ->where('updated_at', '>=', now()->subMinutes($windowMinutes))
            ->distinct()
            ->pluck('user_id')
            ->map(fn ($userId) => (int) $userId)
            ->all();
    }

    public static function profileStatsForUser(int $userId)
    {
        return self::query()
            ->where('user_id', $userId)
            ->groupBy('user_id')
            ->selectRaw('user_id')
            ->selectRaw('COUNT(*) as total_words')
            ->selectRaw("SUM(CASE WHEN learning_status IN ('learning', 'reviewing', 'learned') THEN 1 ELSE 0 END) as learned_words")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) as mastered_words")
            ->selectRaw('SUM(correct_count) as correct_answers')
            ->first();
    }

    public static function tableExists(): bool
    {
        $model = new self();

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function createOrUpdateProgress(int $userId, string $langCode, string $wordContent, array $data = [])
    {
        $wordMd5 = md5($wordContent);

        return self::updateOrCreate(
            [
                'user_id' => $userId,
                'lang_code' => $langCode,
                'word_md5' => $wordMd5,
            ],
            array_merge($data, [
                'word_content' => $wordContent,
            ])
        );
    }

    public function recordReview(bool $correct)
    {
        $this->review_count++;
        $this->last_reviewed_at = now();

        if ($correct) {
            $this->correct_count++;
            $this->familiarity_level = min(5, $this->familiarity_level + 1);
        } else {
            $this->wrong_count++;
            $this->familiarity_level = max(0, $this->familiarity_level - 1);
        }

        $this->updateLearningStatus();
        $this->calculateNextReview();
        $this->appendReviewHistory($correct);

        $this->save();
    }

    private function updateLearningStatus()
    {
        if ($this->review_count === 0) {
            $this->learning_status = 'new';
        } elseif ($this->familiarity_level >= 4 && $this->review_count >= 5) {
            $this->learning_status = 'mastered';
        } elseif ($this->familiarity_level >= 2) {
            $this->learning_status = 'learning';
        } else {
            $this->learning_status = 'reviewing';
        }
    }

    private function calculateNextReview()
    {
        $intervals = [
            0 => 5,
            1 => 30,
            2 => 180,
            3 => 1440,
            4 => 10080,
            5 => 43200,
        ];

        $intervalMinutes = $intervals[$this->familiarity_level] ?? 5;
        $this->next_review_at = now()->addMinutes($intervalMinutes);
    }

    private function appendReviewHistory(bool $correct)
    {
        $history = $this->review_history ?? [];
        $history[] = [
            'timestamp' => now()->toDateTimeString(),
            'correct' => $correct,
            'familiarity_level' => $this->familiarity_level,
        ];

        if (count($history) > 100) {
            $history = array_slice($history, -100);
        }

        $this->review_history = $history;
    }

    public static function getUserStats(int $userId, string $langCode = null)
    {
        $query = self::where('user_id', $userId);

        if ($langCode) {
            $query->where('lang_code', $langCode);
        }

        return [
            'total_words' => $query->count(),
            'new_words' => (clone $query)->where('learning_status', 'new')->count(),
            'learning_words' => (clone $query)->where('learning_status', 'learning')->count(),
            'mastered_words' => (clone $query)->where('learning_status', 'mastered')->count(),
            'needs_review' => (clone $query)->whereIn('learning_status', ['learning', 'reviewing'])
                ->where('next_review_at', '<=', now())->count(),
        ];
    }

    public static function initializeWordsForUser(int $userId, string $langCode, array $wordContents)
    {
        $items = [];
        $timestamp = now();

        foreach ($wordContents as $word) {
            $items[] = [
                'user_id' => $userId,
                'lang_code' => $langCode,
                'word_md5' => md5($word),
                'word_content' => $word,
                'learning_status' => 'new',
                'review_count' => 0,
                'correct_count' => 0,
                'wrong_count' => 0,
                'familiarity_level' => 0,
                'next_review_at' => $timestamp,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        return self::insertOrIgnore($items);
    }
}
