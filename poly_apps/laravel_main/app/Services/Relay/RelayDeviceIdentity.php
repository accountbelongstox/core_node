<?php

namespace App\Services\Relay;

use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\QueueCenterContract;
use Illuminate\Http\Request;

final class RelayDeviceIdentity
{
    public const MACHINE_HEADER = 'X-Core-Node-Machine-ID';
    public const TIMESTAMP_HEADER = 'X-Core-Node-Timestamp';
    public const NONCE_HEADER = 'X-Core-Node-Nonce';
    public const CONTENT_SHA256_HEADER = 'X-Core-Node-Content-SHA256';
    public const SIGNATURE_HEADER = 'X-Core-Node-Signature';
    public const ENROLLMENT_SECRET_HEADER = 'X-Core-Node-Enrollment-Secret';

    private const CLAIM_PREFIX = 'relay:device-identity:';
    private const CLAIM_LOCK_PREFIX = 'relay:device-identity-lock:';
    private const CLAIM_LOCK_SECONDS = 5;
    private const NONCE_PREFIX = 'relay:device-nonce:';

    public static function verify(Request $request): bool
    {
        $cached = $request->attributes->get('core_node_machine_verified');
        $machineId = trim((string) $request->header(self::MACHINE_HEADER, ''));
        $requestMachineId = self::requestMachineId($request);
        $timestamp = (string) $request->header(self::TIMESTAMP_HEADER, '');
        $nonce = trim((string) $request->header(self::NONCE_HEADER, ''));
        $contentSha256 = strtolower((string) $request->header(self::CONTENT_SHA256_HEADER, ''));
        $signature = trim((string) $request->header(self::SIGNATURE_HEADER, ''));
        $secret = null;
        $decodedSecret = null;
        $expected = '';
        $canonical = '';
        $clockSkew = self::contractInt('clock_skew_seconds');
        $nonceTtl = self::contractInt('nonce_ttl_seconds');

        if (is_bool($cached)) {
            return $cached;
        }
        if (!RelayMachineRegistry::isValidId($machineId)
            || $requestMachineId === null || !hash_equals($machineId, $requestMachineId)
            || !ctype_digit($timestamp)
            || abs(time() - (int) $timestamp) > $clockSkew
            || $nonce === '' || strlen($nonce) > 128
            || !preg_match('/^[a-f0-9]{64}$/', $contentSha256)
            || $signature === '') {
            return self::remember($request, false);
        }
        if (!hash_equals(hash('sha256', (string) $request->getContent()), $contentSha256)) {
            return self::remember($request, false);
        }

        $secret = self::claimedSecret($machineId);
        if ($secret === null && self::isRegistration($request)) {
            $secret = trim((string) $request->header(self::ENROLLMENT_SECRET_HEADER, ''));
        }
        $decodedSecret = $secret === null ? null : self::decodeSecret($secret);
        if ($secret === null || $decodedSecret === null) {
            return self::remember($request, false);
        }

        $canonical = implode("\n", [
            strtoupper($request->getMethod()),
            '/'.$request->path(),
            $machineId,
            $timestamp,
            $nonce,
            $contentSha256,
        ]);
        $expected = self::encode(hash_hmac('sha256', $canonical, $decodedSecret, true));
        if (!hash_equals($expected, $signature) || !self::claim($machineId, $secret)) {
            return self::remember($request, false);
        }
        if (!QueueCenterCacheStore::get()->add(
            self::NONCE_PREFIX.hash('sha256', $machineId."\0".$nonce),
            true,
            $nonceTtl
        )) {
            return self::remember($request, false);
        }

        $request->attributes->set('core_node_machine_id', $machineId);

        return self::remember($request, true);
    }

    private static function claim(string $machineId, string $secret): bool
    {
        $cache = QueueCenterCacheStore::get();
        $key = self::CLAIM_PREFIX.$machineId;
        $existing = $cache->get($key);
        $lock = null;

        if (is_string($existing) && $existing !== '') {
            return hash_equals($existing, $secret);
        }
        $lock = $cache->lock(
            self::CLAIM_LOCK_PREFIX.hash('sha256', $machineId),
            self::CLAIM_LOCK_SECONDS
        );
        if (!$lock->get()) {
            return false;
        }
        try {
            $existing = $cache->get($key);
            if (!is_string($existing) || $existing === '') {
                $cache->forever($key, $secret);
                $existing = $cache->get($key);
            }
        } finally {
            $lock->release();
        }

        return is_string($existing) && hash_equals($existing, $secret);
    }

    private static function claimedSecret(string $machineId): ?string
    {
        $value = QueueCenterCacheStore::get()->get(self::CLAIM_PREFIX.$machineId);

        return is_string($value) && $value !== '' ? $value : null;
    }

    private static function contractInt(string $key): int
    {
        $value = QueueCenterContract::relay()['device_identity'][$key] ?? null;
        if (!is_int($value) || $value < 1) {
            throw new \RuntimeException("Unknown relay device identity setting: {$key}");
        }

        return $value;
    }

    private static function isRegistration(Request $request): bool
    {
        return $request->is('api/relay/machine/register');
    }

    private static function requestMachineId(Request $request): ?string
    {
        $routeMachineId = $request->route('machineId');
        $bodyMachineId = $request->json('machine_id');
        $value = is_string($routeMachineId) && $routeMachineId !== ''
            ? $routeMachineId
            : (is_string($bodyMachineId) ? $bodyMachineId : '');

        return RelayMachineRegistry::isValidId($value) ? $value : null;
    }

    private static function decodeSecret(string $value): ?string
    {
        $padding = (4 - strlen($value) % 4) % 4;
        $decoded = base64_decode(strtr($value, '-_', '+/').str_repeat('=', $padding), true);

        return is_string($decoded) && strlen($decoded) >= 32 ? $decoded : null;
    }

    private static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function remember(Request $request, bool $verified): bool
    {
        $request->attributes->set('core_node_machine_verified', $verified);

        return $verified;
    }

    private function __construct()
    {
    }
}
