<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayCredentialModel;
use App\Apps\Relay\RelayModels\RelayDeviceModel;
use App\Apps\Relay\RelayModels\RelayEnrollmentModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

final class RelayEnrollmentService
{
    public function __construct(
        private readonly RelayHubService $hub,
        private readonly RelayOutboxRepository $outbox,
        private readonly RelayTopicService $topics,
        private readonly RelayDeviceService $devices
    ) {
    }

    public function create(array $device): array
    {
        $deviceId = (string) $device['device_id'];
        $publicKey = (string) $device['public_key'];
        $connection = DB::connection(RelayTablesMaps::connection());
        $capabilities = RelayContract::normalizeCapabilities($device['capabilities'] ?? []);
        $capabilityDigest = RelayContract::capabilityDigest($capabilities);

        RelayContract::assertSameDigest(
            (string) $device['contract_digest'],
            ['device_id' => $deviceId]
        );
        if (!hash_equals($capabilityDigest, strtolower((string) $device['capability_digest']))) {
            Log::warning('[Relay] Enrollment capability digest rejected', [
                'device_id' => $deviceId,
                'expected_digest' => $capabilityDigest,
                'received_digest' => strtolower((string) $device['capability_digest']),
            ]);
            throw new RelayDomainException('capability_digest_conflict', 409);
        }

        return $connection->transaction(function () use (
            $connection,
            $device,
            $deviceId,
            $publicKey,
            $capabilities
        ): array {
            $connection->select(
                'SELECT pg_advisory_xact_lock(hashtextextended(CAST(? AS text), 0))',
                [$deviceId]
            );
            $enrollment = RelayEnrollmentModel::query()
                ->where('device_id', $deviceId)
                ->where('public_key', $publicKey)
                ->lockForUpdate()
                ->first();
            $claimCode = '';
            $attributes = [];

            if ($enrollment !== null
                && in_array((string) $enrollment->state, [RelayConstants::ENROLLMENT_PENDING, RelayConstants::ENROLLMENT_CLAIMED], true)
                && $enrollment->expires_at->isFuture()) {
                return $this->enrollmentResponse($enrollment, true);
            }
            $claimCode = $this->newClaimCode();
            $attributes = [
                'enrollment_id' => (string) Str::uuid(),
                'device_id' => $deviceId,
                'public_key' => $publicKey,
                'key_algorithm' => (string) $device['key_algorithm'],
                'key_version' => (int) $device['key_version'],
                'label' => (string) $device['label'],
                'platform' => (string) ($device['platform'] ?? ''),
                'capabilities' => $capabilities,
                'capability_digest' => (string) $device['capability_digest'],
                'contract_digest' => (string) $device['contract_digest'],
                'claim_code_hash' => $this->claimCodeHash($claimCode),
                'claim_code_encrypted' => Crypt::encryptString($claimCode),
                'state' => RelayConstants::ENROLLMENT_PENDING,
                'expires_at' => now()->addSeconds(RelayContract::duration('enrollment_retention_seconds')),
                'revision' => 1,
                'claimant_user_id' => null,
                'credential_id' => null,
                'claim_attempts' => 0,
                'claimed_at' => null,
                'revoked_at' => null,
            ];
            if ($enrollment === null) {
                $enrollment = RelayEnrollmentModel::query()->create($attributes);
            } else {
                $attributes['revision'] = (int) $enrollment->revision + 1;
                $enrollment->forceFill($attributes)->save();
            }

            return $this->enrollmentResponse($enrollment, true);
        }, 3);
    }

