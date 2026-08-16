<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

trait QueriesPosterMedia
{
    public static function posterColumnAvailable(string $column): bool
    {
        $model = new static();

        return $model->getConnection()->getSchemaBuilder()->hasColumn($model->getTable(), $column);
    }

    public static function posterStatusCounts(): array
    {
        $base = ['pending' => 0, 'ready' => 0, 'failed' => 0, 'none' => 0, 'total' => 0];
        $cacheKey = 'poster-status:' . static::class;

        return Cache::remember($cacheKey, 5, static function () use ($base): array {
            try {
                $rows = static::query()
                    ->selectRaw('poster_status, COUNT(*) as aggregate')
                    ->groupBy('poster_status')
                    ->pluck('aggregate', 'poster_status');
            } catch (\Throwable $error) {
                Log::warning('[MoviePoster] poster_status count failed', ['error' => $error->getMessage()]);

                return $base;
            }

            $counts = $base;
            $total = 0;
            foreach ($rows as $statusKey => $count) {
                $count = (int) $count;
                $total += $count;
                $key = (string) $statusKey;
                if (array_key_exists($key, $counts)) {
                    $counts[$key] = $count;
                }
            }
            $counts['total'] = $total;

            return $counts;
        });
    }

    public static function posterAssistPage(
        ?string $status,
        int $start,
        int $limit,
        string $search,
        int $leaseMinutes
    ): array {
        $query = static::query();

        if ($status === 'pending') {
            $query->where('poster_status', 'pending');
        } elseif ($status === 'leased') {
            $query->whereNotNull('assist_claimed_at')
                ->where('assist_claimed_at', '>=', now()->subMinutes($leaseMinutes));
        } elseif ($status === 'failed') {
            $query->where('poster_status', 'failed');
        } elseif ($status === 'completed') {
            $query->where('poster_status', 'ready');
        }
        if ($search !== '') {
            $like = '%' . $search . '%';
            $query->where(function ($searchQuery) use ($like): void {
                $searchQuery->whereLike('title', $like, caseSensitive: false)
                    ->orWhereLike('original_name', $like, caseSensitive: false);
            });
        }

        return [
            'total' => (clone $query)->count(),
            'rows' => $query
                ->orderByRaw('poster_fetched_at IS NULL DESC')
                ->orderBy('poster_fetched_at')
                ->limit($start + $limit)
                ->get(['id', 'title', 'original_name', 'poster_status', 'assist_claimed_by', 'assist_claimed_at']),
        ];
    }

    public static function pendingPosterSample(int $limit)
    {
        return static::query()
            ->whereIn('poster_status', ['pending', 'failed'])
            ->limit($limit)
            ->get(['id', 'title', 'original_name']);
    }

    public static function updatePosterPriorityByIds(array $ids, array $updates): int
    {
        return static::query()->whereIn('id', array_values(array_unique($ids)))->update($updates);
    }
}
