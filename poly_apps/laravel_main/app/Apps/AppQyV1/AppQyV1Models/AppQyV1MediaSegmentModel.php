<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;

class AppQyV1MediaSegmentModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'media_segments';

    protected $fillable = [
        'source_key',
        'seg_index',
        'start_sec',
        'end_sec',
        'mp4',
        'full_mp4',
        'mp3',
        'sub_idx_start',
        'sub_idx_end',
        'subtitle_count',
        'clip_status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'seg_index' => 'integer',
            'start_sec' => 'float',
            'end_sec' => 'float',
            'sub_idx_start' => 'integer',
            'sub_idx_end' => 'integer',
            'subtitle_count' => 'integer',
            'clip_status' => 'array',
            'metadata' => 'array',
        ];
    }

    public function subtitle(): BelongsTo
    {
        return $this->belongsTo(AppQyV1SubtitleModel::class, 'source_key', 'source_key');
    }

    public static function orderedForSource(string $sourceKey): Collection
    {
        return self::query()->where('source_key', $sourceKey)->orderBy('seg_index')->get();
    }

    public static function findForSourceIndex(string $sourceKey, int $segmentIndex): ?self
    {
        return self::query()
            ->where('source_key', $sourceKey)
            ->where('seg_index', $segmentIndex)
            ->first();
    }

}
