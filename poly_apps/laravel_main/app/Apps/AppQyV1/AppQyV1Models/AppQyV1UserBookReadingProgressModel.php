<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


class AppQyV1UserBookReadingProgressModel extends AppQyV1Model
{

    protected $fillable = [
        'user_id',
        'source_key',
        'chapter_index',
        'verse_seq',
        'grain',
        'page',
        'article_id',
        'selection_mode',
    ];

    protected function casts(): array
    {
        return [
            'chapter_index' => 'integer',
            'verse_seq' => 'integer',
            'page' => 'integer',
        ];
    }

    protected ?string $appTableSuffix = 'user_book_reading_progress';

    public static function findForSource(int $userId, string $sourceKey): ?self
    {
        return static::query()->where('user_id', $userId)->where('source_key', $sourceKey)->first();
    }

    public static function forUser(int $userId, int $limit)
    {
        return static::query()->where('user_id', $userId)->orderByDesc('updated_at')->limit($limit)->get();
    }

    public static function findOrNewForSource(int $userId, string $sourceKey): self
    {
        return static::query()->firstOrNew(['user_id' => $userId, 'source_key' => $sourceKey]);
    }
}
