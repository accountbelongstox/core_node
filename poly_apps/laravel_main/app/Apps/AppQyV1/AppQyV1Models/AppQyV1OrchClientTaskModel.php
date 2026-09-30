<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Utils\RunsModelTransactions;

/**
 * Client-side orchestration task manifest row, unique on
 * (user_id, client_task_id). deleted_at is a tombstone, not a soft delete.
 */
class AppQyV1OrchClientTaskModel extends AppQyV1Model
{
    use RunsModelTransactions;

    protected ?string $appTableSuffix = 'orch_client_tasks';

    protected $fillable = [
        'user_id',
        'client_task_id',
        'name',
        'source',
        'language',
        'source_ref',
        'config',
        'plan_hash',
        'status',
        'segment_count',
        'item_count',
        'duration_ms',
        'device_id',
        'client_updated_at',
        'deleted_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'source_ref' => 'array',
            'config' => 'array',
            'segment_count' => 'integer',
            'item_count' => 'integer',
            'duration_ms' => 'integer',
            'client_updated_at' => 'datetime',
            'deleted_at' => 'datetime',
        ];
    }

    public static function findForUser(int $userId, string $clientTaskId): ?self
    {
        return self::query()
            ->where('user_id', $userId)
            ->where('client_task_id', $clientTaskId)
            ->first();
    }

    public static function pageForUser(int $userId, ?string $since, int $page, int $perPage): array
    {
        $query = self::query()->where('user_id', $userId);

        if ($since !== null) {
            $query->where('updated_at', '>', $since);
        } else {
            $query->whereNull('deleted_at');
        }
        $total = (clone $query)->count();
        $items = $query
            ->orderBy('updated_at')
            ->orderBy('id')
            ->forPage($page, $perPage)
            ->get();

        return ['items' => $items, 'total' => $total];
    }
}
