<?php

namespace App\Services\Realtime;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SocialEventModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Services\Relay\RelayHubPublisher;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final class RealtimeOutboxPublisher
{
    private const BATCH_LIMIT = 100;
    private const LOCK_SECONDS = 30;
    private const RETENTION_SECONDS = 600;
    private const LOCK_KEY = 'realtime:outbox:publisher';

    public function publishPending(): array
    {
        // Atomic lock on the DEFAULT cache store (database): the docs list the
        // database driver as lock-capable, and keeping the lock on the shared
        // store (not a host-local file store) holds across every Octane worker.
        $lock = Cache::lock(self::LOCK_KEY, self::LOCK_SECONDS);
        $result = [
            'queue_center' => 0,
            'social' => 0,
        ];

        if (!$lock->get()) {
            return $result;
        }

        try {
            $result['queue_center'] = $this->publishQueueCenter();
            $result['social'] = $this->publishSocial();
            AppQyV1TranslationEventModel::pruneOlderThan(self::RETENTION_SECONDS);
            AppQyV1SocialEventModel::pruneOlderThan(self::RETENTION_SECONDS);
        } finally {
            $lock->release();
        }

        return $result;
    }

    private function publishQueueCenter(): int
    {
        $published = 0;
        $realtime = QueueCenterContract::realtime();
        $topic = (string) ($realtime['topic'] ?? 'queue-center');
        $rows = AppQyV1TranslationEventModel::pendingForPublish(self::BATCH_LIMIT);

        foreach ($rows as $row) {
            $payload = $row->payload();
            $payload['_id'] = (int) $row->id;

            try {
                RelayHubPublisher::publish(
                    $topic,
                    json_encode(['event' => (string) $row->event, 'data' => $payload], JSON_UNESCAPED_SLASHES),
                    false,
                    (string) $row->event
                );
                $row->markPublished();
                $published++;
            } catch (\Throwable $exception) {
                $row->markPublishFailed($exception->getMessage());
                Log::warning('[RealtimeOutboxPublisher] Queue Center publish failed', [
                    'event_id' => (int) $row->id,
                    'event' => (string) $row->event,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $published;
    }

    private function publishSocial(): int
    {
        $published = 0;
        $rows = AppQyV1SocialEventModel::pendingForPublish(self::BATCH_LIMIT);

        foreach ($rows as $row) {
            $payload = $row->payload();
            $payload['_id'] = (int) $row->id;

            try {
                RelayHubPublisher::publish(
                    AppQyV1SocialEventModel::topic((int) $row->user_id),
                    json_encode(['event' => (string) $row->event, 'data' => $payload], JSON_UNESCAPED_SLASHES),
                    true,
                    (string) $row->event
                );
                $row->markPublished();
                $published++;
            } catch (\Throwable $exception) {
                $row->markPublishFailed($exception->getMessage());
                Log::warning('[RealtimeOutboxPublisher] Social publish failed', [
                    'event_id' => (int) $row->id,
                    'user_id' => (int) $row->user_id,
                    'event' => (string) $row->event,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $published;
    }
}
