<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


class AppQyV1TtsCacheModel extends AppQyV1Model
{
    public $timestamps = false;

    protected $guarded = [];

    protected ?string $appTableSuffix = 'tts_cache';

    public static function findCached(string $textHash, string $language, string $voice): ?self
    {
        return static::query()
            ->where('text_hash', $textHash)
            ->where('language', $language)
            ->where('voice', $voice)
            ->first();
    }

    public static function storeAudio(string $textHash, string $language, array $attributes): self
    {
        $row = static::query()->where('text_hash', $textHash)->where('language', $language)->first();

        if ($row === null) {
            return static::query()->create(array_merge($attributes, [
                'text_hash' => $textHash,
                'language' => $language,
                'type' => 'word',
                'created_at' => now(),
                'last_accessed' => now(),
                'access_count' => 1,
            ]));
        }

        $row->fill($attributes);
        $row->last_accessed = now();
        $row->save();
        $row->increment('access_count');

        return $row;
    }

    public static function recordAccess(int $cacheId): int
    {
        return static::query()->whereKey($cacheId)->increment('access_count', 1, ['last_accessed' => now()]);
    }

    public static function deleteById(int $cacheId): int
    {
        return static::query()->whereKey($cacheId)->delete();
    }

    public static function olderThan($cutoff)
    {
        return static::query()->where('last_accessed', '<', $cutoff)->get(['id', 'audio_path']);
    }

    public static function deleteOlderThan($cutoff): int
    {
        return static::query()->where('last_accessed', '<', $cutoff)->delete();
    }

    public static function cacheStats(): ?self
    {
        return static::query()
            ->selectRaw('COUNT(*) as total_count')
            ->selectRaw('SUM(audio_size) as total_size')
            ->selectRaw('SUM(access_count) as total_accesses')
            ->selectRaw('COUNT(DISTINCT language) as language_count')
            ->first();
    }
}
