<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

class AppQyV1UserDailyReadingReadModel extends AppQyV1Model
{
    protected ?string $appTableMapKey = 'USER_DAILY_READING_READS';

    protected $fillable = [
        'user_id',
        'article_id',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'read_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    /**
     * @param  array<int,string>  $articleIds
     * @return array<string,string> article_id => ISO-8601 read_at
     */
    public static function readAtMap(int $userId, array $articleIds): array
    {
        $map = [];

        if ($articleIds === []) {
            return $map;
        }
        $rows = static::query()
            ->where('user_id', $userId)
            ->whereIn('article_id', $articleIds)
            ->get(['article_id', 'read_at']);
        foreach ($rows as $row) {
            $map[(string) $row->article_id] = $row->read_at ? $row->read_at->toIso8601String() : '';
        }

        return $map;
    }

    /**
     * @param  array<int,string>  $articleIds
     */
    public static function markRead(int $userId, array $articleIds): int
    {
        $timestamp = now();
        $rows = [];

        foreach ($articleIds as $articleId) {
            $rows[] = [
                'user_id' => $userId,
                'article_id' => $articleId,
                'read_at' => $timestamp,
                'created_at' => $timestamp,
                'updated_at' => $timestamp,
            ];
        }
        if ($rows === []) {
            return 0;
        }

        return static::query()->insertOrIgnore($rows);
    }

    /**
     * @param  array<int,string>  $articleIds
     */
    public static function markUnread(int $userId, array $articleIds): int
    {
        if ($articleIds === []) {
            return 0;
        }

        return static::query()
            ->where('user_id', $userId)
            ->whereIn('article_id', $articleIds)
            ->delete();
    }
}
