<?php

namespace App\Services\QueueCenter;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Services\Realtime\RealtimeConnectionService;
use App\Support\QueueCenterContract;

class QueueCenterRealtimeService
{
    private const REVISION_KEY = 'queue_center:realtime:revision';
    private const CURSOR_KEY = 'queue_center:realtime:cursor';
    private const CURSOR_CACHE_SECONDS = 1;
    private const SIGNAL_SECONDS = 1;
    private const PENDING_SECONDS = 10;
    private const TRAILING_MARGIN_MICROSECONDS = 100000;
    private const WORK_NODES_KEY = 'queue_center:realtime:work_nodes';
    private const ORCH_CLIENTS_KEY = 'queue_center:realtime:orch_clients';
    private RealtimeConnectionService $connections;

    public function __construct(?RealtimeConnectionService $connections = null)
    {
        $this->connections = $connections ?? new RealtimeConnectionService();
    }

    /**
     * Leading-edge throttled `queue.changed` signal (one per second). A change
     * that lands inside the window is not dropped: it marks the window
     * pending, and one deferred callback per window emits the trailing signal
     * after the response, so the last change of a burst is always signaled.
     */
    public function publish(string $resource, ?string $language = null, int|string|null $id = null): int
    {
        return $this->throttled(self::REVISION_KEY, self::SIGNAL_SECONDS, fn (): int => $this->emit($resource, $language, $id));
    }

    /**
     * Throttled `work_nodes.changed` (contract work_leases.nodes_event): a
     * revision the multi-node panel refetches work_nodes by.
     */
    public function publishWorkNodes(string $reason): int
    {
        $interval = (int) QueueCenterContract::section('work_leases')['nodes_event']['min_interval_seconds'];

        return $this->throttled(self::WORK_NODES_KEY, $interval, function () use ($reason): int {
            $revision = QueueCenterCacheStore::increment(self::WORK_NODES_KEY);
            AppQyV1TranslationEventModel::emit(
                QueueCenterContract::realtimeEvent('work_nodes_changed'),
                ['revision' => $revision, 'reason' => $reason, 'changed_at' => now()->toIso8601String()]
            );

            return $revision;
        });
    }

    /**
     * Throttled `orch_clients.changed` (contract realtime.orch_clients_changed):
     * a revision the orchestration monitor refetches work/monitor by.
     */
    public function publishOrchClients(string $reason): int
    {
        $interval = (int) QueueCenterContract::realtime()['orch_clients_changed']['min_interval_seconds'];

        return $this->throttled(self::ORCH_CLIENTS_KEY, $interval, function () use ($reason): int {
            $revision = QueueCenterCacheStore::increment(self::ORCH_CLIENTS_KEY);
            AppQyV1TranslationEventModel::emit(
                QueueCenterContract::realtimeEvent('orch_clients_changed'),
                ['revision' => $revision, 'reason' => $reason, 'changed_at' => now()->toIso8601String()]
            );

            return $revision;
        });
    }

    /** Current orch_clients.changed revision. */
    public function orchClientsRevision(): int
    {
        return (int) QueueCenterCacheStore::get()->get(self::ORCH_CLIENTS_KEY, 0);
    }

    /** Current work_nodes.changed revision: the cursor a client compares before refetching work_nodes. */
    public function workNodesRevision(): int
    {
        return (int) QueueCenterCacheStore::get()->get(self::WORK_NODES_KEY, 0);
    }

    /**
     * `clip.leased` (contract realtime.clip_leased): resource ids a node just
     * leased, as one {node, ids} event per max_ids chunk; ids only, no text.
     *
     * @param array<int,string> $ids
     */
    public function publishClipLeased(string $node, array $ids): void
    {
        $max = max(1, (int) (QueueCenterContract::realtime()['clip_leased']['max_ids'] ?? 200));

        try {
            foreach (array_chunk(array_values(array_unique($ids)), $max) as $chunk) {
                AppQyV1TranslationEventModel::emit(QueueCenterContract::realtimeEvent('clip_leased'), ['node' => $node, 'ids' => $chunk]);
            }
        } catch (\Throwable) {
        }
    }