    public function status(string $enrollmentId, string $deviceId): array
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($enrollmentId, $deviceId): array {
            $enrollment = RelayEnrollmentModel::query()
                ->where('enrollment_id', $enrollmentId)
                ->where('device_id', $deviceId)
                ->lockForUpdate()
                ->first();

            if ($enrollment === null) {
                throw new RelayDomainException('enrollment_not_found', 404);
            }
            if ((string) $enrollment->state === RelayConstants::ENROLLMENT_PENDING
                && $enrollment->expires_at->isPast()) {
                $enrollment->forceFill([
                    'state' => RelayConstants::ENROLLMENT_EXPIRED,
                    'revision' => (int) $enrollment->revision + 1,
                ])->save();
            }

            return $this->enrollmentResponse($enrollment, false);
        }, 3);
    }

    public function claim(int $userId, string $claimCode): array
    {
        $hash = $this->claimCodeHash($claimCode);
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function () use ($userId, $hash): array {
            $enrollment = RelayEnrollmentModel::query()
                ->where('claim_code_hash', $hash)
                ->lockForUpdate()
                ->first();
            $device = null;
            $credential = null;
            $credentialVersion = 0;
            $revokedCredentials = collect();

            if ($enrollment === null) {
                throw new RelayDomainException('claim_code_invalid', 404);
            }
            if ((string) $enrollment->state === RelayConstants::ENROLLMENT_CLAIMED) {
                if ((int) $enrollment->claimant_user_id !== $userId) {
                    throw new RelayDomainException('enrollment_already_claimed', 409);
                }

                return $this->enrollmentResponse($enrollment, false);
            }
            if ((string) $enrollment->state !== RelayConstants::ENROLLMENT_PENDING
                || $enrollment->expires_at->isPast()) {
                throw new RelayDomainException('enrollment_unavailable', 410);
            }
            $device = RelayDeviceModel::query()
                ->where('device_id', (string) $enrollment->device_id)
                ->lockForUpdate()
                ->first();
            if ($device !== null && $device->owner_user_id !== null && (int) $device->owner_user_id !== $userId) {
                throw new RelayDomainException('device_owned_by_another_user', 409);
            }
            $credentialVersion = (int) $enrollment->key_version;
            if ($device !== null && $credentialVersion <= (int) $device->current_credential_version) {
                throw new RelayDomainException('credential_generation_stale', 409);
            }
            $revokedCredentials = RelayCredentialModel::query()
                ->where('device_id', (string) $enrollment->device_id)
                ->where('status', RelayConstants::CREDENTIAL_ACTIVE)
                ->lockForUpdate()
                ->get();
            if ($revokedCredentials->isNotEmpty()) {
                RelayCredentialModel::query()
                    ->whereIn('credential_id', $revokedCredentials->pluck('credential_id')->all())
                    ->update([
                        'status' => RelayConstants::CREDENTIAL_REVOKED,
                        'revoked_at' => now(),
                        'updated_at' => now(),
                    ]);
            }
            $credential = RelayCredentialModel::query()->create([
                'credential_id' => (string) Str::uuid(),
                'device_id' => (string) $enrollment->device_id,
                'credential_version' => $credentialVersion,
                'public_key' => (string) $enrollment->public_key,
                'status' => RelayConstants::CREDENTIAL_ACTIVE,
                'expires_at' => now()->addSeconds(RelayContract::duration('credential_lifetime_seconds')),
            ]);
            if ($device === null) {
                $device = RelayDeviceModel::query()->create([
                    'device_id' => (string) $enrollment->device_id,
                    'owner_user_id' => $userId,
                    'label' => (string) $enrollment->label,
                    'platform' => (string) $enrollment->platform,
                    'capabilities' => $enrollment->capabilities,
                    'capability_digest' => (string) $enrollment->capability_digest,
                    'contract_digest' => (string) $enrollment->contract_digest,
                    'status' => RelayConstants::CREDENTIAL_ACTIVE,
                    'current_credential_version' => $credentialVersion,
                    'credential_expires_at' => $credential->expires_at,
                ]);
            } else {
                $device->forceFill([
                    'owner_user_id' => $userId,
                    'label' => (string) $enrollment->label,
                    'platform' => (string) $enrollment->platform,
                    'capabilities' => $enrollment->capabilities,
                    'capability_digest' => (string) $enrollment->capability_digest,
                    'contract_digest' => (string) $enrollment->contract_digest,
                    'status' => RelayConstants::CREDENTIAL_ACTIVE,
                    'current_credential_version' => $credentialVersion,
                    'credential_expires_at' => $credential->expires_at,
                    'revoked_at' => null,
                ])->save();
            }
            $enrollment->forceFill([
                'state' => RelayConstants::ENROLLMENT_CLAIMED,
                'claimant_user_id' => $userId,
                'credential_id' => (string) $credential->credential_id,
                'claimed_at' => now(),
                'revision' => (int) $enrollment->revision + 1,
            ])->save();
            DB::connection(RelayTablesMaps::connection())->afterCommit(
                fn () => $this->devices->publishPresence($device->fresh())
            );
            foreach ($revokedCredentials as $revokedCredential) {
                $this->outbox->append(
                    'credential',
                    (string) $revokedCredential->credential_id,
                    (int) $revokedCredential->credential_version,
                    RelayContract::event('credential_revoked'),
                    'device',
                    $this->topics->device((string) $enrollment->device_id),
                    [
                        'device_id' => (string) $enrollment->device_id,
                        'credential_id' => (string) $revokedCredential->credential_id,
                        'credential_version' => (int) $revokedCredential->credential_version,
                    ]
                );
            }

            return $this->enrollmentResponse($enrollment, false);
        }, 3);
    }

    public function autoClaimPending(int $userId): int
    {
        $enrollments = RelayEnrollmentModel::query()
            ->where('state', RelayConstants::ENROLLMENT_PENDING)
            ->where('expires_at', '>', now())
            ->orderBy('id')
            ->limit(RelayContract::limit('maintenance_row_batch'))
            ->get();
        $claimed = 0;

        foreach ($enrollments as $enrollment) {
            try {
                $this->claim($userId, Crypt::decryptString((string) $enrollment->claim_code_encrypted));
                $claimed++;
            } catch (RelayDomainException $exception) {
                Log::info('[Relay] Pending enrollment auto-claim skipped', [
                    'enrollment_id' => (string) $enrollment->enrollment_id,
                    'reason' => $exception->relayErrorCode(),
                ]);
            }
        }

        return $claimed;
    }

    private function enrollmentResponse(RelayEnrollmentModel $enrollment, bool $includeClaimCode): array
    {
        $credential = null;
        $device = null;
        $response = [
            'enrollment' => [
                'enrollment_id' => (string) $enrollment->enrollment_id,
                'state' => (string) $enrollment->state,
                'expires_at' => $enrollment->expires_at->toIso8601String(),
            ],
        ];

        if ($includeClaimCode) {
            $response['enrollment']['claim_code'] = Crypt::decryptString((string) $enrollment->claim_code_encrypted);
        }
        if ((string) $enrollment->state === RelayConstants::ENROLLMENT_CLAIMED) {
            $credential = RelayCredentialModel::query()
                ->where('credential_id', (string) $enrollment->credential_id)
                ->first();
            if ($credential === null) {
                throw new RelayDomainException('credential_not_found', 500);
            }
            $response['credential'] = [
                'credential_id' => (string) $credential->credential_id,
                'credential_version' => (int) $credential->credential_version,
            ];
            $device = RelayDeviceModel::query()
                ->where('device_id', (string) $enrollment->device_id)
                ->first();
            if ($device === null) {
                throw new RelayDomainException('device_not_found', 500);
            }
            $response['device'] = $this->devices->descriptor($device);
            $response['hub'] = $this->hub->deviceAuthorization((string) $enrollment->device_id);
        }

        return $response;
    }

    private function newClaimCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = '';

        for ($index = 0; $index < 8; $index++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return substr($code, 0, 4).'-'.substr($code, 4);
    }

    private function claimCodeHash(string $claimCode): string
    {
        $normalized = strtoupper(str_replace(['-', ' '], '', trim($claimCode)));

        return hash_hmac('sha256', $normalized, (string) config('app.key'));
    }
}
