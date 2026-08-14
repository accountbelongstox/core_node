<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppQyV1GroupLibraryModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    
    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_libraries');
    }
    
    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'group_id',
        'library_id',
        'added_at',
    ];

    protected $casts = [
        'added_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

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
