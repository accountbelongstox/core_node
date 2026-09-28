<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Collection;

class AppQyV1DailyRecitationLogModel extends AppQyV1Model
{
    use HasFactory;

    public const ACTION_READ = 'read';
    public const ACTION_LEARN = 'learn';
    public const ACTION_REVIEW_CORRECT = 'review_correct';
    public const ACTION_REVIEW_WRONG = 'review_wrong';

    public const ACTIONS = [
        self::ACTION_READ,
        self::ACTION_LEARN,
        self::ACTION_REVIEW_CORRECT,
        self::ACTION_REVIEW_WRONG,
    ];


    protected ?string $appTableMapKey = 'DAILY_RECITATION_LOGS';

    protected $fillable = [
        'user_id',
        'date',
        'word',
        'language_code',
        'action',
        'session_id',
        'batch_id',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public static function recitedWordsForDate(int $userId, string $date): array
    {
        return self::forUserDate($userId, $date)
            ->distinct()
            ->pluck('word')
            ->all();
    }

    public static function actionRowsForDate(int $userId, string $date, bool $ordered = false): Collection
    {
        $query = self::forUserDate($userId, $date);

        if ($ordered) {
            $query->orderBy('id');
        }

        return $query->get(['word', 'action']);
    }

    public static function uniqueWordsByDate(int $userId, ?string $startDate = null)
    {
        $query = self::query()->where('user_id', $userId);
        if ($startDate !== null) {
            $query->where('date', '>=', $startDate);
        }

        return $query
            ->groupBy('date')
            ->orderBy('date')
            ->selectRaw('date, COUNT(DISTINCT word) as unique_words')
            ->get();
    }

    public static function findBatch(int $userId, string $batchId)
    {
        return static::query()
            ->where('user_id', $userId)
            ->where('batch_id', $batchId)
            ->orderBy('id')
            ->get(['date']);
    }

    public static function insertRows(array $rows): bool
    {
        return self::query()->insert($rows);
    }

    private static function forUserDate(int $userId, string $date)
    {
        return self::query()->where('user_id', $userId)->where('date', $date);
    }
}
