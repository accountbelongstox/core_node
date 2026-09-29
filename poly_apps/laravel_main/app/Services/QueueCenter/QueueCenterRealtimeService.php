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
    private const TRAILING_DELAY_MICROSECONDS = 1100000;
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
        try {
            $cache = QueueCenterCacheStore::get();
            if (!$cache->add(self::REVISION_KEY . ':signal', true, self::SIGNAL_SECONDS)) {
                $this->scheduleTrailing($resource, $language, $id);
                return $this->revision();
            }
            $cache->forget(self::REVISION_KEY . ':pending');

            return $this->emit($resource, $language, $id);
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

    private function scheduleTrailing(string $resource, ?string $language, int|string|null $id): void
    {
        $cache = QueueCenterCacheStore::get();

        $cache->put(self::REVISION_KEY . ':pending', true, self::PENDING_SECONDS);
        if (!$cache->add(self::REVISION_KEY . ':trailing', true, self::PENDING_SECONDS)) {
            return;
        }
        defer(function () use ($resource, $language, $id): void {
            $trailingCache = null;

            try {
                $trailingCache = QueueCenterCacheStore::get();
                usleep(self::TRAILING_DELAY_MICROSECONDS);
                $trailingCache->forget(self::REVISION_KEY . ':trailing');
                if ($trailingCache->pull(self::REVISION_KEY . ':pending')) {
                    $trailingCache->put(self::REVISION_KEY . ':signal', true, self::SIGNAL_SECONDS);
                    $this->emit($resource, $language, $id);
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
