<?php

namespace App\Services\QueueCenter;

use App\Events\QueueCenterChangedEvent;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;

class QueueCenterRealtimeService
{
    private const REVISION_KEY = 'queue_center:realtime:revision';

    public function publish(string $resource, ?string $language = null, int|string|null $id = null): int
    {
        try {
            if (!Cache::add(self::REVISION_KEY . ':signal', true, 1)) {
                return $this->revision();
            }

            $revision = $this->revision() + 1;
            Cache::forever(self::REVISION_KEY, $revision);
            QueueCenterChangedEvent::dispatch($revision, $resource, $language, $id);

            return $revision;
        } catch (\Throwable) {
            return 0;
        }
    }

    public function revision(): int
    {
        try {
            return (int) Cache::get(self::REVISION_KEY, 0);
        } catch (\Throwable) {
            return 0;
        }
    }

    public function publishBatch(string $resource, ?string $language = null, int|string|null $id = null): int
    {
        try {
            Cache::forget(self::REVISION_KEY . ':signal');
        } catch (\Throwable) {
            return 0;
        }

        return $this->publish($resource, $language, $id);
    }

    public function connection(): array
    {
        $contract = QueueCenterContract::realtime();
        $options = config('broadcasting.connections.reverb.options', []);

        return [
            'transport' => 'websocket',
            'app_key' => (string) config('broadcasting.connections.reverb.key', ''),
            'host' => (string) ($options['host'] ?? ''),
            'port' => (int) ($options['port'] ?? 8080),
            'scheme' => (string) ($options['scheme'] ?? 'http'),
            'channel' => (string) ($contract['channel'] ?? 'queue-center'),
            'event' => (string) ($contract['event'] ?? 'queue.changed'),
            'revision' => $this->revision(),
        ];
    }
}