    /** Leading edge at most every $seconds per $key; a change inside the window emits one trailing event. */
    private function throttled(string $key, int $seconds, \Closure $emit): int
    {
        try {
            $cache = QueueCenterCacheStore::get();
            if (!$cache->add($key . ':signal', true, $seconds)) {
                $this->scheduleTrailing($key, $seconds, $emit);
                return (int) $cache->get($key, 0);
            }
            $cache->forget($key . ':pending');

            return $emit();
        } catch (\Throwable) {
            return 0;
        }
    }

    private function emit(string $resource, ?string $language, int|string|null $id): int
    {
        $revision = QueueCenterCacheStore::increment(self::REVISION_KEY);

        AppQyV1TranslationEventModel::emit(
            QueueCenterContract::realtimeEvent('queue_changed'),
            [
                'revision' => $revision,
                'resource' => $resource,
                'language' => $language,
                'resource_id' => $id,
                'changed_at' => now()->toIso8601String(),
            ]
        );

        return $revision;
    }

    private function scheduleTrailing(string $key, int $seconds, \Closure $emit): void
    {
        $cache = QueueCenterCacheStore::get();

        $cache->put($key . ':pending', true, self::PENDING_SECONDS);
        if (!$cache->add($key . ':trailing', true, self::PENDING_SECONDS)) {
            return;
        }
        defer(function () use ($key, $seconds, $emit): void {
            $trailingCache = null;

            try {
                $trailingCache = QueueCenterCacheStore::get();
                usleep($seconds * 1000000 + self::TRAILING_MARGIN_MICROSECONDS);
                $trailingCache->forget($key . ':trailing');
                if ($trailingCache->pull($key . ':pending')) {
                    $trailingCache->put($key . ':signal', true, $seconds);
                    $emit();
                }
            } catch (\Throwable) {
            }
        });
    }

    public function revision(): int
    {
        try {
            return (int) QueueCenterCacheStore::get()->get(self::REVISION_KEY, 0);
        } catch (\Throwable) {
            return 0;
        }
    }

    public function publishBatch(string $resource, ?string $language = null, int|string|null $id = null): int
    {
        try {
            QueueCenterCacheStore::get()->forget(self::REVISION_KEY . ':signal');
        } catch (\Throwable) {
            return 0;
        }

        return $this->publish($resource, $language, $id);
    }

    public function connection(): array
    {
        return $this->connections->hubConnection(
            [QueueCenterContract::realtimeTopic()],
            [
                'event' => QueueCenterContract::realtimeEvent('queue_changed'),
                'revision' => $this->revision(),
                'cursor' => $this->cursor(),
            ]
        );
    }

    public function cursor(): int
    {
        return (int) QueueCenterCacheStore::get()->remember(
            self::CURSOR_KEY,
            self::CURSOR_CACHE_SECONDS,
            static fn (): int => AppQyV1TranslationEventModel::maxId()
        );
    }

    public function replay(int $cursor, int $limit): array
    {
        $current = $cursor > 0 ? $cursor : $this->cursor();
        $events = [];
        $rows = [];
        $allowedEvents = [];

        $allowedEvents = array_merge(
            QueueCenterContract::realtimeEvents(),
            AppQyV1TranslationEventModel::applicationEvents()
        );

        if ($cursor > 0) {
            $rows = AppQyV1TranslationEventModel::since($cursor, $limit);
            foreach ($rows as $row) {
                $current = max($current, (int) $row['id']);
                if (!in_array($row['event'], $allowedEvents, true)) {
                    continue;
                }
                $payload = $row['data'];
                $payload['_id'] = (int) $row['id'];
                $events[] = [
                    'id' => (int) $row['id'],
                    'event' => (string) $row['event'],
                    'data' => $payload,
                ];
            }
        }

        return [
            'cursor' => $current,
            'events' => $events,
            'has_more' => count($rows) >= $limit,
        ];
    }
}
