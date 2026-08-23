<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Exceptions\RelayV2DomainException;
use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2CredentialModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2DeviceModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2EnrollmentModel;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class RelayV2DeviceSignatureService
{
    public function __construct(private readonly RelayV2NonceRepository $nonces)
    {
    }

    public function verify(Request $request): array
    {
        $protocol = trim((string) $request->header(RelayV2Contract::header('protocol'), ''));
        $deviceId = trim((string) $request->header(RelayV2Contract::header('device_id'), ''));
        $credentialId = trim((string) $request->header(RelayV2Contract::header('credential_id'), ''));
        $credentialVersionText = trim((string) $request->header(RelayV2Contract::header('credential_version'), ''));
        $timestampText = trim((string) $request->header(RelayV2Contract::header('timestamp'), ''));
        $nonce = trim((string) $request->header(RelayV2Contract::header('nonce'), ''));
        $contentSha256 = strtolower(trim((string) $request->header(RelayV2Contract::header('content_sha256'), '')));
        $signatureText = trim((string) $request->header(RelayV2Contract::header('signature'), ''));
        $credentialVersion = ctype_digit($credentialVersionText) ? (int) $credentialVersionText : 0;
        $timestamp = ctype_digit($timestampText) ? (int) $timestampText : 0;
        $body = (string) $request->getContent();
        $publicKeyText = '';
        $credentialScope = '';
        $identity = [];
        $canonical = '';
        $publicKey = false;
        $signature = false;

        if (!hash_equals(RelayV2Contract::protocolVersion(), $protocol)) {
            throw new RelayV2DomainException('signature_protocol_invalid', 403);
        }
        if (!Str::isUuid($deviceId) || $credentialVersion < 1) {
            throw new RelayV2DomainException('signature_device_invalid', 403);
        }
        if ($timestamp < 1 || abs(time() - $timestamp) > RelayV2Contract::duration('signature_clock_skew_seconds')) {
            throw new RelayV2DomainException('signature_timestamp_invalid', 403);
        }
        if ($nonce === '' || strlen($nonce) > 128 || preg_match('/^[A-Za-z0-9_-]+$/', $nonce) !== 1) {
            throw new RelayV2DomainException('signature_nonce_invalid', 403);
        }
        if (preg_match('/^[a-f0-9]{64}$/', $contentSha256) !== 1
            || !hash_equals(hash('sha256', $body), $contentSha256)) {
            throw new RelayV2DomainException('signature_body_digest_invalid', 403);
        }

        $identity = $this->resolveIdentity($request, $deviceId, $credentialId, $credentialVersion);
        $publicKeyText = (string) $identity['public_key'];
        $credentialScope = (string) $identity['credential_scope'];
        $canonical = implode("\n", [
            $protocol,
            (string) $credentialVersion,
            strtoupper($request->getMethod()),
            RelayV2Contract::canonicalPath($request->getPathInfo()),
            RelayV2Contract::canonicalRawQuery($request->getQueryString()),
            $deviceId,
            (string) $timestamp,
            $nonce,
            $contentSha256,
        ]);
        $publicKey = self::base64UrlDecode($publicKeyText);
        $signature = self::base64UrlDecode($signatureText);
        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            throw new RelayV2DomainException('signature_runtime_missing', 500);
        }
        if (!is_string($publicKey) || strlen($publicKey) !== SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
            || !is_string($signature) || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES
            || !sodium_crypto_sign_verify_detached($signature, $canonical, $publicKey)) {
            throw new RelayV2DomainException('signature_invalid', 403);
        }

        $this->nonces->claim($credentialScope, $nonce);
        $request->attributes->set('relay_v2_device_id', $deviceId);
        $request->attributes->set('relay_v2_credential_id', $credentialId);
        $request->attributes->set('relay_v2_credential_version', $credentialVersion);

        return [
            'device_id' => $deviceId,
            'credential_id' => $credentialId,
            'credential_version' => $credentialVersion,
            'credential_scope' => $credentialScope,
        ];
    }

    private function resolveIdentity(
        Request $request,
        string $deviceId,
        string $credentialId,
        int $credentialVersion
    ): array {
        $device = [];
        $publicKey = '';
        $bodyDeviceId = '';
        $bodyKeyVersion = 0;
        $enrollment = null;
        $credential = null;
        $registeredDevice = null;
        $enrollmentId = '';

        if ($request->routeIs('relay.v2.enrollment.create')) {
            $device = is_array($request->json('device')) ? $request->json('device') : [];
            $publicKey = (string) ($device['public_key'] ?? '');
            $bodyDeviceId = (string) ($device['device_id'] ?? '');
            $bodyKeyVersion = (int) ($device['key_version'] ?? 0);
            if ($credentialId !== '' || !hash_equals($deviceId, $bodyDeviceId) || $credentialVersion !== $bodyKeyVersion) {
                throw new RelayV2DomainException('signature_enrollment_identity_invalid', 403);
            }

            return [
                'public_key' => $publicKey,
                'credential_scope' => 'proposal:'.hash('sha256', $deviceId."\0".$publicKey),
            ];
        }

        if ($request->routeIs('relay.v2.enrollment.status')) {
            $enrollmentId = (string) $request->route('enrollment_id');
            $enrollment = RelayV2EnrollmentModel::query()
                ->where('enrollment_id', $enrollmentId)
                ->where('device_id', $deviceId)
                ->first();
            if ($credentialId !== '' || $enrollment === null || (int) $enrollment->key_version !== $credentialVersion) {
                throw new RelayV2DomainException('signature_enrollment_not_found', 403);
            }

            return [
                'public_key' => (string) $enrollment->public_key,
                'credential_scope' => 'enrollment:'.$enrollmentId,
            ];
        }

        if (!Str::isUuid($credentialId)) {
            throw new RelayV2DomainException('signature_credential_missing', 403);
        }
        $registeredDevice = RelayV2DeviceModel::query()
            ->where('device_id', $deviceId)
            ->where('status', RelayV2Constants::CREDENTIAL_ACTIVE)
            ->where('current_credential_version', $credentialVersion)
            ->whereNull('revoked_at')
            ->first();
        $credential = RelayV2CredentialModel::query()
            ->where('credential_id', $credentialId)
            ->where('device_id', $deviceId)
            ->where('credential_version', $credentialVersion)
            ->first();
        if ($registeredDevice === null
            || $credential === null
            || (string) $credential->status !== RelayV2Constants::CREDENTIAL_ACTIVE
            || $credential->revoked_at !== null
            || $credential->expires_at === null
            || $credential->expires_at->lte(now())) {
            throw new RelayV2DomainException('signature_credential_invalid', 403);
        }

        return [
            'public_key' => (string) $credential->public_key,
            'credential_scope' => 'credential:'.$credentialId.':'.$credentialVersion,
        ];
    }

    private static function base64UrlDecode(string $value): string|false
    {
        $padding = (4 - strlen($value) % 4) % 4;

        return base64_decode(strtr($value, '-_', '+/').str_repeat('=', $padding), true);
    }
}
