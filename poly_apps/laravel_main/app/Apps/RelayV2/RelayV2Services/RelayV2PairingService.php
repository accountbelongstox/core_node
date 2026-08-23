<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2DeviceModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2PairingModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayV2PairingService
{
    public function __construct(
        private readonly RelayV2DeviceService $devices,
        private readonly RelayV2HubService $hub,
        private readonly RelayV2OutboxRepository $outbox,
        private readonly RelayV2TopicService $topics
    ) {
    }

    public function roster(int $userId): array
    {
        $devices = RelayV2DeviceModel::query()
            ->where('owner_user_id', $userId)
            ->where('status', RelayV2Constants::CREDENTIAL_ACTIVE)
            ->whereNull('revoked_at')
            ->orderBy('label')
            ->get();

        return ['devices' => $devices->map(fn ($device): array => $this->devices->descriptor($device))->all()];
    }

    public function create(int $userId, string $deviceId, string $clientInstanceId): array
    {
        $clientHash = $this->clientHash($userId, $clientInstanceId);
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($userId, $deviceId, $clientHash): array {
            $device = $this->ownedDevice($userId, $deviceId);
            $pairing = RelayV2PairingModel::query()
                ->where('user_id', $userId)
                ->where('device_id', $deviceId)
                ->where('client_instance_hash', $clientHash)
                ->lockForUpdate()
                ->first();
            $expiresAt = now()->addSeconds(RelayV2Contract::duration('pairing_lease_seconds'));

            if ($pairing === null) {
                $pairing = RelayV2PairingModel::query()->create([
                    'pairing_id' => (string) Str::uuid(),
                    'user_id' => $userId,
                    'device_id' => $deviceId,
                    'client_instance_hash' => $clientHash,
                    'state' => RelayV2Constants::PAIRING_ACTIVE,
                    'credential_version' => (int) $device->current_credential_version,
                    'revision' => 1,
                    'last_seen_at' => now(),
                    'expires_at' => $expiresAt,
                ]);
            } elseif ((string) $pairing->state !== RelayV2Constants::PAIRING_ACTIVE
                || (int) $pairing->credential_version !== (int) $device->current_credential_version
                || $pairing->expires_at->lte(now())) {
                $pairing->forceFill([
                    'state' => RelayV2Constants::PAIRING_ACTIVE,
                    'credential_version' => (int) $device->current_credential_version,
                    'revision' => (int) $pairing->revision + 1,
                    'last_seen_at' => now(),
                    'expires_at' => $expiresAt,
                    'revoked_at' => null,
                ])->save();
            }
            $this->notifyOwner($pairing);

            return ['pairing' => $this->descriptor($pairing)];
        }, 3);
    }

    public function renew(int $userId, string $pairingId): array
    {
        return $this->mutate($userId, $pairingId, RelayV2Constants::PAIRING_ACTIVE);
    }

    public function revoke(int $userId, string $pairingId): array
    {
        return $this->mutate($userId, $pairingId, RelayV2Constants::PAIRING_REVOKED);
    }

    public function authorization(int $userId): array
    {
        $pairingIds = RelayV2PairingModel::query()
            ->where('user_id', $userId)
            ->where('state', RelayV2Constants::PAIRING_ACTIVE)
            ->where('expires_at', '>', now())
            ->pluck('pairing_id')
            ->all();

        return ['hub' => $this->hub->ownerAuthorization($userId, $pairingIds)];
    }

    public function requireActive(int $userId, string $pairingId): RelayV2PairingModel
    {
        $pairing = RelayV2PairingModel::query()
            ->where('pairing_id', $pairingId)
            ->where('user_id', $userId)
            ->where('state', RelayV2Constants::PAIRING_ACTIVE)
            ->where('expires_at', '>', now())
            ->first();

        if ($pairing === null) {
            throw new RelayV2DomainException('pairing_not_found', 404);
        }

        return $pairing;
    }

    private function mutate(int $userId, string $pairingId, string $targetState): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($userId, $pairingId, $targetState): array {
            $pairing = RelayV2PairingModel::query()
                ->where('pairing_id', $pairingId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();
            $leaseSeconds = RelayV2Contract::duration('pairing_lease_seconds');
            $renewAfter = now()->addSeconds((int) floor($leaseSeconds / 2));
            $requiresMutation = (string) $pairing?->state !== $targetState;

            if ($pairing === null) {
                throw new RelayV2DomainException('pairing_not_found', 404);
            }
            if ($targetState === RelayV2Constants::PAIRING_ACTIVE
                && $pairing->expires_at->lte($renewAfter)) {
                $requiresMutation = true;
            }
            if ($requiresMutation) {
                $pairing->forceFill([
                    'state' => $targetState,
                    'revision' => (int) $pairing->revision + 1,
                    'last_seen_at' => now(),
                    'expires_at' => $targetState === RelayV2Constants::PAIRING_ACTIVE
                        ? now()->addSeconds($leaseSeconds)
                        : $pairing->expires_at,
                    'revoked_at' => $targetState === RelayV2Constants::PAIRING_REVOKED ? now() : null,
                ])->save();
                $this->notifyOwner($pairing);
            }

            return ['pairing' => $this->descriptor($pairing)];
        }, 3);
    }

    private function ownedDevice(int $userId, string $deviceId): RelayV2DeviceModel
    {
        $device = $this->devices->activeDevice($deviceId);

        if ((int) $device->owner_user_id !== $userId) {
            throw new RelayV2DomainException('device_not_found', 404);
        }

        return $device;
    }

    private function notifyOwner(RelayV2PairingModel $pairing): void
    {
        $this->outbox->append(
            'pairing',
            (string) $pairing->pairing_id,
            (int) $pairing->revision,
            'relay.pairing.changed',
            'owner',
            $this->topics->owner((int) $pairing->user_id),
            ['pairing_id' => (string) $pairing->pairing_id, 'revision' => (int) $pairing->revision]
        );
    }

    private function descriptor(RelayV2PairingModel $pairing): array
    {
        return [
            'pairing_id' => (string) $pairing->pairing_id,
            'device_id' => (string) $pairing->device_id,
            'state' => (string) $pairing->state,
            'revision' => (int) $pairing->revision,
            'expires_at' => $pairing->expires_at->toIso8601String(),
        ];
    }

    private function clientHash(int $userId, string $clientInstanceId): string
    {
        return hash_hmac('sha256', $userId."\0".$clientInstanceId, (string) config('app.key'));
    }
}
