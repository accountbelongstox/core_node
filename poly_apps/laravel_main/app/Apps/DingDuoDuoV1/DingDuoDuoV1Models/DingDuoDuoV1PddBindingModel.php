<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1DBTablesBrige\DingDuoDuoV1TableMaps;

/**
 * DingDuoDuoV1 (订多多) cross-PDD-user binding: which PDD user a given owner
 * (a member or a super_code) is allowed to manage. owner_type = 'member' |
 * 'super_code'; owner_id is the member id or super_code id as a string.
 */
class DingDuoDuoV1PddBindingModel extends Model
{
    public const OWNER_MEMBER = 'member';
    public const OWNER_SUPER_CODE = 'super_code';

    protected $appKey = AppKeys::DINGDUODUOV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = DingDuoDuoV1TableMaps::getTableName('PDD_BINDINGS');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'owner_type',
        'owner_id',
        'pdd_user_id',
        'nickname',
        'status',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function adminPage(string $ownerType, string $ownerId, int $perPage)
    {
        $query = static::query()->orderByDesc('id');

        if ($ownerType !== '') {
            $query->where('owner_type', $ownerType);
        }
        if ($ownerId !== '') {
            $query->where('owner_id', $ownerId);
        }

        return $query->paginate($perPage);
    }

    public static function findOrNewBinding(string $ownerType, string $ownerId, string $pddUserId): self
    {
        return static::query()->firstOrNew([
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'pdd_user_id' => $pddUserId,
        ]);
    }

    public static function findBinding(string $ownerType, string $ownerId, string $pddUserId): ?self
    {
        return static::query()
            ->where('owner_type', $ownerType)
            ->where('owner_id', $ownerId)
            ->where('pdd_user_id', $pddUserId)
            ->first();
    }

    public static function findById(int $bindingId): ?self
    {
        return static::query()->find($bindingId);
    }
}
