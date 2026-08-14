<?php

namespace App\Services\QueueCenter;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

class QueueHeadNotificationService
{
    private const REVISION_PREFIX = 'queue_center:head_notifications:v3:revision:';
    private const EMITTED_PREFIX = 'queue_center:head_notifications:v3:emitted:';

    public function record(string $queue): void
    {
        QueueCenterCacheStore::increment($this->revisionKey($queue));
    }

    public function flush(): int
    {
        $cache = QueueCenterCacheStore::get();
        $events = QueueCenterContract::realtime()['events'] ?? [];
        $emitted = 0;
        foreach (QueueCenterContract::queuePositionOrderedControlNames() as $queue) {
            $revision = (int) $cache->get($this->revisionKey($queue), 0);
            $emittedRevision = (int) $cache->get($this->emittedKey($queue), 0);
            if ($revision <= $emittedRevision) {
                continue;
            }

            $event = $events[$queue . '_head'] ?? null;
            $task = GlobalTask::pendingHeadTask($queue);
            if (!is_string($event) || $event === '' || !($task instanceof GlobalTask)) {
                $cache->forever($this->emittedKey($queue), $revision);
                continue;
            }
            $payload = is_array($task->payload) ? $task->payload : [];
            $item = [
                'queue' => $queue,
                'task_id' => (string) $task->task_id,
                'dedup_key' => (string) ($task->group_key ?? ''),
                'language' => $payload['language'] ?? null,
                'queue_position' => (int) $task->queue_position,
                'md5' => $payload['md5'] ?? null,
                'word' => $payload['word'] ?? ($payload['content'] ?? null),
                'content_id' => $payload['content_id'] ?? null,
                'text' => $payload['text'] ?? ($payload['content'] ?? null),
            ];
            AppQyV1TranslationEventModel::emit($event, [
                'queue' => $queue,
                'count' => 1,
                'items' => [$item],
                'head_task_id' => (string) ($item['task_id'] ?? ''),
                'queue_position' => (int) ($item['queue_position'] ?? 0),
            ]);
            $cache->forever($this->emittedKey($queue), $revision);
            $emitted++;
        }

        return $emitted;
    }

    private function revisionKey(string $queue): string
    {
        return self::REVISION_PREFIX . sha1($queue);
    }

    private function emittedKey(string $queue): string
    {
        return self::EMITTED_PREFIX . sha1($queue);
    }
}
