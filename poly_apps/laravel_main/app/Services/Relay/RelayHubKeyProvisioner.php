<?php

namespace App\Services\Relay;

use App\Support\RuntimeConfigurationStore;

/**
 * Mercure hub key provisioner - the single writer for the HS256 hub
 * secrets. Keys live ONLY in the RuntimeConfigurationStore constant
 * directory (outside the repository tree): never in code, config, env
 * files or git. Idempotent: present keys are never rotated (issued tokens
 * keep validating across restarts); missing keys are generated once.
 *
 * The Caddyfile renderers (ServerManagerV1FrankenPhpCaddyfileBuilder here,
 * fm_mercure_config on the shell end) embed the stored values as literal
 * publisher_jwt/subscriber_jwt directives after provisioning.
 */
final class RelayHubKeyProvisioner
{
    private const KEY_BYTES = 48;

    /**
     * Ensure both hub keys exist.
     *
     * @return array<string, bool> per-key flags: true when generated now
     */
    public static function ensure(): array
    {
        $result = [];

        foreach ([RelayHubJwt::PUBLISHER_KEY, RelayHubJwt::SUBSCRIBER_KEY] as $key) {
            $result[$key] = self::ensureKey($key);
        }

        return $result;
    }

    /**
     * True when both hub keys are present and non-empty.
     */
    public static function provisioned(): bool
    {
        foreach ([RelayHubJwt::PUBLISHER_KEY, RelayHubJwt::SUBSCRIBER_KEY] as $key) {
            $value = RuntimeConfigurationStore::get($key);

            if ($value === null || trim($value) === '') {
                return false;
            }
        }

        return true;
    }

    private static function ensureKey(string $key): bool
    {
        $existing = RuntimeConfigurationStore::get($key);
        $generated = '';
        $stored = null;

        if ($existing !== null && trim($existing) !== '') {
            return false;
        }

        $generated = base64_encode(random_bytes(self::KEY_BYTES));
        RuntimeConfigurationStore::put($key, $generated);
        $stored = RuntimeConfigurationStore::get($key);

        return is_string($stored) && hash_equals($generated, $stored);
    }

    private function __construct()
    {
    }
}
