<?php

namespace App\Services\QueueCenter;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Services\Realtime\RealtimeConnectionService;
use App\Support\QueueCenterContract;

class QueueCenterRealtimeService
{
    private const REVISION_KEY = 'queue_center:realtime:revision';
    private RealtimeConnectionService $connections;

    public function __construct(?RealtimeConnectionService $connections = null)
    {
        $this->connections = $connections ?? new RealtimeConnectionService();
    }

    public function publish(string $resource, ?string $language = null, int|string|null $id = null): int
    {
        try {
            $cache = QueueCenterCacheStore::get();
            if (!$cache->add(self::REVISION_KEY . ':signal', true, 1)) {
                return $this->revision();
            }

            $revision = QueueCenterCacheStore::increment(self::REVISION_KEY);
            AppQyV1TranslationEventModel::emit(
                (string) (QueueCenterContract::realtime()['event'] ?? 'queue.changed'),
                [
                    'revision' => $revision,
                    'resource' => $resource,
                    'language' => $language,
                    'resource_id' => $id,
                    'changed_at' => now()->toIso8601String(),
                ]
            );

            return $revision;
        } catch (\Throwable) {
            return 0;
        }
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
        $contract = QueueCenterContract::realtime();

        return $this->connections->hubConnection(
            [(string) ($contract['topic'] ?? 'queue-center')],
            [
                'event' => (string) ($contract['event'] ?? 'queue.changed'),
                'revision' => $this->revision(),
            ]
        );
    }

    public function replay(int $cursor, int $limit): array
    {
        $current = $cursor > 0 ? $cursor : AppQyV1TranslationEventModel::maxId();
        $events = [];
        $rows = [];

        if ($cursor > 0) {
            $rows = AppQyV1TranslationEventModel::since($cursor, $limit);
            foreach ($rows as $row) {
                $current = max($current, (int) $row['id']);
                if (!in_array($row['event'], QueueCenterContract::realtimeEvents(), true)) {
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
