<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2CredentialModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2DeviceModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2EnrollmentModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RelayV2EnrollmentService
{
    public function __construct(
        private readonly RelayV2HubService $hub,
        private readonly RelayV2OutboxRepository $outbox,
        private readonly RelayV2TopicService $topics
    ) {
    }

    public function create(array $device): array
    {
        $deviceId = (string) $device['device_id'];
        $publicKey = (string) $device['public_key'];
        $connection = DB::connection(RelayV2TablesMaps::connection());
        $capabilities = array_values(array_unique(array_map('strval', $device['capabilities'] ?? [])));
        $capabilityDigest = '';

        sort($capabilities, SORT_STRING);
        $capabilityDigest = hash('sha256', implode("\n", $capabilities));
        if (!hash_equals(RelayV2Contract::digest(), (string) $device['contract_digest'])) {
            throw new RelayV2DomainException('contract_digest_conflict', 409);
        }
        if (!hash_equals($capabilityDigest, strtolower((string) $device['capability_digest']))) {
            throw new RelayV2DomainException('capability_digest_conflict', 409);
        }

        return $connection->transaction(function () use ($device, $deviceId, $publicKey, $capabilities): array {
            $enrollment = RelayV2EnrollmentModel::query()
                ->where('device_id', $deviceId)
                ->where('public_key', $publicKey)
                ->lockForUpdate()
                ->first();
            $claimCode = '';
            $attributes = [];

            if ($enrollment !== null
                && in_array((string) $enrollment->state, [RelayV2Constants::ENROLLMENT_PENDING, RelayV2Constants::ENROLLMENT_CLAIMED], true)
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
                'state' => RelayV2Constants::ENROLLMENT_PENDING,
                'expires_at' => now()->addSeconds(RelayV2Contract::duration('enrollment_retention_seconds')),
                'revision' => 1,
                'claimant_user_id' => null,
                'credential_id' => null,
                'claim_attempts' => 0,
                'claimed_at' => null,
                'revoked_at' => null,
            ];
            if ($enrollment === null) {
                $enrollment = RelayV2EnrollmentModel::query()->create($attributes);
            } else {
                $attributes['revision'] = (int) $enrollment->revision + 1;
                $enrollment->forceFill($attributes)->save();
            }

            return $this->enrollmentResponse($enrollment, true);
        }, 3);
    }

    public function status(string $enrollmentId, string $deviceId): array
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($enrollmentId, $deviceId): array {
            $enrollment = RelayV2EnrollmentModel::query()
                ->where('enrollment_id', $enrollmentId)
                ->where('device_id', $deviceId)
                ->lockForUpdate()
                ->first();

            if ($enrollment === null) {
                throw new RelayV2DomainException('enrollment_not_found', 404);
            }
            if ((string) $enrollment->state === RelayV2Constants::ENROLLMENT_PENDING
                && $enrollment->expires_at->isPast()) {
                $enrollment->forceFill([
                    'state' => RelayV2Constants::ENROLLMENT_EXPIRED,
                    'revision' => (int) $enrollment->revision + 1,
                ])->save();
            }

            return $this->enrollmentResponse($enrollment, false);
        }, 3);
    }

    public function claim(int $userId, string $claimCode): array
    {
        $hash = $this->claimCodeHash($claimCode);
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function () use ($userId, $hash): array {
            $enrollment = RelayV2EnrollmentModel::query()
                ->where('claim_code_hash', $hash)
                ->lockForUpdate()
                ->first();
            $device = null;
            $credential = null;
            $credentialVersion = 0;
            $revokedCredentials = collect();

            if ($enrollment === null) {
                throw new RelayV2DomainException('claim_code_invalid', 404);
            }
            if ((string) $enrollment->state === RelayV2Constants::ENROLLMENT_CLAIMED) {
                if ((int) $enrollment->claimant_user_id !== $userId) {
                    throw new RelayV2DomainException('enrollment_already_claimed', 409);
                }

                return $this->enrollmentResponse($enrollment, false);
            }
            if ((string) $enrollment->state !== RelayV2Constants::ENROLLMENT_PENDING
                || $enrollment->expires_at->isPast()) {
                throw new RelayV2DomainException('enrollment_unavailable', 410);
            }
            $device = RelayV2DeviceModel::query()
                ->where('device_id', (string) $enrollment->device_id)
                ->lockForUpdate()
                ->first();
            if ($device !== null && $device->owner_user_id !== null && (int) $device->owner_user_id !== $userId) {
                throw new RelayV2DomainException('device_owned_by_another_user', 409);
            }
            $credentialVersion = (int) $enrollment->key_version;
            if ($device !== null && $credentialVersion <= (int) $device->current_credential_version) {
                throw new RelayV2DomainException('credential_generation_stale', 409);
            }
            $revokedCredentials = RelayV2CredentialModel::query()
                ->where('device_id', (string) $enrollment->device_id)
                ->where('status', RelayV2Constants::CREDENTIAL_ACTIVE)
                ->lockForUpdate()
                ->get();
            if ($revokedCredentials->isNotEmpty()) {
                RelayV2CredentialModel::query()
                    ->whereIn('credential_id', $revokedCredentials->pluck('credential_id')->all())
                    ->update([
                        'status' => RelayV2Constants::CREDENTIAL_REVOKED,
                        'revoked_at' => now(),
                        'updated_at' => now(),
                    ]);
            }
            $credential = RelayV2CredentialModel::query()->create([
                'credential_id' => (string) Str::uuid(),
                'device_id' => (string) $enrollment->device_id,
                'credential_version' => $credentialVersion,
                'public_key' => (string) $enrollment->public_key,
                'status' => RelayV2Constants::CREDENTIAL_ACTIVE,
                'expires_at' => now()->addSeconds(RelayV2Contract::duration('credential_lifetime_seconds')),
            ]);
            if ($device === null) {
                $device = RelayV2DeviceModel::query()->create([
                    'device_id' => (string) $enrollment->device_id,
                    'owner_user_id' => $userId,
                    'label' => (string) $enrollment->label,
                    'platform' => (string) $enrollment->platform,
                    'capabilities' => $enrollment->capabilities,
                    'capability_digest' => (string) $enrollment->capability_digest,
                    'contract_digest' => (string) $enrollment->contract_digest,
                    'status' => RelayV2Constants::CREDENTIAL_ACTIVE,
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
                    'status' => RelayV2Constants::CREDENTIAL_ACTIVE,
                    'current_credential_version' => $credentialVersion,
                    'credential_expires_at' => $credential->expires_at,
                    'revoked_at' => null,
                ])->save();
            }
            $enrollment->forceFill([
                'state' => RelayV2Constants::ENROLLMENT_CLAIMED,
                'claimant_user_id' => $userId,
                'credential_id' => (string) $credential->credential_id,
                'claimed_at' => now(),
                'revision' => (int) $enrollment->revision + 1,
            ])->save();
            foreach ($revokedCredentials as $revokedCredential) {
                $this->outbox->append(
                    'credential',
                    (string) $revokedCredential->credential_id,
                    (int) $revokedCredential->credential_version,
                    RelayV2Contract::event('credential_revoked'),
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

    private function enrollmentResponse(RelayV2EnrollmentModel $enrollment, bool $includeClaimCode): array
    {
        $response = [
            'enrollment' => [
                'enrollment_id' => (string) $enrollment->enrollment_id,
                'state' => (string) $enrollment->state,
                'expires_at' => $enrollment->expires_at->toIso8601String(),
            ],
        ];
        $credential = null;

        if ($includeClaimCode) {
            $response['enrollment']['claim_code'] = Crypt::decryptString((string) $enrollment->claim_code_encrypted);
        }
        if ((string) $enrollment->state === RelayV2Constants::ENROLLMENT_CLAIMED) {
            $credential = RelayV2CredentialModel::query()
                ->where('credential_id', (string) $enrollment->credential_id)
                ->first();
            if ($credential === null) {
                throw new RelayV2DomainException('credential_not_found', 500);
            }
            $response['credential'] = [
                'credential_id' => (string) $credential->credential_id,
                'credential_version' => (int) $credential->credential_version,
            ];
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
