<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use App\Models\Concerns\QueriesPosterMedia;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Schema;

trait AppQyV1MediaSourceQueries
{
    use QueriesPosterMedia;

    public static function browsePage(?string $language, ?string $search, int $perPage): LengthAwarePaginator
    {
        $query = self::query();

        if ($language !== null && $language !== '') {
            $query->where('language', $language);
        }
        if ($search !== null && $search !== '') {
            $query->where(function (Builder $searchQuery) use ($search): void {
                $searchQuery->whereLike('title', "%{$search}%", caseSensitive: false)
                    ->orWhereLike('original_name', "%{$search}%", caseSensitive: false);
            });
        }

        return $query->orderByDesc('synced_at')->paginate($perPage);
    }

    public static function findBySourceKey(string $sourceKey): ?self
    {
        return self::query()->where('source_key', $sourceKey)->first();
    }

    public static function sourceExists(string $sourceKey): bool
    {
        return self::query()->where('source_key', $sourceKey)->exists();
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
            $claimedAt = now();
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
                ->lock('FOR UPDATE SKIP LOCKED')
                ->get();

            if ($rows->isNotEmpty()) {
                self::query()->whereKey($rows->modelKeys())->update([
                    'assist_claimed_at' => $claimedAt,
                    'assist_claimed_by' => $claimerId,
                ]);
                foreach ($rows as $row) {
                    $row->assist_claimed_at = $claimedAt;
                    $row->assist_claimed_by = $claimerId;
                }
            }

            return $rows;
        });
    }

    public static function releasePosterClaims(array $ids, $failedAt): int
    {
        $query = self::query()->whereIn('id', $ids)->whereNotNull('assist_claimed_at');

        $released = (clone $query)->where('poster_status', '!=', 'ready')->update([
            'poster_status' => 'failed',
            'poster_fetched_at' => $failedAt,
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);
        $released += $query->where('poster_status', 'ready')->update([
            'assist_claimed_at' => null,
            'assist_claimed_by' => null,
        ]);

        return $released;
    }

    public static function assistPosterCounts($leaseFloor): array
    {
        $grouped = self::query()
            ->select('poster_status')
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw(
                'SUM(CASE WHEN poster_status = ? AND assist_claimed_at >= ? THEN 1 ELSE 0 END) AS leased',
                ['pending', $leaseFloor]
            )
            ->groupBy('poster_status')
            ->get();

        return [
            'statuses' => $grouped->pluck('total', 'poster_status'),
            'leased' => (int) $grouped->sum('leased'),
        ];
    }
}
