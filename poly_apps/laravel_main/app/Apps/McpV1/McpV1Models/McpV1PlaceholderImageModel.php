<?php

namespace App\Apps\McpV1\McpV1Models;

use App\Models\AppModel;

class McpV1PlaceholderImageModel extends AppModel
{
    protected $table = 'placeholder_images';

    protected $fillable = [
        'uuid',
        'filename',
        'width',
        'height',
        'text',
        'type',
        'file_path',
        'file_size',
        'downloaded',
        'downloaded_at',
    ];

    protected $casts = [
        'width' => 'integer',
        'height' => 'integer',
        'file_size' => 'integer',
        'downloaded' => 'boolean',
        'downloaded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function findByUuid(string $uuid): ?self
    {
        return static::query()->where('uuid', $uuid)->first();
    }

    public static function filteredPage(?bool $downloaded, int $perPage, int $page)
    {
        $query = static::query()->orderByDesc('created_at');

        if ($downloaded !== null) {
            $query->where('downloaded', $downloaded);
        }

        return $query->paginate($perPage, ['*'], 'page', $page);
    }

    public static function cleanupOldImages(): int
    {
        $oneDayAgo = now()->subDay();

        $oldImages = self::where('created_at', '<', $oneDayAgo)->get();
        $deletedIds = [];

        foreach ($oldImages as $image) {
            \App\Utils\FileSystemManager::deleteFile($image->file_path);
            $deletedIds[] = (int) $image->id;
        }

        return $deletedIds === [] ? 0 : self::query()->whereKey($deletedIds)->delete();
    }

    public static function markAsDownloaded(string $uuid): bool
    {
        return self::where('uuid', $uuid)->update([
            'downloaded' => true,
            'downloaded_at' => now(),
        ]) > 0;
    }

    public static function getStats(): array
    {
        $stats = self::query()
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw('SUM(CASE WHEN downloaded = true THEN 1 ELSE 0 END) AS downloaded')
            ->selectRaw('SUM(CASE WHEN downloaded = false THEN 1 ELSE 0 END) AS pending')
            ->selectRaw('SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today', [today()])
            ->selectRaw('COALESCE(SUM(file_size), 0) AS total_size')
            ->first();

        return [
            'total' => (int) ($stats->total ?? 0),
            'downloaded' => (int) ($stats->downloaded ?? 0),
            'pending' => (int) ($stats->pending ?? 0),
            'today' => (int) ($stats->today ?? 0),
            'total_size' => (int) ($stats->total_size ?? 0),
        ];
    }
}
