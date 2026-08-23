<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2OutboxModel;
use Illuminate\Support\Str;

final class RelayV2OutboxRepository
{
    private const MAX_ATTEMPTS = 10;

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
        $delay = min(300, 2 ** min($attempts, 8));

        $row->forceFill([
            'state' => $attempts >= self::MAX_ATTEMPTS
                ? RelayV2Constants::OUTBOX_DEAD
                : RelayV2Constants::OUTBOX_PENDING,
            'publish_attempts' => $attempts,
            'next_attempt_at' => now()->addSeconds($delay),
            'last_publish_error' => mb_substr($error, 0, 2000),
            'updated_at' => now(),
        ])->save();
    }
}
