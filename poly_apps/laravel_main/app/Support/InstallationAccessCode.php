<?php

namespace App\Support;

/**
 * Installation access (super) code. The code itself lives in the external
 * runtime store (RuntimeConfigurationStore, rooted at the PathMapper
 * 'laravel_data_dir' user data directory outside the repository), so this
 * file is NEVER rewritten by the start scripts - the previous generated-file
 * approach rewrote this class on every start and caused constant sync churn.
 *
 * When the store holds no code yet (first boot before provisioning), a
 * random placeholder is returned: it never matches a real code, so elevation
 * simply fails until the start script provisions the store entry.
 */
final class InstallationAccessCode
{
    private const STORE_KEY = 'INSTALLATION_ACCESS_CODE';

    public static function value(): string
    {
        $stored = RuntimeConfigurationStore::get(self::STORE_KEY);
        if (is_string($stored) && trim($stored) !== '') {
            return trim($stored);
        }

        return self::placeholder();
    }

    /**
     * Random placeholder in the canonical code shape; never persisted, so it
     * can never collide with the provisioned code.
     */
    private static function placeholder(): string
    {
        $segments = [];
        for ($i = 0; $i < 4; $i++) {
            $segments[] = strtoupper(bin2hex(random_bytes(2)));
        }

        return 'NEXU-' . implode('-', $segments);
    }
}
