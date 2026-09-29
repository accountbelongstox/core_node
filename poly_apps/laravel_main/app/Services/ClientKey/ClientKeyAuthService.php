<?php

namespace App\Services\ClientKey;

use App\Apps\Relay\RelayServices\RelayContract;
use App\Services\QueueCenter\QueueCenterCacheStore;
use App\Support\ServiceContract;
use App\Utils\SecretStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Shared client-key request signatures (K3): one verifier for the
 * `client.key` / `client.key_or_dashboard` middleware and relay enrollment,
 * and one signer for outbound Laravel peer calls.
 *
 * Every value comes from config/service_contract.json#client_key_auth; the
 * keys come from the shared secret store that dd.sh / dd.cmd decrypt.
 */
final class ClientKeyAuthService
{
    public const ATTRIBUTE_CLIENT = 'core_node_client';
    public const ATTRIBUTE_MACHINE_ID = 'core_node_machine_id';
    private const ATTRIBUTE_RESULT = 'core_node_client_key_result';
    private const RESULT_VERIFIED = 'verified';
    private const NONCE_PREFIX = 'client-key:nonce:';
    private const KEY_CACHE_SECONDS = 60;
    private const HTTP_UNAUTHORIZED = 401;
    private const DD_STEP = 'dd.sh / dd.cmd secret store decrypt';

    private static array $keys = [];
    private static int $keysLoadedAt = 0;

    public static function hasSignature(Request $request): bool
    {
        return trim((string) $request->header(self::header('signature'), '')) !== '';
    }

    public static function isMachineCall(Request $request): bool
    {
        return self::verify($request) === null;
    }

    /**
     * Verify the request signature. Returns null when it is valid, otherwise
     * the contract error code. The outcome is cached on the request.
     */
    public static function verify(Request $request): ?string
    {
        $cached = $request->attributes->get(self::ATTRIBUTE_RESULT);
        $contract = self::contract();
        $client = trim((string) $request->header(self::header('client'), ''));
        $protocol = trim((string) $request->header(self::header('protocol'), ''));
        $machineId = trim((string) $request->header(self::header('machine_id'), ''));
        $keyId = strtolower(trim((string) $request->header(self::header('key_id'), '')));
        $timestamp = trim((string) $request->header(self::header('timestamp'), ''));
        $nonce = trim((string) $request->header(self::header('nonce'), ''));
        $contentSha256 = trim((string) $request->header(self::header('content_sha256'), ''));
        $signature = trim((string) $request->header(self::header('signature'), ''));
        $keys = [];
        $expectedDigest = '';
        $canonical = '';
        $errorCode = null;

        if (is_string($cached)) {
            return $cached === self::RESULT_VERIFIED ? null : $cached;
        }
        if ($signature === '' || $keyId === '') {
            return self::remember($request, 'client_key_missing');
        }
        if (!in_array($client, $contract['clients'], true)
            || !hash_equals((string) $contract['protocol_version'], $protocol)
            || preg_match('/'.$contract['machine_id_pattern'].'/', $machineId) !== 1) {
            return self::remember($request, 'client_key_protocol_invalid');
        }
        $keys = self::keys();
        if ($keys === []) {
            return self::remember($request, 'client_key_missing');
        }
        if (!isset($keys[$keyId])) {
            return self::remember($request, 'client_key_unknown');
        }
        if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > (int) $contract['clock_skew_seconds']) {
            return self::remember($request, 'client_key_timestamp_invalid');
        }
        if (preg_match('/'.$contract['nonce_pattern'].'/', $nonce) !== 1) {
            return self::remember($request, 'client_key_nonce_invalid');
        }
        $expectedDigest = self::isUnsignedPayload((string) $request->header('Content-Type', ''))
            ? (string) $contract['unsigned_payload']
            : hash('sha256', (string) $request->getContent());
        if (!hash_equals($expectedDigest, $contentSha256)) {
            return self::remember($request, 'client_key_body_digest_invalid');
        }
        try {
            $canonical = self::canonical([
                'method' => $request->getMethod(),
                'path' => RelayContract::canonicalPath(self::requestPath($request)),
                'query' => RelayContract::canonicalRawQuery(self::rawQuery($request)),
                'client' => $client,
                'machine_id' => $machineId,
                'key_id' => $keyId,
                'timestamp' => $timestamp,
                'nonce' => $nonce,
                'content_sha256' => $contentSha256,
            ]);
        } catch (\Throwable) {
            $errorCode = 'client_key_signature_invalid';
        }
        if ($errorCode !== null || !hash_equals(self::signature($canonical, $keys[$keyId]), $signature)) {
            return self::remember($request, 'client_key_signature_invalid');
        }
        if (!QueueCenterCacheStore::get()->add(
            self::NONCE_PREFIX.hash('sha256', $keyId."\0".$nonce),
            true,
            (int) $contract['nonce_ttl_seconds']
        )) {
            return self::remember($request, 'client_key_nonce_replayed');
        }

        $request->attributes->set(self::ATTRIBUTE_CLIENT, $client);
        $request->attributes->set(self::ATTRIBUTE_MACHINE_ID, $machineId);

