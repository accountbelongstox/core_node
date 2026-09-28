<?php

namespace App\Apps\ClashV1\ClashV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;

class ClashV1GroupModel extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'global_groups';

    protected $fillable = [
        'name',
        'identifier',
        'description',
        'order',
    ];

    protected $hidden = ['deleted_at'];

    protected static function booted(): void
    {
        static::creating(static function (self $group): void {
            // Generate unique identifier: group name/MD5/creation date
            $group->identifier = sprintf(
                '%s/%s/%s',
                Str::slug($group->name),
                md5($group->name . time()),
                now()->format('Ymd')
            );
        });
    }

    // Find group by hash ID
    public static function findByHash($hashId)
    {
        return static::where('hash_id', $hashId)->first();
    }

    public static function orderedWithConfigCounts(): Collection
    {
        return self::query()->withCount('configs')->orderByDesc('created_at')->get();
    }

    public static function createGroup(array $attributes): self
    {
        return self::create($attributes);
    }

    public static function defaultGroup(): self
    {
        return self::query()->first() ?? self::createGroup(['name' => 'Default Group']);
    }

    public static function resolveOrDefault($identifier): self
    {
        $group = self::query()->where('name', $identifier)->first();

        if ($group === null && is_numeric($identifier)) {
            $group = self::query()->find((int) $identifier);
        }

        return $group ?? self::defaultGroup();
    }

    // Reorder groups
    public static function reorder(array $ids)
    {
        $groups = self::query()->whereIn('id', $ids)->get()->keyBy('id');
        $rows = [];

        foreach ($ids as $order => $id) {
            $group = $groups->get((int) $id);
            if ($group === null) {
                continue;
            }
            $attributes = $group->getAttributes();
            $attributes['order'] = $order;
            $attributes['updated_at'] = now();
            $rows[] = $attributes;
        }

        if ($rows !== []) {
            self::query()->upsert($rows, ['id'], ['order', 'updated_at']);
        }
    }

    public function hasConfigs(): bool
    {
        return $this->configs()->exists();
    }

    public function configs(): HasMany
    {
        return $this->hasMany(ClashV1ConfigModel::class, 'group_id');
    }
}
