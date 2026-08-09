<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use Illuminate\Pagination\LengthAwarePaginator;

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
}
