<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayDeviceModel;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayDeviceService
{
    public function __construct(
        private readonly RelayHubService $hub,
        private readonly RelayOutboxRepository $outbox,
        private readonly RelayTopicService $topics
    ) {
    }

    public function heartbeat(string $deviceId, array $payload): array
    {
        $device = $this->activeDevice($deviceId);
        $capabilities = RelayContract::normalizeCapabilities($payload['capabilities'] ?? []);
        $capabilityDigest = RelayContract::capabilityDigest($capabilities);

        RelayContract::assertSameDigest(
            (string) $payload['contract_digest'],
            ['device_id' => $deviceId]
        );
        $device->forceFill([
            'capabilities' => $capabilities,
            'capability_digest' => $capabilityDigest,
            'contract_digest' => (string) $payload['contract_digest'],
            'last_seen_at' => ($payload['online'] ?? true) ? now() : null,
        ])->save();
        $this->publishPresence($device);

        return [
            'device' => $this->descriptor($device),
        ];
    }

    public function authorization(string $deviceId, string $contractDigest): array
    {
        $this->activeDevice($deviceId);
        RelayContract::assertSameDigest($contractDigest, ['device_id' => $deviceId]);

        return ['hub' => $this->hub->deviceAuthorization($deviceId)];
    }

    public function event(string $deviceId, array $payload): array
    {
        $eventType = (string) $payload['event_type'];
        $revision = (int) $payload['revision'];
        $eventPayload = is_array($payload['payload'] ?? null) ? $payload['payload'] : [];
        $connection = DB::connection(RelayTablesMaps::connection());

        $allowedEvents = [
            RelayContract::event('terminal_changed'),
            RelayContract::event('agent_history_prompt_new'),
            RelayContract::event('agent_history_prompt_derived'),
        ];
        if (!in_array($eventType, $allowedEvents, true)) {
            throw new RelayDomainException('device_event_invalid', 422);
        }
        if (strlen(RelayContract::canonicalJson($eventPayload)) > RelayContract::limit('device_event_payload_bytes')) {
            throw new RelayDomainException('device_event_too_large', 413);
        }

        return $connection->transaction(function () use ($deviceId, $eventType, $revision, $eventPayload): array {
            $device = $this->activeDevice($deviceId);
            $pairings = RelayPairingModel::query()
                ->where('device_id', $deviceId)
                ->where('state', RelayConstants::PAIRING_ACTIVE)
                ->where('credential_version', (int) $device->current_credential_version)
                ->where('expires_at', '>', now())
                ->get()->unique('user_id');

            foreach ($pairings as $pairing) {
                $this->outbox->append(
                    'pairing',
                    (string) $pairing->pairing_id,
                    $revision,
                    $eventType,
                    'owner',
                    $this->topics->owner((int) $pairing->user_id),
                    [
                        'pairing_id' => (string) $pairing->pairing_id,
                        'device_id' => $deviceId,
                        'revision' => $revision,
                        'metadata' => $eventPayload,
                    ]
                );
            }
            $device->forceFill(['last_seen_at' => now()])->save();

            return ['accepted' => true, 'revision' => $revision];
        }, 3);
    }

    public function activeDevice(string $deviceId): RelayDeviceModel
    {
        $device = RelayDeviceModel::query()->where('device_id', $deviceId)->first();

        if ($device === null
            || (string) $device->status !== RelayConstants::CREDENTIAL_ACTIVE
            || $device->revoked_at !== null
            || $device->credential_expires_at === null
            || $device->credential_expires_at->lte(now())) {
            throw new RelayDomainException('device_not_found', 404);
        }

        return $device;
    }

    public function descriptor(RelayDeviceModel $device): array
    {
        return [
            'device_id' => (string) $device->device_id,
            'group_id' => $this->topics->owner((int) $device->owner_user_id),
            'online' => $device->last_seen_at !== null
                && $device->last_seen_at->gt(now()->subSeconds(RelayContract::duration('presence_timeout_seconds'))),
            'label' => (string) $device->label,
            'platform' => (string) $device->platform,
            'status' => (string) $device->status,
            'capabilities' => $device->capabilities ?? [],
            'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            'credential_expires_at' => $device->credential_expires_at?->toIso8601String(),
        ];
    }

    public function roster(int $userId): array
    {
        $snapshot = $this->rosterSnapshot($userId);

        return array_merge($snapshot, [
            'server_time_unix' => microtime(true),
            'group_id' => $this->topics->owner($userId),
            'unavailable_code' => $snapshot['devices'] === [] ? 'RELAY_GROUP_EMPTY' : null,
            'unavailable_message' => $snapshot['devices'] === [] ? __('relay.group_empty') : null,
        ]);
    }

    private function rosterSnapshot(int $userId): array
    {
        $devices = RelayDeviceModel::query()
            ->whereIn('owner_user_id', RelayFleetScope::deviceOwnerIds($userId))
            ->where('status', RelayConstants::CREDENTIAL_ACTIVE)
            ->whereNull('revoked_at')
            ->where('credential_expires_at', '>', now())
            ->orderByDesc('last_seen_at')
            ->orderBy('label')
            ->get()
            ->map(fn ($device): array => $this->descriptor($device))
            ->all();
        $recommended = collect($devices)->first(
            static fn (array $device): bool => (bool) ($device['online'] ?? false)
        );
        $selectionReason = 'freshest_online';

        if (!is_array($recommended)) {
            $recommended = $devices[0] ?? null;
            $selectionReason = is_array($recommended) ? 'most_recent_known' : 'no_owned_device';
        }

        return [
            'devices' => $devices,
            'recommended_device_id' => is_array($recommended)
                ? (string) $recommended['device_id']
                : null,
            'selection_reason' => $selectionReason,
        ];
    }

    public function publishPresence(RelayDeviceModel $device): void
    {
        $descriptor = $this->descriptor($device);

        foreach (RelayFleetScope::presenceAudienceIds((int) $device->owner_user_id) as $audienceId) {
            $snapshot = $this->rosterSnapshot($audienceId);

            $this->outbox->append('presence', (string) Str::uuid(), 1,
                RelayContract::event('device_presence'), 'owner', $this->topics->owner($audienceId),
                [
                    'server_time_unix' => microtime(true),
                    'device_id' => (string) $device->device_id,
                    'online' => $descriptor['online'],
                    'device' => $descriptor,
                    'recommended_device_id' => $snapshot['recommended_device_id'],
                    'selection_reason' => $snapshot['selection_reason'],
                ]);
        }
    }

    public function expirePresence(): void
    {
        $cutoff = now()->subSeconds(RelayContract::duration('presence_timeout_seconds'));
        $devices = RelayDeviceModel::query()->whereNotNull('last_seen_at')
            ->where('last_seen_at', '<=', $cutoff)
            ->limit(RelayContract::limit('maintenance_row_batch'))->get();

        foreach ($devices as $device) {
            if (RelayDeviceModel::query()->where('device_id', $device->device_id)
                ->where('last_seen_at', '<=', $cutoff)->update(['last_seen_at' => null]) === 1) {
                $device->refresh();
                $this->publishPresence($device);
            }
        }
    }

}
