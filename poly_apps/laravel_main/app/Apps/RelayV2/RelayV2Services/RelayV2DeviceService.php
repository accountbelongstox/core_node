<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2DeviceModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2PairingModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use Illuminate\Support\Facades\DB;

final class RelayV2DeviceService
{
    public function __construct(
        private readonly RelayV2HubService $hub,
        private readonly RelayV2OutboxRepository $outbox,
        private readonly RelayV2TopicService $topics
    ) {
    }

    public function heartbeat(string $deviceId, array $payload): array
    {
        $device = $this->activeDevice($deviceId);
        $capabilities = array_values(array_unique(array_map('strval', $payload['capabilities'] ?? [])));
        $capabilityDigest = '';

        sort($capabilities, SORT_STRING);
        $capabilityDigest = hash('sha256', implode("\n", $capabilities));
        if (!hash_equals(RelayV2Contract::digest(), (string) $payload['contract_digest'])) {
            throw new RelayV2DomainException('contract_digest_conflict', 409);
        }
        $device->forceFill([
            'capabilities' => $capabilities,
            'capability_digest' => $capabilityDigest,
            'contract_digest' => (string) $payload['contract_digest'],
            'last_seen_at' => now(),
        ])->save();

        return [
            'device' => $this->descriptor($device),
            'hub' => $this->hub->deviceAuthorization($deviceId),
        ];
    }

    public function authorization(string $deviceId, string $contractDigest): array
    {
        $this->activeDevice($deviceId);
        if (!hash_equals(RelayV2Contract::digest(), $contractDigest)) {
            throw new RelayV2DomainException('contract_digest_conflict', 409);
        }

        return ['hub' => $this->hub->deviceAuthorization($deviceId)];
    }

    public function event(string $deviceId, array $payload): array
    {
        $eventType = (string) $payload['event_type'];
        $revision = (int) $payload['revision'];
        $eventPayload = is_array($payload['payload'] ?? null) ? $payload['payload'] : [];
        $connection = DB::connection(RelayV2TablesMaps::connection());

        if ($eventType !== RelayV2Contract::event('terminal_changed')) {
            throw new RelayV2DomainException('device_event_invalid', 422);
        }
        if (strlen(RelayV2Contract::canonicalJson($eventPayload)) > RelayV2Contract::limit('device_event_payload_bytes')) {
            throw new RelayV2DomainException('device_event_too_large', 413);
        }

        return $connection->transaction(function () use ($deviceId, $eventType, $revision, $eventPayload): array {
            $device = $this->activeDevice($deviceId);
            $pairings = RelayV2PairingModel::query()
                ->where('device_id', $deviceId)
                ->where('state', RelayV2Constants::PAIRING_ACTIVE)
                ->where('credential_version', (int) $device->current_credential_version)
                ->where('expires_at', '>', now())
                ->get();

            foreach ($pairings as $pairing) {
                $this->outbox->append(
                    'pairing',
                    (string) $pairing->pairing_id,
                    $revision,
                    $eventType,
                    'pairing',
                    $this->topics->pairing((int) $pairing->user_id, (string) $pairing->pairing_id),
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

    public function activeDevice(string $deviceId): RelayV2DeviceModel
    {
        $device = RelayV2DeviceModel::query()->where('device_id', $deviceId)->first();

        if ($device === null
            || (string) $device->status !== RelayV2Constants::CREDENTIAL_ACTIVE
            || $device->revoked_at !== null
            || $device->credential_expires_at === null
            || $device->credential_expires_at->lte(now())) {
            throw new RelayV2DomainException('device_not_found', 404);
        }

        return $device;
    }

    public function descriptor(RelayV2DeviceModel $device): array
    {
        return [
            'device_id' => (string) $device->device_id,
            'label' => (string) $device->label,
            'platform' => (string) $device->platform,
            'status' => (string) $device->status,
            'capabilities' => $device->capabilities ?? [],
            'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            'credential_expires_at' => $device->credential_expires_at?->toIso8601String(),
        ];
    }
}