        return self::remember($request, null);
    }

    public static function errorResponse(string $errorCode): JsonResponse
    {
        $message = __('client_key.'.$errorCode);

        return response()->json([
            'success' => false,
            'message' => $message,
            'error' => $message,
            'error_code' => $errorCode,
            'code' => self::HTTP_UNAUTHORIZED,
        ], self::HTTP_UNAUTHORIZED);
    }

    /**
     * Signed headers for one outbound request. $path is the request path as
     * sent (`/api/...`) and $rawQuery the query string as sent (no `?`).
     *
     * @return array<string, string>
     */
    public static function signedHeaders(
        string $client,
        string $machineId,
        string $method,
        string $path,
        string $rawQuery,
        string $body,
        string $contentType
    ): array {
        $contract = self::contract();
        $key = self::decodeKey(SecretStore::get((string) $contract['secret_key_sign_name']));
        $keyId = '';
        $timestamp = (string) time();
        $nonce = rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
        $contentSha256 = self::isUnsignedPayload($contentType)
            ? (string) $contract['unsigned_payload']
            : hash('sha256', $body);
        $fields = [];

        if ($key === null) {
            self::logMissingKey((string) $contract['secret_key_sign_name']);
            throw new RuntimeException(__('client_key.local_key_missing', [
                'name' => (string) $contract['secret_key_sign_name'],
            ]));
        }
        $keyId = self::keyId($key);
        $fields = [
            'method' => $method,
            'path' => RelayContract::canonicalPath($path),
            'query' => RelayContract::canonicalRawQuery($rawQuery),
            'client' => $client,
            'machine_id' => $machineId,
            'key_id' => $keyId,
            'timestamp' => $timestamp,
            'nonce' => $nonce,
            'content_sha256' => $contentSha256,
        ];

        return [
            self::header('client') => $client,
            self::header('protocol') => (string) $contract['protocol_version'],
            self::header('machine_id') => $machineId,
            self::header('key_id') => $keyId,
            self::header('timestamp') => $timestamp,
            self::header('nonce') => $nonce,
            self::header('content_sha256') => $contentSha256,
            self::header('signature') => self::signature(self::canonical($fields), $key),
        ];
    }

    /**
     * @param array<string, string> $fields every contract canonical field except the version and protocol
     */
    public static function canonical(array $fields): string
    {
        $contract = self::contract();
        $values = [
            'canonical_version' => (string) $contract['canonical_version'],
            'protocol' => (string) $contract['protocol_version'],
        ] + $fields;
        $values['method'] = strtoupper((string) ($values['method'] ?? ''));
        $parts = [];

        foreach ($contract['canonical_fields'] as $field) {
            if (!array_key_exists($field, $values)) {
                throw new RuntimeException("Unknown client key canonical field: {$field}");
            }
            $parts[] = (string) $values[$field];
        }

        return implode((string) $contract['canonical_joiner'], $parts);
    }

    public static function signature(string $canonical, string $decodedKey): string
    {
        return self::encode(hash_hmac('sha256', $canonical, $decodedKey, true));
    }

    public static function keyId(string $decodedKey): string
    {
        return substr(hash('sha256', $decodedKey), 0, 16);
    }

    public static function decodeKey(string $value): ?string
    {
        $trimmed = trim($value);
        $padding = (4 - strlen($trimmed) % 4) % 4;
        $decoded = $trimmed === ''
            ? false
            : base64_decode(strtr($trimmed, '-_', '+/').str_repeat('=', $padding), true);

        return is_string($decoded) && strlen($decoded) >= (int) self::contract()['key_min_bytes'] ? $decoded : null;
    }

    public static function header(string $name): string
    {
        $value = self::contract()['headers'][$name] ?? null;
        if (!is_string($value) || $value === '') {
            throw new RuntimeException("Unknown client key header: {$name}");
        }

        return $value;
    }

    private static function contract(): array
    {
        $contract = ServiceContract::document()['client_key_auth'] ?? null;
        if (!is_array($contract)) {
            throw new RuntimeException('Unknown service contract section: client_key_auth');
        }

        return $contract;
    }

    /**
     * @return array<string, string> key id => decoded key
     */
    private static function keys(): array
    {
        $contract = self::contract();
        $keys = [];
        $decoded = null;
        $index = 0;

        if (self::$keysLoadedAt > 0 && time() - self::$keysLoadedAt < self::KEY_CACHE_SECONDS) {
            return self::$keys;
        }
        for ($index = 1; $index <= (int) $contract['secret_key_max_index']; $index++) {
            $decoded = self::decodeKey(SecretStore::get($contract['secret_key_base'].'_'.$index));
            if ($decoded !== null) {
                $keys[self::keyId($decoded)] = $decoded;
            }
        }
        if ($keys === []) {
            self::logMissingKey((string) $contract['secret_key_sign_name']);
        }
        self::$keys = $keys;
        self::$keysLoadedAt = time();

        return $keys;
    }

    private static function logMissingKey(string $secretName): void
    {
        Log::warning('[ClientKey] Shared client key is missing or shorter than the contract minimum', [
            'secret_name' => $secretName,
            'repair_step' => self::DD_STEP,
        ]);
    }

    private static function isUnsignedPayload(string $contentType): bool
    {
        $mediaType = strtolower(trim(explode(';', $contentType, 2)[0]));

        return in_array($mediaType, self::contract()['unsigned_payload_content_types'], true);
    }

    /**
     * The path as the client sent it: base path (when Laravel is mounted
     * under a prefix) plus path info. At the web root this is the path info.
     */
    private static function requestPath(Request $request): string
    {
        return $request->getBaseUrl().$request->getPathInfo();
    }

    private static function rawQuery(Request $request): string
    {
        return (string) $request->server->get('QUERY_STRING', '');
    }

    private static function remember(Request $request, ?string $errorCode): ?string
    {
        $request->attributes->set(self::ATTRIBUTE_RESULT, $errorCode ?? self::RESULT_VERIFIED);

        return $errorCode;
    }

    private static function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function __construct()
    {
    }
}
