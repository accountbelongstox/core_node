<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

/**
 * Study-content generation segment (Book Study-Content Generation pipeline §3.1 —
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md).
 *
 * One row per planned ~500-char segment of a source (book|article|document).
 * THE anchor everything generated hangs off of, and the 60-minute claim lease
 * (claimed_at/claimed_by). Unique on (source_type, source_key, segment_index).
 */
class AppQyV1StudySegmentModel extends AppQyV1Model
{
    use RunsModelTransactions;


    protected ?string $appTableSuffix = 'study_segments';

    protected $fillable = [
        'source_type',
        'source_key',
        'segment_index',
        'grain',
        'seq_start',
        'seq_end',
        'chapter_index',
        'primary_language',
        'char_count',
        'status',
        'attempts',
        'error',
        'claimed_at',
        'claimed_by',
        'languages_done',
        'provider',
        'generated_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'segment_index' => 'integer',
            'seq_start' => 'integer',
            'seq_end' => 'integer',
            'chapter_index' => 'integer',
            'char_count' => 'integer',
            'attempts' => 'integer',
            'claimed_at' => 'datetime',
            'languages_done' => 'array',
            'generated_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public static function countForSource(string $sourceType, string $sourceKey): int
    {
        return self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey)->count();
    }

    public static function hasGeneratedSourceRows(string $sourceType, string $sourceKey): bool
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->whereIn('status', ['done', 'generating'])
            ->exists();
    }

    public static function deleteForSource(string $sourceType, string $sourceKey): int
    {
        return self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey)->delete();
    }

    public static function createPlanRows(array $rows): void
    {
        self::runInTransaction(static function () use ($rows): void {
            foreach ($rows as $row) {
                self::query()->create($row);
            }
        });
    }

    public static function statusCountsForSources(string $sourceType, array $sourceKeys): EloquentCollection
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->whereIn('source_key', array_values(array_unique($sourceKeys)))
            ->groupBy('source_key', 'status')
            ->selectRaw('source_key, status, count(*) as total')
            ->get();
    }

    public static function claimForSource(
        string $sourceType,
        string $sourceKey,
        ?int $segmentIndex,
        int $limit,
        string $claimerId,
        int $leaseMinutes
    ): array {
        return self::runInTransaction(static function () use (
            $sourceType,
            $sourceKey,
            $segmentIndex,
            $limit,
            $claimerId,
            $leaseMinutes
        ): array {
            $leaseFloor = now()->subMinutes($leaseMinutes);
            $query = self::query()
                ->where('source_type', $sourceType)
                ->where('source_key', $sourceKey)
                ->where(function ($claimable) use ($leaseFloor): void {
                    $claimable->where('status', 'pending')
                        ->orWhere('status', 'failed')
                        ->orWhere(function ($expired) use ($leaseFloor): void {
                            $expired->where('status', '!=', 'done')
                                ->whereNotNull('claimed_at')
                                ->where('claimed_at', '<', $leaseFloor);
                        });
                });

            if ($segmentIndex !== null) {
                $query->where('segment_index', $segmentIndex);
            }

            $rows = $query->orderBy('segment_index')->limit($limit)->lockForUpdate()->get();
            $ids = $rows->modelKeys();

            if ($ids !== []) {
                self::query()->whereKey($ids)->increment('attempts', 1, [
                    'status' => 'generating',
                    'claimed_at' => now(),
                    'claimed_by' => $claimerId,
                    'error' => null,
                ]);
            }

            return array_map('intval', $ids);
        });
    }

    public static function orderedByIds(array $ids): EloquentCollection
    {
        return self::query()->whereIn('id', $ids)->orderBy('segment_index')->get();
    }

    public static function findSourceSegment(string $sourceType, string $sourceKey, int $segmentIndex): ?self
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('segment_index', $segmentIndex)
            ->first();
    }

    public static function releaseLeases(
        string $sourceType,
        string $sourceKey,
        array $segmentIndexes,
        ?string $error
    ): int {
        $query = self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->whereIn('segment_index', $segmentIndexes)
            ->whereNotNull('claimed_at')
            ->where('status', '!=', 'done');
        $attributes = [
            'status' => $error !== null && $error !== '' ? 'failed' : 'pending',
            'claimed_at' => null,
            'claimed_by' => null,
        ];

        if ($error !== null && $error !== '') {
            $attributes['error'] = mb_substr($error, 0, 2000);
        }

        return $query->update($attributes);
    }

    public static function orderedForSource(string $sourceType, string $sourceKey): EloquentCollection
    {
        return self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->orderBy('segment_index')
            ->get();
    }

    public static function findContentSegment(
        string $sourceType,
        string $sourceKey,
        ?int $segmentIndex,
        ?int $sequence
    ): ?self {
        $query = self::query()->where('source_type', $sourceType)->where('source_key', $sourceKey);

        if ($segmentIndex !== null) {
            $query->where('segment_index', $segmentIndex);
        } else {
            $query->where('seq_start', '<=', $sequence)->where('seq_end', '>=', $sequence);
        }

        return $query->orderBy('segment_index')->first();
    }

    public static function progressForSource(string $sourceType, string $sourceKey): array
    {
        $byStatus = self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->pluck('total', 'status');
        $languages = [];

        self::query()
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('status', 'done')
            ->select('languages_done')
            ->chunk(500, static function ($rows) use (&$languages): void {
                foreach ($rows as $row) {
                    foreach (is_array($row->languages_done) ? $row->languages_done : [] as $code) {
                        $languages[(string) $code] = true;
                    }
                }
            });

        return [
            'counts' => $byStatus,
            'languages' => array_keys($languages),
        ];
    }
}
