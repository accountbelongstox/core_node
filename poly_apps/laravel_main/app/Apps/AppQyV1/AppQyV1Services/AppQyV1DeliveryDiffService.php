<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Support\LaravelServerIdentity;
use App\Support\QueueCenterContract;

/**
 * Laravel-side delivery diff (contract: docs_fix/
 * docs_fix/DESIGN_QUEUE_PIPELINE.md;
 * kinds, item limits and reasons: queue_center_contract.json#delivery):
 * pycore posts its inventory per kind in chunks and receives only the items
 * Laravel still needs. Every call is bounded by the chunk limit and a time
 * budget; an unfinished chunk reports next_index so the caller resends the rest.
 */
final class AppQyV1DeliveryDiffService
{
    public const KIND_ORCH_OUTPUT = 'orch_output';

    private const TIME_BUDGET_SECONDS = 8.0;
    private const SLICE_SIZE = 500;
    private const PER_KEY_QUERY_SLICE_SIZE = 50;

    public function __construct(
        private readonly AppQyV1ResourceIndexService $index,
        private readonly AppQyV1OrchAudioService $orchAudio
    ) {
    }

    /** @return array<string,int> kind => most items one diff call may carry (delivery.diff_item_limits) */
    public static function itemLimits(): array
    {
        $limits = [];

        foreach (array_keys(QueueCenterContract::section('delivery.diff_item_limits')) as $kind) {
            $limits[(string) $kind] = QueueCenterContract::positiveInt('delivery.diff_item_limits.' . $kind);
        }

        return $limits;
    }

    public static function itemLimit(string $kind): int
    {
        return self::itemLimits()[$kind] ?? QueueCenterContract::positiveInt('delivery.diff_item_limit_default');
    }

    /** @return array<int,string> */
    public static function kinds(): array
    {
        return array_keys(self::itemLimits());
    }

    /** delivery.diff_reasons.<role>: missing, stale. */
    public static function reason(string $role): string
    {
        return QueueCenterContract::string('delivery.diff_reasons.' . $role);
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
                $result['need'][] = ['key' => $key, 'reason' => self::reason('missing')];
            } elseif ($want !== null && !hash_equals($state['value'], $want)) {
                $result['need'][] = ['key' => $key, 'reason' => self::reason('stale')];
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
                $result['need'][] = ['key' => $task['task_id'], 'reason' => self::reason('missing')];
            } elseif (!$task['meta_current'] || $task['segments_missing'] !== []) {
                $result['need'][] = ['key' => $task['task_id'], 'reason' => self::reason('stale')];
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
