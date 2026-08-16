<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppQyV1GroupLibraryModel extends AppQyV1Model
{
    
    protected ?string $appTableSuffix = 'group_libraries';
    
    protected $fillable = [
        'group_id',
        'library_id',
        'added_at',
    ];

    protected function casts(): array
    {
        return [
            'added_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(AppQyV1WordGroupModel::class, 'group_id');
    }

    public function library(): BelongsTo
    {
        return $this->belongsTo(AppQyV1VocabularyLibraryModel::class, 'library_id');
    }

    public static function attachLibrary(int $groupId, int $libraryId): self
    {
        return self::query()->create([
            'group_id' => $groupId,
            'library_id' => $libraryId,
            'added_at' => now(),
        ]);
    }

    public static function findLink(int $groupId, int $libraryId): ?self
    {
        return self::query()->where('group_id', $groupId)->where('library_id', $libraryId)->first();
    }

    public static function forGroupWithLibrary(int $groupId)
    {
        return self::query()->where('group_id', $groupId)->with('library')->get();
    }
}
