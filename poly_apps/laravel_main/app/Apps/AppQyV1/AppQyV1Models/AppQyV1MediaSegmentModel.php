<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
