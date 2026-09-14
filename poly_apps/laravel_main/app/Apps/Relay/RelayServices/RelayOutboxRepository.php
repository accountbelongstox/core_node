<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayOutboxModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Services\Realtime\RealtimeOutboxPublisher;

final class RelayOutboxRepository
{
    public function append(
        string $entityType,
        string $entityId,
        int $revision,
        string $eventType,
        string $topicRole,
        string $topic,
        array $payload,
        bool $private = true
    ): void {
        $eventName = array_search(
            $eventType,
            RelayContract::document()['events'],
            true
        );
        $requiredPayloadFields = [];
        if (!is_string($eventName)) {
            throw new \LogicException(__('relay.outbox_transition_conflict'));
        }
        $requiredPayloadFields = RelayContract::eventPayloadFields($eventName);
        foreach ($requiredPayloadFields as $field) {
            if (!array_key_exists($field, $payload)) {
                throw new \LogicException(__('relay.outbox_transition_conflict'));
            }
        }
        $canonicalPayload = RelayContract::canonicalJson($payload);
        $inserted = RelayOutboxModel::query()->insertOrIgnore([[
            'outbox_id' => (string) Str::uuid(),
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'revision' => $revision,
            'event_type' => $eventType,
            'topic_role' => $topicRole,
            'topic' => $topic,
            'private' => $private,
            'payload' => $canonicalPayload,
            'state' => RelayConstants::OUTBOX_PENDING,
            'publish_attempts' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]]);
        $existing = null;

        if ($inserted === 1) {
            DB::connection(RelayTablesMaps::connection())->afterCommit(
                static fn () => app(RealtimeOutboxPublisher::class)->publishRelay()
            );
            return;
        }
        $existing = RelayOutboxModel::query()
            ->where('entity_type', $entityType)
            ->where('entity_id', $entityId)
            ->where('revision', $revision)
            ->where('event_type', $eventType)
            ->first();
        if ($existing === null
            || (string) $existing->topic_role !== $topicRole
            || (string) $existing->topic !== $topic
            || (bool) $existing->private !== $private
            || !hash_equals((string) $existing->payload, $canonicalPayload)) {
            throw new \LogicException(__('relay.outbox_transition_conflict'));
        }
    }

    public function pending(int $limit): iterable
    {
        return RelayOutboxModel::query()
            ->where('state', RelayConstants::OUTBOX_PENDING)
            ->where(static function ($query): void {
                $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now());
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public function markPublished(RelayOutboxModel $row, string $updateId): void
    {
        $row->forceFill([
            'state' => RelayConstants::OUTBOX_PUBLISHED,
            'hub_update_id' => $updateId,
            'published_at' => now(),
            'last_publish_error' => null,
            'updated_at' => now(),
        ])->save();
    }

    public function markFailed(RelayOutboxModel $row, string $error): void
    {
        $attempts = (int) $row->publish_attempts + 1;
        $delay = min(RelayContract::duration('outbox_retry_max_seconds'), 2 ** min($attempts, 8));

        $row->forceFill([
            'state' => $attempts >= RelayContract::limit('outbox_publish_attempts')
                ? RelayConstants::OUTBOX_DEAD
                : RelayConstants::OUTBOX_PENDING,
            'publish_attempts' => $attempts,
            'next_attempt_at' => now()->addSeconds($delay),
            'last_publish_error' => mb_substr($error, 0, 2000),
            'updated_at' => now(),
        ])->save();
    }

    public function pruneRetained(int $limit): int
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($limit): int {
            $ids = RelayOutboxModel::query()
                ->whereIn('state', [
                    RelayConstants::OUTBOX_PUBLISHED,
                    RelayConstants::OUTBOX_DEAD,
                ])
                ->where('updated_at', '<=', now()->subSeconds(
                    RelayContract::duration('outbox_retention_seconds')
                ))
                ->orderBy('id')
                ->limit($limit)
                ->lock('for update skip locked')
                ->pluck('id')
                ->all();

            if ($ids === []) {
                return 0;
            }

            return RelayOutboxModel::query()->whereIn('id', $ids)->delete();
        }, 3);
    }
}
