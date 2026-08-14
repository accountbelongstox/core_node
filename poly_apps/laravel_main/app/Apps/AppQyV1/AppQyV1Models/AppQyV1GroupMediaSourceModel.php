<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Link row between a word group and a synced media source (book|subtitle).
 * Removing the link never removes words already merged into the group.
 */
class AppQyV1GroupMediaSourceModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'group_media_sources');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'group_id',
        'source_type',
        'source_key',
        'title',
        'language',
        'words_added',
        'added_at',
    ];

    protected $casts = [
        'words_added' => 'integer',
        'added_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

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
