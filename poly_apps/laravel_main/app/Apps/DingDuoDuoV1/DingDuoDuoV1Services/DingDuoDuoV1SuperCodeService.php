<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Services;

use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Support\ServiceContract;
use App\Utils\SecretStore;
use RuntimeException;

/**
 * Super code v2 (NC-008, .claude/agents_shared/client_key_auth/dingdoudou_super_code_v2.md):
 * `DDK2.<base64url JSON payload>.<base64url Ed25519 signature over "DDK2.<payload>">`,
 * bound to one extension device id and an expiry. Format, public key and
 * signing-seed secret name come from service_contract.json#dingdoudou. Only
 * Laravel holds the seed (shared secret store); every end verifies with the
 * contract public key. The v1 master codes and salted FNV-1a codes are no
 * longer accepted anywhere.
 */
class DingDuoDuoV1SuperCodeService
{
    public const FORMAT_VERSION = 2;
    private const FIELD_SEPARATOR = '.';

    /**
     * Mint a code for one extension device, valid until $expiresAt (unix
     * seconds). $maxBinds null means unlimited binds.
     */
    public static function mint(
        string $deviceId,
        int $expiresAt,
        string $tier = DingDuoDuoV1Constants::TIER_UNLIMITED,
        array $features = ['*'],
        ?int $maxBinds = null
    ): string {
        $payload = [
            'v' => self::FORMAT_VERSION,
            'device' => trim($deviceId),
            'exp' => $expiresAt,
            'iat' => time(),
            'tier' => $tier,
            'features' => array_values(array_map('strval', $features)),
        ];
        $body = '';

        $secretKey = self::signingSecretKey();

        if ($payload['device'] === '' || $expiresAt <= time()) {
            throw new RuntimeException(__('ding_duo_duo.super_code_mint_invalid'));
        }
        if ($maxBinds !== null) {
            $payload['maxBinds'] = max(0, $maxBinds);
        }
        $body = self::formatPrefix().self::FIELD_SEPARATOR
            .self::encode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        return $body.self::FIELD_SEPARATOR.self::encode(sodium_crypto_sign_detached($body, $secretKey));
    }

    /**
     * The decoded payload when $code is a v2 code with a valid signature,
     * bound to $deviceId and not expired; null otherwise (fail closed).
     */
    public static function verify(string $code, string $deviceId): ?array
    {
        $parts = explode(self::FIELD_SEPARATOR, trim($code));
        $publicKey = self::contractPublicKey();
        $signature = false;
        $json = false;
        $payload = null;

        if (count($parts) !== 3 || $parts[0] !== self::formatPrefix() || $publicKey === null || trim($deviceId) === '') {
            return null;
        }
        $signature = self::decode($parts[2]);
        if (!is_string($signature)
            || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES
            || !sodium_crypto_sign_verify_detached($signature, $parts[0].self::FIELD_SEPARATOR.$parts[1], $publicKey)) {
            return null;
        }
        $json = self::decode($parts[1]);
        $payload = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($payload)
            || ($payload['v'] ?? null) !== self::FORMAT_VERSION
            || !is_string($payload['device'] ?? null)
            || !hash_equals($payload['device'], trim($deviceId))
            || !is_int($payload['exp'] ?? null)
            || $payload['exp'] <= time()) {
            return null;
        }

        return $payload;
    }

    public static function isV2Code(string $code): bool
    {
        return str_starts_with(trim($code), self::formatPrefix().self::FIELD_SEPARATOR);
    }

    /**
     * Ed25519 secret key from the stored seed. Refuses when the seed is
     * missing or does not match the contract public key, so a minted code
     * always verifies on every end.
     */
    private static function signingSecretKey(): string
    {
        $secretName = ServiceContract::string('dingdoudou.super_code_signing_secret');
        $seed = self::decode(SecretStore::get($secretName));
        $publicKey = self::contractPublicKey();
        $pair = '';

        if (!is_string($seed) || strlen($seed) !== SODIUM_CRYPTO_SIGN_SEEDBYTES) {
            throw new RuntimeException(__('ding_duo_duo.super_code_key_missing', ['name' => $secretName]));
        }
        $pair = sodium_crypto_sign_seed_keypair($seed);
        if ($publicKey === null || !hash_equals($publicKey, sodium_crypto_sign_publickey($pair))) {
            throw new RuntimeException(__('ding_duo_duo.super_code_key_mismatch', ['name' => $secretName]));
        }

        return sodium_crypto_sign_secretkey($pair);
    }

    private static function contractPublicKey(): ?string
    {
        $value = ServiceContract::document()['dingdoudou']['super_code_public_key'] ?? '';
        $decoded = is_string($value) ? self::decode($value) : false;

        return is_string($decoded) && strlen($decoded) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES ? $decoded : null;
    }

    private static function formatPrefix(): string
    {
        return ServiceContract::string('dingdoudou.super_code_format');
    }

    private static function encode(string $bytes): string
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    private static function decode(string $value): string|false
    {
        $trimmed = trim($value);
        $padding = (4 - strlen($trimmed) % 4) % 4;

        return $trimmed === '' ? false : base64_decode(strtr($trimmed, '-_', '+/').str_repeat('=', $padding), true);
    }
}
