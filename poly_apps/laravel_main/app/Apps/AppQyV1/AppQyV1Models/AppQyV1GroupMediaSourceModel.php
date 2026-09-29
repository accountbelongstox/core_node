<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Link row between a word group and a synced media source (book|subtitle).
 * Removing the link never removes words already merged into the group.
 */
class AppQyV1GroupMediaSourceModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'group_media_sources';

    protected $fillable = [
        'group_id',
        'source_type',
        'source_key',
        'title',
        'language',
        'words_added',
        'added_at',
    ];

    protected function casts(): array
    {
        return [
            'words_added' => 'integer',
            'added_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(AppQyV1WordGroupModel::class, 'group_id');
    }

    public static function findLink(int $groupId, string $sourceType, string $sourceKey): ?self
    {
        return self::query()
            ->where('group_id', $groupId)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->first();
    }

    public static function createLink(array $attributes): self
    {
        return self::query()->create($attributes);
    }

    public static function forGroup(int $groupId)
    {
        return self::query()->where('group_id', $groupId)->orderBy('added_at')->get();
    }
}
