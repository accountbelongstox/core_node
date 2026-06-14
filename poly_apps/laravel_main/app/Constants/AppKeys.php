<?php

namespace App\Constants;

/**
 * Application Keys Constants
 * 
 * Centralized definition of all application keys.
 * Use these constants instead of hardcoded strings throughout the codebase.
 */
class AppKeys
{
    const APPQYV1 = 'appqyv1';
    const MCPV1 = 'mcpv1';
    const SERVERMANAGERV1 = 'servermanagerv1';
    const ACHATV1 = 'achatv1';
    const CODEMARTV1 = 'codemartv1';
    const ITTOOLSV1 = 'ittoolsv1';

    /**
     * Get all app keys
     *
     * @return array
     */
    public static function all(): array
    {
        return [
            self::APPQYV1,
            self::MCPV1,
            self::SERVERMANAGERV1,
            self::ACHATV1,
            self::CODEMARTV1,
            self::ITTOOLSV1,
        ];
    }

    /**
     * Check if an app key is valid
     *
     * @param string $appKey
     * @return bool
     */
    public static function isValid(string $appKey): bool
    {
        return in_array($appKey, self::all(), true);
    }
}

