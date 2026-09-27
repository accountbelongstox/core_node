<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Support\LaravelServerIdentity;

/**
 * Laravel-side delivery diff (contract: docs_fix/
 * REQUIREMENTS_20260927_LARAVEL_DIFF_DELIVERY_REDIS_INDEX.md, "W7 contract"):
 * pycore posts its inventory per kind in chunks and receives only the items
 * Laravel still needs. Every call is bounded by the chunk limit and a time
 * budget; an unfinished chunk reports next_index so the caller resends the rest.
 */
final class AppQyV1DeliveryDiffService
{
    public const KIND_ORCH_OUTPUT = 'orch_output';
    public const REASON_MISSING = 'missing';
    public const REASON_STALE = 'stale';
    public const ITEM_LIMITS = [
        AppQyV1ResourceIndexService::KIND_WORD_AUDIO => 5000,
        AppQyV1ResourceIndexService::KIND_SENTENCE_AUDIO => 5000,
        AppQyV1ResourceIndexService::KIND_ORCH_SEGMENT => 5000,
        AppQyV1ResourceIndexService::KIND_ARTICLE => 500,
        AppQyV1ResourceIndexService::KIND_STATIC_FILE => 5000,
        self::KIND_ORCH_OUTPUT => 500,
    ];

    private const TIME_BUDGET_SECONDS = 8.0;
    private const SLICE_SIZE = 500;
    private const PER_KEY_QUERY_SLICE_SIZE = 50;

    public function __construct(
        private readonly AppQyV1ResourceIndexService $index,
        private readonly AppQyV1OrchAudioService $orchAudio
    ) {
    }

    public static function kinds(): array
    {
        return array_keys(self::ITEM_LIMITS);
    }

    public function diff(string $machineId, string $kind, array $items): array
    {
        $started = microtime(true);
        $processed = 0;
        $result = [
            'kind' => $kind,
            'server_id' => LaravelServerIdentity::id(),
            'backend' => $kind === self::KIND_ORCH_OUTPUT ? 'database' : $this->index->backend(),
            'received' => count($items),
            'present' => 0,
            'need' => [],
            'rejected' => [],
        ];
        // Orchestration tasks and articles cost queries per key: smaller slices keep the budget check effective.
        $sliceSize = in_array($kind, [self::KIND_ORCH_OUTPUT, AppQyV1ResourceIndexService::KIND_ARTICLE], true)
            ? self::PER_KEY_QUERY_SLICE_SIZE
            : self::SLICE_SIZE;

        if ($kind === self::KIND_ORCH_OUTPUT) {
            $result['tasks'] = [];
        }
        foreach (array_chunk(array_values($items), $sliceSize) as $slice) {
            if ($processed > 0 && microtime(true) - $started >= self::TIME_BUDGET_SECONDS) {
                break;
            }
            if ($kind === self::KIND_ORCH_OUTPUT) {
                $this->diffOrchOutput($machineId, $slice, $result);
            } else {
                $this->diffIndexed($kind, $slice, $result);
            }
            $processed += count($slice);
        }

        return $result + [
            'processed' => $processed,
            'complete' => $processed >= count($items),
            'next_index' => $processed,
            'elapsed_ms' => (int) round((microtime(true) - $started) * 1000),
        ];
    }

    private function diffIndexed(string $kind, array $items, array &$result): void
    {
        $expected = [];
        $states = [];

        foreach ($items as $item) {
            $expected[(string) $item['key']] = $this->expectedValue($kind, $item);
        }
        $states = $this->index->resolve($kind, $expected);
        foreach ($expected as $key => $want) {
            $key = (string) $key;
            $state = $states[$key] ?? ['value' => null, 'rejected' => null];
            if ($state['rejected'] !== null) {
                $result['rejected'][] = ['key' => $key, 'reason' => $state['rejected']];
            } elseif ($state['value'] === null) {
                $result['need'][] = ['key' => $key, 'reason' => self::REASON_MISSING];
            } elseif ($want !== null && !hash_equals($state['value'], $want)) {
                $result['need'][] = ['key' => $key, 'reason' => self::REASON_STALE];
            } else {
                $result['present']++;
            }
        }
    }

    private function diffOrchOutput(string $machineId, array $tasks, array &$result): void
    {
        foreach ($this->orchAudio->diffTasks($machineId, $tasks) as $task) {
            $known = $task['known'];
            unset($task['known']);
            $result['tasks'][] = $task;
            if (!$known) {
                $result['need'][] = ['key' => $task['task_id'], 'reason' => self::REASON_MISSING];
            } elseif (!$task['meta_current'] || $task['segments_missing'] !== []) {
                $result['need'][] = ['key' => $task['task_id'], 'reason' => self::REASON_STALE];
            } else {
                $result['present']++;
            }
        }
    }

    private function expectedValue(string $kind, array $item): ?string
    {
        return match ($kind) {
            AppQyV1ResourceIndexService::KIND_ARTICLE => isset($item['sha256']) ? strtolower((string) $item['sha256']) : null,
            AppQyV1ResourceIndexService::KIND_STATIC_FILE => isset($item['bytes']) ? (string) (int) $item['bytes'] : null,
            default => null,
        };
    }
}
