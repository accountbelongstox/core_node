<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2OutboxModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayV2OutboxRepository
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
            RelayV2Contract::document()['events'],
            true
        );
        $requiredPayloadFields = [];
        if (!is_string($eventName)) {
            throw new \LogicException(__('relay_v2.outbox_transition_conflict'));
        }
        $requiredPayloadFields = RelayV2Contract::eventPayloadFields($eventName);
        foreach ($requiredPayloadFields as $field) {
            if (!array_key_exists($field, $payload)) {
                throw new \LogicException(__('relay_v2.outbox_transition_conflict'));
            }
        }
        $canonicalPayload = RelayV2Contract::canonicalJson($payload);
        $inserted = RelayV2OutboxModel::query()->insertOrIgnore([[
            'outbox_id' => (string) Str::uuid(),
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'revision' => $revision,
            'event_type' => $eventType,
            'topic_role' => $topicRole,
            'topic' => $topic,
            'private' => $private,
            'payload' => $canonicalPayload,
            'state' => RelayV2Constants::OUTBOX_PENDING,
            'publish_attempts' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]]);
        $existing = null;

        if ($inserted === 1) {
            return;
        }
        $existing = RelayV2OutboxModel::query()
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
            throw new \LogicException(__('relay_v2.outbox_transition_conflict'));
        }
    }

    public function pending(int $limit): iterable
    {
        return RelayV2OutboxModel::query()
            ->where('state', RelayV2Constants::OUTBOX_PENDING)
            ->where(static function ($query): void {
                $query->whereNull('next_attempt_at')->orWhere('next_attempt_at', '<=', now());
            })
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public function markPublished(RelayV2OutboxModel $row, string $updateId): void
    {
        $row->forceFill([
            'state' => RelayV2Constants::OUTBOX_PUBLISHED,
            'hub_update_id' => $updateId,
            'published_at' => now(),
            'last_publish_error' => null,
            'updated_at' => now(),
        ])->save();
    }

    public function markFailed(RelayV2OutboxModel $row, string $error): void
    {
        $attempts = (int) $row->publish_attempts + 1;
        $delay = min(RelayV2Contract::duration('outbox_retry_max_seconds'), 2 ** min($attempts, 8));

        $row->forceFill([
            'state' => $attempts >= RelayV2Contract::limit('outbox_publish_attempts')
                ? RelayV2Constants::OUTBOX_DEAD
                : RelayV2Constants::OUTBOX_PENDING,
            'publish_attempts' => $attempts,
            'next_attempt_at' => now()->addSeconds($delay),
            'last_publish_error' => mb_substr($error, 0, 2000),
            'updated_at' => now(),
        ])->save();
    }

    public function pruneRetained(int $limit): int
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($limit): int {
            $ids = RelayV2OutboxModel::query()
                ->whereIn('state', [
                    RelayV2Constants::OUTBOX_PUBLISHED,
                    RelayV2Constants::OUTBOX_DEAD,
                ])
                ->where('updated_at', '<=', now()->subSeconds(
                    RelayV2Contract::duration('outbox_retention_seconds')
                ))
                ->orderBy('id')
                ->limit($limit)
                ->lock('for update skip locked')
                ->pluck('id')
                ->all();

            if ($ids === []) {
                return 0;
            }

            return RelayV2OutboxModel::query()->whereIn('id', $ids)->delete();
        }, 3);
    }
}
