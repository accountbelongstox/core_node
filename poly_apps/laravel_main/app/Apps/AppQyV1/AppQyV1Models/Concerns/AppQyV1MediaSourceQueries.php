<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Schema;

trait AppQyV1MediaSourceQueries
{
    public static function browsePage(?string $language, ?string $search, int $perPage): LengthAwarePaginator
    {
        $query = self::query();

        if ($language !== null && $language !== '') {
            $query->where('language', $language);
        }
        if ($search !== null && $search !== '') {
            $query->where(function ($searchQuery) use ($search) {
                $searchQuery->where('title', 'like', "%{$search}%")
                    ->orWhere('original_name', 'like', "%{$search}%");
            });
        }

        return $query->orderByDesc('synced_at')->paginate($perPage);
    }

    public static function findBySourceKey(string $sourceKey): ?self
    {
        return self::query()->where('source_key', $sourceKey)->first();
    }

    public static function createRecord(array $attributes): self
    {
        return self::query()->create($attributes);
    }

    public static function sourceExists(string $sourceKey): bool
    {
        return self::query()->where('source_key', $sourceKey)->exists();
    }

    public static function tableRowCount(): int
    {
        $model = new static();
        if (!$model->getConnection()->getSchemaBuilder()->hasTable($model->getTable())) {
            return 0;
        }

        return self::query()->count();
    }

    public static function findSource(int $id): ?self
    {
        return self::query()->find($id);
    }

    public static function findByIdOrSourceKey(?int $id, ?string $sourceKey): ?self
    {
        if ($id !== null) {
            return self::findSource($id);
        }

        return $sourceKey !== null ? self::findBySourceKey($sourceKey) : null;
    }

    public static function recoverPosterMaintenance($failedBefore, $leaseBefore): array
    {
        $requeued = self::query()
            ->where('poster_status', 'failed')
            ->where(function ($query) use ($failedBefore): void {
                $query->whereNull('poster_fetched_at')
                    ->orWhere('poster_fetched_at', '<=', $failedBefore);
            })
            ->update([
                'poster_status' => 'pending',
                'poster_fetched_at' => null,
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);
        $staleLeases = self::query()
            ->whereNotNull('assist_claimed_at')
            ->where('assist_claimed_at', '<', $leaseBefore)
            ->update([
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        return [
            'requeued' => (int) $requeued,
            'stale_leases' => (int) $staleLeases,
        ];
    }

    public static function posterColumnsReady(): bool
    {
        $model = new static();
        $schema = Schema::connection($model->getConnectionName());

        return $schema->hasColumn($model->getTable(), 'poster_status')
            && $schema->hasColumn($model->getTable(), 'assist_claimed_at');
    }

    public static function posterColumnAvailable(string $column): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())->hasColumn($model->getTable(), $column);
    }

    public static function claimPosterRows(
        string $claimerId,
        int $limit,
        $leaseFloor,
        $failedFloor,
        bool $provenanceSupported,
        array $compliantProviders
    ) {
        $model = new static();

        return $model->getConnection()->transaction(static function () use (
            $claimerId,
            $limit,
            $leaseFloor,
            $failedFloor,
            $provenanceSupported,
            $compliantProviders
        ) {
            $rows = self::query()
                ->where(function ($status) use ($failedFloor, $provenanceSupported, $compliantProviders): void {
                    $status->where('poster_status', 'pending')
                        ->orWhere(function ($failed) use ($failedFloor): void {
                            $failed->where('poster_status', 'failed')
                                ->where(function ($backoff) use ($failedFloor): void {
                                    $backoff->whereNull('poster_fetched_at')
                                        ->orWhere('poster_fetched_at', '<=', $failedFloor);
                                });
                        });
                    if ($provenanceSupported) {
                        $status->orWhere(function ($provenance) use ($compliantProviders): void {
                            $provenance->where('poster_status', 'ready')
                                ->whereNull('poster_mcp_submitted_at')
                                ->where(function ($provider) use ($compliantProviders): void {
                                    $provider->whereNull('poster_provider')
                                        ->orWhereNotIn('poster_provider', $compliantProviders);
                                });
                        });
                    }
                })
                ->where(function ($lease) use ($leaseFloor): void {
                    $lease->whereNull('assist_claimed_at')->orWhere('assist_claimed_at', '<', $leaseFloor);
                })
                ->orderByRaw('poster_fetched_at IS NULL DESC')
                ->orderBy('poster_fetched_at')
                ->limit($limit)
                ->lockForUpdate()
                ->get();

            foreach ($rows as $row) {
                $row->assist_claimed_at = now();
                $row->assist_claimed_by = $claimerId;
                $row->save();
            }

            return $rows;
        });
    }

    public static function releasePosterClaims(array $ids, $failedAt): int
    {
        $query = self::query()->whereIn('id', $ids)->whereNotNull('assist_claimed_at');
        $released = (clone $query)->count();

        (clone $query)->where('poster_status', '!=', 'ready')->update([
            'poster_status' => 'failed',
            'poster_fetched_at' => $failedAt,
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);
        $query->update(['assist_claimed_at' => null, 'assist_claimed_by' => null]);

        return $released;
    }

    public static function assistPosterCounts($leaseFloor): array
    {
        $grouped = self::query()
            ->groupBy('poster_status')
            ->selectRaw('poster_status, count(*) as total')
            ->pluck('total', 'poster_status');
        $leased = self::query()
            ->where('poster_status', 'pending')
            ->where('assist_claimed_at', '>=', $leaseFloor)
            ->count();

        return ['statuses' => $grouped, 'leased' => $leased];
    }
}
