<?php

namespace App\Utils;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

trait CountsPosterStatuses
{
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
}
