<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Utils\RunsModelTransactions;

/**
 * Pycore audio-orchestration task delivered to Laravel. Unique on
 * (machine_id, task_id); task_key is the public identity.
 */
class AppQyV1OrchAudioTaskModel extends AppQyV1Model
{
    use RunsModelTransactions;

    public const TASK_KEY_LENGTH = 40;

    protected ?string $appTableSuffix = 'orch_audio_tasks';

    protected $fillable = [
        'task_key',
        'machine_id',
        'task_id',
        'source',
        'name',
        'language',
        'status',
        'meta_hash',
        'source_ref',
        'source_text',
        'preview_text',
        'pattern',
        'sentences',
        'resources',
        'sentence_count',
        'segment_count',
        'segments_ready',
        'duration_ms',
        'task_created_at',
        'task_updated_at',
        'generation_started_at',
        'generation_finished_at',
    ];

    protected function casts(): array
    {
        return [
            'source_ref' => 'array',
            'pattern' => 'array',
            'sentences' => 'array',
            'resources' => 'array',
            'sentence_count' => 'integer',
            'segment_count' => 'integer',
            'segments_ready' => 'integer',
            'duration_ms' => 'integer',
            'task_created_at' => 'datetime',
            'task_updated_at' => 'datetime',
            'generation_started_at' => 'datetime',
            'generation_finished_at' => 'datetime',
        ];
    }

    public static function taskKey(string $machineId, string $taskId): string
    {
        return substr(hash('sha256', $machineId . "\n" . $taskId), 0, self::TASK_KEY_LENGTH);
    }

    public static function findByTaskKey(string $taskKey): ?self
    {
        return self::query()->where('task_key', $taskKey)->first();
    }

    /** @return array<string,self> keyed by task_key */
    public static function mapByTaskKeys(array $taskKeys): array
    {
        return self::query()
            ->whereIn('task_key', array_values(array_unique($taskKeys)))
            ->get()
            ->keyBy('task_key')
            ->all();
    }

    public static function page(?string $source, ?string $search, int $page, int $perPage): array
    {
        $query = self::query()->select([
            'id', 'task_key', 'machine_id', 'task_id', 'source', 'name', 'language', 'status',
            'source_ref', 'preview_text', 'sentence_count', 'segment_count', 'segments_ready', 'duration_ms',
            'task_created_at', 'task_updated_at', 'generation_started_at', 'generation_finished_at',
            'created_at', 'updated_at',
        ]);

        if ($source !== null && $source !== '') {
            $query->where('source', $source);
        }
        if ($search !== null && $search !== '') {
            $query->where('name', 'ilike', '%' . addcslashes($search, '%_\\') . '%');
        }
        $total = (clone $query)->count();
        $items = $query
            ->orderByDesc('task_updated_at')
            ->orderByDesc('id')
            ->forPage($page, $perPage)
            ->get();

        return ['items' => $items, 'total' => $total];
    }

    /** @return array<int,array{id:string,count:int}> */
    public static function sourceCounts(): array
    {
        return self::query()
            ->groupBy('source')
            ->orderBy('source')
            ->selectRaw('source, count(*) as total')
            ->get()
            ->map(static fn ($row): array => ['id' => (string) $row->source, 'count' => (int) $row->total])
            ->all();
    }

    public static function refreshSegmentCounters(string $taskKey): void
    {
        $counters = AppQyV1OrchAudioSegmentModel::countersForTask($taskKey);

        self::query()->where('task_key', $taskKey)->update([
            'segment_count' => $counters['segment_count'],
            'segments_ready' => $counters['segments_ready'],
            'duration_ms' => $counters['duration_ms'],
            'updated_at' => now(),
        ]);
    }
}
