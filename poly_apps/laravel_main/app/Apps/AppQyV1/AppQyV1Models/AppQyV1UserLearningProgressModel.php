<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class AppQyV1UserLearningProgressModel extends AppQyV1Model
{
    use HasFactory, SoftDeletes;


    protected ?string $appTableMapKey = 'USER_LEARNING_PROGRESS';

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

    protected function casts(): array
    {
        return [
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
    }

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

    #[\Illuminate\Database\Eloquent\Attributes\Scope]
    protected function dueFirst(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
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

    public static function recordPlaybackRead(
        int $userId,
        string $languageCode,
        string $wordHash,
        string $wordContent,
        int $readCount,
        $reviewedAt
    ): void {
        $row = self::query()->firstOrNew([
            'user_id' => $userId,
            'lang_code' => $languageCode,
            'word_md5' => $wordHash,
        ]);

        if (!$row->exists) {
            $row->word_content = $wordContent;
            $row->learning_status = 'learning';
            $row->review_count = 0;
            $row->correct_count = 0;
            $row->wrong_count = 0;
            $row->familiarity_level = 0;
        } elseif ($row->learning_status === 'new') {
            $row->learning_status = 'learning';
        }

        $row->review_count = (int) $row->review_count + $readCount;
        $row->last_reviewed_at = $reviewedAt;
        $row->save();
    }

    public static function recordPlaybackReads(
        int $userId,
        string $languageCode,
        array $reads,
        $reviewedAt
    ): int {
        $model = new self();
        $connection = $model->getConnection();
        $table = $connection->getQueryGrammar()->wrapTable($model->getTable());
        $recordsByHash = [];
        $valueClauses = [];
        $bindings = [];
        $timestamp = now();

        foreach ($reads as $read) {
            $hash = (string) ($read['word_hash'] ?? '');
            $content = (string) ($read['word_content'] ?? '');
            $count = max(1, (int) ($read['read_count'] ?? 1));
            if ($hash === '' || $content === '') {
                continue;
            }

            if (!isset($recordsByHash[$hash])) {
                $recordsByHash[$hash] = ['content' => $content, 'count' => 0];
            }
            $recordsByHash[$hash]['count'] += $count;
        }

        foreach ($recordsByHash as $hash => $record) {
            $valueClauses[] = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            array_push(
                $bindings,
                $userId,
                $languageCode,
                $hash,
                $record['content'],
                'learning',
                $record['count'],
                0,
                0,
                0,
                $reviewedAt,
                $timestamp,
                $timestamp
            );
        }

        if ($valueClauses === []) {
            return 0;
        }

        $values = implode(', ', $valueClauses);
        $sql = "INSERT INTO {$table} (user_id, lang_code, word_md5, word_content, learning_status, review_count, correct_count, wrong_count, familiarity_level, last_reviewed_at, created_at, updated_at) VALUES {$values} ON CONFLICT (user_id, lang_code, word_md5) DO UPDATE SET learning_status = CASE WHEN {$table}.learning_status = 'new' THEN 'learning' ELSE {$table}.learning_status END, review_count = {$table}.review_count + EXCLUDED.review_count, last_reviewed_at = EXCLUDED.last_reviewed_at, updated_at = EXCLUDED.updated_at";

        $connection->statement($sql, $bindings);

        return count($recordsByHash);
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

    public static function getUserStats(int $userId, ?string $langCode = null)
    {
        $query = self::where('user_id', $userId);

        if ($langCode) {
            $query->where('lang_code', $langCode);
        }

        $stats = $query
            ->selectRaw('COUNT(*) AS total_words')
            ->selectRaw("SUM(CASE WHEN learning_status = 'new' THEN 1 ELSE 0 END) AS new_words")
            ->selectRaw("SUM(CASE WHEN learning_status = 'learning' THEN 1 ELSE 0 END) AS learning_words")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) AS mastered_words")
            ->selectRaw(
                "SUM(CASE WHEN learning_status IN ('learning', 'reviewing') AND next_review_at <= ? THEN 1 ELSE 0 END) AS needs_review",
                [now()]
            )
            ->first();

        return [
            'total_words' => (int) ($stats->total_words ?? 0),
            'new_words' => (int) ($stats->new_words ?? 0),
            'learning_words' => (int) ($stats->learning_words ?? 0),
            'mastered_words' => (int) ($stats->mastered_words ?? 0),
            'needs_review' => (int) ($stats->needs_review ?? 0),
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

    public static function dailyQueue(int $userId, string $language): array
    {
        return [
            'review' => static::query()
                ->where('user_id', $userId)
                ->where('lang_code', $language)
                ->whereIn('learning_status', ['learning', 'reviewing'])
                ->where('next_review_at', '<=', now())
                ->orderBy('next_review_at')
                ->limit(100)
                ->get(),
            'new' => static::query()
                ->where('user_id', $userId)
                ->where('lang_code', $language)
                ->where('learning_status', 'new')
                ->orderBy('created_at')
                ->limit(20)
                ->get(),
        ];
    }

    public static function quizCandidates(int $userId, string $language, int $requiredCount)
    {
        $candidates = static::query()
            ->where('user_id', $userId)
            ->where('lang_code', $language)
            ->whereIn('learning_status', ['learning', 'reviewing', 'mastered'])
            ->dueFirst()
            ->limit(200)
            ->get();

        if ($candidates->count() < $requiredCount) {
            $candidates = $candidates->concat(
                static::query()
                    ->where('user_id', $userId)
                    ->where('lang_code', $language)
                    ->where('learning_status', 'new')
                    ->orderBy('created_at')
                    ->limit(200)
                    ->get()
            );
        }

        return $candidates->unique('word_md5')->values();
    }

    public static function retentionCounts(int $userId, ?string $language): array
    {
        $query = static::query()->where('user_id', $userId);
        if ($language !== null && $language !== '') {
            $query->where('lang_code', $language);
        }

        $stats = $query
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) AS mastered")
            ->selectRaw(
                "SUM(CASE WHEN learning_status IN ('learning', 'reviewing') AND next_review_at <= ? THEN 1 ELSE 0 END) AS critical",
                [now()]
            )
            ->selectRaw(
                "SUM(CASE WHEN learning_status IN ('learning', 'reviewing') AND (next_review_at > ? OR next_review_at IS NULL) THEN 1 ELSE 0 END) AS review",
                [now()]
            )
            ->selectRaw("SUM(CASE WHEN learning_status = 'new' THEN 1 ELSE 0 END) AS learning")
            ->first();

        return [
            'total' => (int) ($stats->total ?? 0),
            'mastered' => (int) ($stats->mastered ?? 0),
            'critical' => (int) ($stats->critical ?? 0),
            'review' => (int) ($stats->review ?? 0),
            'learning' => (int) ($stats->learning ?? 0),
        ];
    }

    public static function profileMetrics(int $userId): array
    {
        $query = static::query()->where('user_id', $userId);
        $stats = (clone $query)
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw("SUM(CASE WHEN learning_status = 'new' THEN 1 ELSE 0 END) AS new_count")
            ->selectRaw("SUM(CASE WHEN learning_status = 'learning' THEN 1 ELSE 0 END) AS learning")
            ->selectRaw("SUM(CASE WHEN learning_status = 'mastered' THEN 1 ELSE 0 END) AS mastered")
            ->selectRaw(
                "SUM(CASE WHEN learning_status IN ('learning', 'reviewing') AND next_review_at <= ? THEN 1 ELSE 0 END) AS needs_review",
                [now()]
            )
            ->selectRaw('SUM(CASE WHEN wrong_count > correct_count THEN 1 ELSE 0 END) AS weak')
            ->selectRaw('COALESCE(SUM(correct_count), 0) AS correct_sum')
            ->selectRaw('COALESCE(SUM(wrong_count), 0) AS wrong_sum')
            ->first();

        return [
            'total' => (int) ($stats->total ?? 0),
            'new' => (int) ($stats->new_count ?? 0),
            'learning' => (int) ($stats->learning ?? 0),
            'mastered' => (int) ($stats->mastered ?? 0),
            'needs_review' => (int) ($stats->needs_review ?? 0),
            'weak' => (int) ($stats->weak ?? 0),
            'correct_sum' => (int) ($stats->correct_sum ?? 0),
            'wrong_sum' => (int) ($stats->wrong_sum ?? 0),
            'timestamps' => $query->get(['last_reviewed_at', 'updated_at', 'created_at']),
        ];
    }
}
