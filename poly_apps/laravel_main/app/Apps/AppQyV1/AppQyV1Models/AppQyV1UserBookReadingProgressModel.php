<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class AppQyV1UserBookReadingProgressModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

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

    protected $casts = [
        'chapter_index' => 'integer',
        'verse_seq' => 'integer',
        'page' => 'integer',
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'user_book_reading_progress');
    }

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
