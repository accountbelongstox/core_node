<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayDeviceModel;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayPairingService
{
    public function __construct(
        private readonly RelayDeviceService $devices,
        private readonly RelayHubService $hub,
        private readonly RelayPairingEventService $events
    ) {
    }

    public function roster(int $userId): array
    {
        return $this->devices->roster($userId);
    }

    public function create(int $userId, string $deviceId, string $clientInstanceId): array
    {
        $clientHash = $this->clientHash($userId, $clientInstanceId);
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use (
            $connection,
            $userId,
            $deviceId,
            $clientHash
        ): array {
            $pairing = null;
            $expiresAt = null;
            $requiresEvent = false;

            $connection->select(
                'SELECT pg_advisory_xact_lock(hashtextextended(CAST(? AS text), 0))',
                [hash('sha256', $userId."\0".$deviceId."\0".$clientHash)]
            );
            $device = $this->ownedDevice($userId, $deviceId);
            $pairing = RelayPairingModel::query()
                ->where('user_id', $userId)
                ->where('device_id', $deviceId)
                ->where('client_instance_hash', $clientHash)
                ->lockForUpdate()
                ->first();
            $expiresAt = now()->addSeconds(RelayContract::duration('pairing_lease_seconds'));

            if ($pairing === null) {
                $pairing = RelayPairingModel::query()->create([
                    'pairing_id' => (string) Str::uuid(),
                    'user_id' => $userId,
                    'device_id' => $deviceId,
                    'client_instance_hash' => $clientHash,
                    'state' => RelayConstants::PAIRING_ACTIVE,
                    'credential_version' => (int) $device->current_credential_version,
                    'revision' => 1,
                    'last_seen_at' => now(),
                    'expires_at' => $expiresAt,
                ]);
                $requiresEvent = true;
            } elseif ((string) $pairing->state !== RelayConstants::PAIRING_ACTIVE
                || (int) $pairing->credential_version !== (int) $device->current_credential_version
                || $pairing->expires_at->lte(now())) {
                $pairing->forceFill([
                    'state' => RelayConstants::PAIRING_ACTIVE,
                    'credential_version' => (int) $device->current_credential_version,
                    'revision' => (int) $pairing->revision + 1,
                    'last_seen_at' => now(),
                    'expires_at' => $expiresAt,
                    'revoked_at' => null,
                ])->save();
                $requiresEvent = true;
            }
            if ($requiresEvent) {
                $this->events->changed($pairing);
            }

            return ['pairing' => $this->descriptor($pairing)];
        }, 3);
    }

    public function renew(int $userId, string $pairingId): array
    {
        return $this->mutate($userId, $pairingId, RelayConstants::PAIRING_ACTIVE);
    }

    public function revoke(int $userId, string $pairingId): array
    {
        return $this->mutate($userId, $pairingId, RelayConstants::PAIRING_REVOKED);
    }

    public function authorization(int $userId): array
    {
        $pairingTable = RelayTablesMaps::table(RelayTablesMaps::PAIRINGS);
        $deviceTable = RelayTablesMaps::table(RelayTablesMaps::DEVICES);
        $pairingIds = RelayPairingModel::query()
            ->join($deviceTable, $deviceTable.'.device_id', '=', $pairingTable.'.device_id')
            ->where($pairingTable.'.user_id', $userId)
            ->where($pairingTable.'.state', RelayConstants::PAIRING_ACTIVE)
            ->where($pairingTable.'.expires_at', '>', now())
            ->where($deviceTable.'.owner_user_id', $userId)
            ->where($deviceTable.'.status', RelayConstants::CREDENTIAL_ACTIVE)
            ->whereNull($deviceTable.'.revoked_at')
            ->where($deviceTable.'.credential_expires_at', '>', now())
            ->whereColumn($pairingTable.'.credential_version', $deviceTable.'.current_credential_version')
            ->pluck($pairingTable.'.pairing_id')
            ->all();

        return ['hub' => $this->hub->ownerAuthorization($userId, $pairingIds)];
    }

    public function requireActive(int $userId, string $pairingId, bool $lockForUpdate = false): RelayPairingModel
    {
        $query = RelayPairingModel::query()
            ->where('pairing_id', $pairingId)
            ->where('user_id', $userId);
        $pairing = null;

        if ($lockForUpdate) {
            $query->lockForUpdate();
        }
        $pairing = $query->first();

        if ($pairing === null) {
            throw new RelayDomainException('pairing_not_found', 404);
        }
        if ((string) $pairing->state === RelayConstants::PAIRING_EXPIRED) {
            throw new RelayDomainException('pairing_expired', 409);
        }
        if ((string) $pairing->state !== RelayConstants::PAIRING_ACTIVE) {
            throw new RelayDomainException('pairing_inactive', 409);
        }
        if ($pairing->expires_at->lte(now())) {
            throw new RelayDomainException('pairing_expired', 409);
        }
        $this->assertCurrentCredential($pairing);

        return $pairing;
    }

    public function isActiveForDevice(int $userId, string $pairingId, string $deviceId): bool
    {
        $pairing = RelayPairingModel::query()
            ->where('pairing_id', $pairingId)
            ->where('user_id', $userId)
            ->where('device_id', $deviceId)
            ->where('state', RelayConstants::PAIRING_ACTIVE)
            ->where('expires_at', '>', now())
            ->first();
        $device = null;

        if ($pairing === null) {
            return false;
        }
        $device = RelayDeviceModel::query()
            ->where('device_id', $deviceId)
            ->where('owner_user_id', $userId)
            ->where('status', RelayConstants::CREDENTIAL_ACTIVE)
            ->whereNull('revoked_at')
            ->where('credential_expires_at', '>', now())
            ->first();

        return $device !== null
            && (int) $pairing->credential_version === (int) $device->current_credential_version;
    }

    private function mutate(int $userId, string $pairingId, string $targetState): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($userId, $pairingId, $targetState): array {
            $pairing = RelayPairingModel::query()
                ->where('pairing_id', $pairingId)
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();
            $leaseSeconds = RelayContract::duration('pairing_lease_seconds');
            $renewAfter = now()->addSeconds((int) floor($leaseSeconds / 2));
            $requiresMutation = (string) $pairing?->state !== $targetState;
            $device = null;

            if ($pairing === null) {
                throw new RelayDomainException('pairing_not_found', 404);
            }
            if ($targetState === RelayConstants::PAIRING_ACTIVE) {
                $device = $this->ownedDevice($userId, (string) $pairing->device_id);
                if ((int) $pairing->credential_version !== (int) $device->current_credential_version) {
                    $requiresMutation = true;
                }
            }
            if ($targetState === RelayConstants::PAIRING_ACTIVE
                && $pairing->expires_at->lte($renewAfter)) {
                $requiresMutation = true;
            }
            if ($requiresMutation) {
                $pairing->forceFill([
                    'state' => $targetState,
                    'credential_version' => $targetState === RelayConstants::PAIRING_ACTIVE
                        ? (int) $device->current_credential_version
                        : (int) $pairing->credential_version,
                    'revision' => (int) $pairing->revision + 1,
                    'last_seen_at' => now(),
                    'expires_at' => $targetState === RelayConstants::PAIRING_ACTIVE
                        ? now()->addSeconds($leaseSeconds)
                        : $pairing->expires_at,
                    'revoked_at' => $targetState === RelayConstants::PAIRING_REVOKED ? now() : null,
                ])->save();
            }
            if ($requiresMutation) {
                $this->events->changed($pairing);
            }

            return ['pairing' => $this->descriptor($pairing)];
        }, 3);
    }

    private function ownedDevice(int $userId, string $deviceId): RelayDeviceModel
    {
        $device = $this->devices->activeDevice($deviceId);

        if ((int) $device->owner_user_id !== $userId) {
            throw new RelayDomainException('device_not_found', 404);
        }

        return $device;
    }

    private function assertCurrentCredential(RelayPairingModel $pairing): void
    {
        $device = $this->ownedDevice((int) $pairing->user_id, (string) $pairing->device_id);

        if ((int) $pairing->credential_version !== (int) $device->current_credential_version) {
            throw new RelayDomainException('pairing_credential_stale', 409);
        }
    }

    private function descriptor(RelayPairingModel $pairing): array
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
