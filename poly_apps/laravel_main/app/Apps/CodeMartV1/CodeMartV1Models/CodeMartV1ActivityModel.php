<?php

namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use Illuminate\Support\Collection;

class CodeMartV1ActivityModel extends CodeMartV1Model
{
    protected $table = CodeMartV1TablesMaps::ACTIVITIES_TABLE;

    protected $fillable = [
        'actor_id',
        'resource_type',
        'resource_id',
        'action',
        'from_state',
        'to_state',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'json',
    ];

    public static function record(
        ?int $actorId,
        string $resourceType,
        int $resourceId,
        string $action,
        ?string $fromState = null,
        ?string $toState = null,
        ?array $metadata = null
    ): self {
        return static::query()->create([
            'actor_id' => $actorId,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'action' => $action,
            'from_state' => $fromState,
            'to_state' => $toState,
            'metadata' => $metadata,
        ]);
    }

    public static function forResource(string $resourceType, int $resourceId, int $limit = 50): Collection
    {
        return static::query()
            ->where('resource_type', $resourceType)
            ->where('resource_id', $resourceId)
            ->latest('created_at')
            ->limit($limit)
            ->get();
    }
}
