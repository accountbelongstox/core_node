<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Collection as EloquentCollection;

/**
 * Declared output segment of an orchestration task. Ready when stored_sha256
 * equals the declared audio_sha256. Unique on (task_key, segment_index).
 */
class AppQyV1OrchAudioSegmentModel extends AppQyV1Model
{
    protected ?string $appTableSuffix = 'orch_audio_segments';

    protected $fillable = [
        'task_key',
        'segment_index',
        'sentence_start',
        'sentence_end',
        'status',
        'audio_sha256',
        'audio_bytes',
        'duration_ms',
        'timeline',
        'stored_sha256',
        'started_at',
        'finished_at',
        'stored_at',
    ];

    protected function casts(): array
    {
        return [
            'segment_index' => 'integer',
            'sentence_start' => 'integer',
            'sentence_end' => 'integer',
            'audio_bytes' => 'integer',
            'duration_ms' => 'integer',
            'timeline' => 'array',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'stored_at' => 'datetime',
        ];
    }

    public function isReady(): bool
    {
        return $this->stored_sha256 !== null
            && hash_equals((string) $this->audio_sha256, (string) $this->stored_sha256);
    }

    public static function orderedForTask(string $taskKey): EloquentCollection
    {
        return self::query()->where('task_key', $taskKey)->orderBy('segment_index')->get();
    }

    /** @return array<string,array<int,self>> task_key => segment_index => row */
    public static function mapForTasks(array $taskKeys): array
    {
        $map = [];

        self::query()
            ->whereIn('task_key', array_values(array_unique($taskKeys)))
            ->get()
            ->each(static function (self $row) use (&$map): void {
                $map[(string) $row->task_key][(int) $row->segment_index] = $row;
            });

        return $map;
    }

    public static function findSegment(string $taskKey, int $segmentIndex): ?self
    {
        return self::query()
            ->where('task_key', $taskKey)
            ->where('segment_index', $segmentIndex)
            ->first();
    }

    /** @return array<string,self> task_key => first ready segment */
    public static function firstReadyForTasks(array $taskKeys): array
    {
        $first = [];

        self::query()
            ->whereIn('task_key', array_values(array_unique($taskKeys)))
            ->whereNotNull('stored_sha256')
            ->whereColumn('stored_sha256', 'audio_sha256')
            ->orderBy('segment_index')
            ->get()
            ->each(static function (self $row) use (&$first): void {
                $first[(string) $row->task_key] ??= $row;
            });

        return $first;
    }

    /**
     * Replace the declared segment list of one task: upsert declared rows and
     * delete rows whose index is no longer declared. stored_sha256 is kept so
     * an unchanged segment stays ready.
     */
    public static function replaceDeclared(string $taskKey, array $rows): void
    {
        $indexes = array_map(static fn (array $row): int => (int) $row['segment_index'], $rows);
        $now = now();

        $removed = self::query()->where('task_key', $taskKey);
        if ($indexes !== []) {
            $removed->whereNotIn('segment_index', $indexes);
        }
        $removed->delete();

        if ($rows === []) {
            return;
        }
        self::query()->upsert(
            array_map(static fn (array $row): array => $row + [
                'task_key' => $taskKey,
                'created_at' => $now,
                'updated_at' => $now,
            ], $rows),
            ['task_key', 'segment_index'],
            ['sentence_start', 'sentence_end', 'status', 'audio_sha256', 'audio_bytes',
                'duration_ms', 'timeline', 'started_at', 'finished_at', 'updated_at']
        );
    }

    public static function markStored(string $taskKey, int $segmentIndex, string $sha256): int
    {
        return self::query()
            ->where('task_key', $taskKey)
            ->where('segment_index', $segmentIndex)
            ->where('audio_sha256', $sha256)
            ->update([
                'stored_sha256' => $sha256,
                'stored_at' => now(),
                'updated_at' => now(),
            ]);
    }

    /** @return array{segment_count:int,segments_ready:int,duration_ms:int} */
    public static function countersForTask(string $taskKey): array
    {
        $row = self::query()
            ->where('task_key', $taskKey)
            ->selectRaw('count(*) as segment_count')
            ->selectRaw('sum(case when stored_sha256 = audio_sha256 then 1 else 0 end) as segments_ready')
            ->selectRaw('coalesce(sum(duration_ms), 0) as duration_ms')
            ->first();

        return [
            'segment_count' => (int) ($row->segment_count ?? 0),
            'segments_ready' => (int) ($row->segments_ready ?? 0),
            'duration_ms' => (int) ($row->duration_ms ?? 0),
        ];
    }
}
