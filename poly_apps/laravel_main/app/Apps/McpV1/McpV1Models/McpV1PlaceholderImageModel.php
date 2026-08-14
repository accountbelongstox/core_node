<?php

namespace App\Apps\McpV1\McpV1Models;

use App\Models\Model;

class McpV1PlaceholderImageModel extends Model
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

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

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
        $deletedCount = 0;

        foreach ($oldImages as $image) {
            \App\Utils\FileSystemManager::deleteFile($image->file_path);
            $image->delete();
            $deletedCount++;
        }

        return $deletedCount;
    }

    public static function markAsDownloaded(string $uuid): bool
    {
        $image = self::where('uuid', $uuid)->first();

        if ($image) {
            $image->downloaded = true;
            $image->downloaded_at = now();
            $image->save();
            return true;
        }

        return false;
    }

    public static function getStats(): array
    {
        return [
            'total' => self::count(),
            'downloaded' => self::where('downloaded', true)->count(),
            'pending' => self::where('downloaded', false)->count(),
            'today' => self::whereDate('created_at', today())->count(),
            'total_size' => self::sum('file_size'),
        ];
    }
}
