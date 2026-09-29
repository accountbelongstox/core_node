<?php

namespace App\Apps\ClashV1\ClashV1Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Collection;

class ClashV1ConfigModel extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'clash_urls_config';

    protected $fillable = [
        'name',
        'type',
        'content',
        'group_id',
        'order',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(ClashV1GroupModel::class);
    }

    public static function databaseIsAvailable(): bool
    {
        $model = new static();

        $model->getConnection()->getPdo();

        return true;
    }

    public static function forGroup(int $groupId): Collection
    {
        return self::query()->where('group_id', $groupId)->orderByDesc('created_at')->get();
    }

    public static function contentExists(string $content): bool
    {
        return self::query()->where('content', $content)->exists();
    }
} 
