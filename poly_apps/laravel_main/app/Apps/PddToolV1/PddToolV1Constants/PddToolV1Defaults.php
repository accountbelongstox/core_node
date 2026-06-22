<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Constants;

/**
 * Canonical PddToolV1 package definitions + member defaults.
 *
 * PACKAGES is the seed/source-of-truth for the four membership tiers
 * (TRIAL|PRO|PRO_PLUS|ULTIMATE). max_orders -1 = unlimited (the extension maps
 * it to 100000). The DB packages table is seeded FROM this map at sys:init; the
 * admin /packages upsert can later override prices/limits in the DB.
 */
class PddToolV1Defaults
{
    public const TRIAL = 'TRIAL';
    public const PRO = 'PRO';
    public const PRO_PLUS = 'PRO_PLUS';
    public const ULTIMATE = 'ULTIMATE';

    /**
     * Tier definitions. price_month / price_year in yuan.
     */
    public const PACKAGES = [
        self::TRIAL => [
            'code' => self::TRIAL,
            'name' => 'Trial',
            'price_month' => 0.0,
            'price_year' => 0.0,
            'max_orders' => 10,
            'max_pdd_accounts' => 2,
            'enabled' => true,
        ],
        self::PRO => [
            'code' => self::PRO,
            'name' => 'Pro',
            'price_month' => 39.0,
            'price_year' => 399.0,
            'max_orders' => 100,
            'max_pdd_accounts' => 5,
            'enabled' => true,
        ],
        self::PRO_PLUS => [
            'code' => self::PRO_PLUS,
            'name' => 'Pro Plus',
            'price_month' => 79.0,
            'price_year' => 799.0,
            'max_orders' => 500,
            'max_pdd_accounts' => 10,
            'enabled' => true,
        ],
        self::ULTIMATE => [
            'code' => self::ULTIMATE,
            'name' => 'Ultimate',
            'price_month' => 159.0,
            'price_year' => 1599.0,
            'max_orders' => -1,
            'max_pdd_accounts' => 50,
            'enabled' => true,
        ],
    ];

    // New-account defaults (TRIAL tier, 7-day window).
    public const DEFAULT_PACKAGE = self::TRIAL;
    public const DEFAULT_TRIAL_DAYS = 7;
    public const DEFAULT_MAX_ORDERS = 10;
    public const DEFAULT_MAX_PDD_ACCOUNTS = 2;
    public const DEFAULT_PAYMENT_MODEL = 'prepaid';

    // Default admin seeded at sys:init.
    public const DEFAULT_ADMIN_USERNAME = 'pddadmin';
    public const DEFAULT_ADMIN_PASSWORD = 'pddadmin888';

    // Super-code free unlock. The Chrome extension logs in with username = SUPER_VIP_USERNAME
    // and password = the username REVERSED (password is derived from the username, not fixed,
    // e.g. FREE-VIP / PIV-EERF). On this login the backend ensures a global User 'FREE-VIP' with
    // an ULTIMATE profile exists and issues a REAL Sanctum token (no more fixed magic token), so
    // authenticated calls (account binding etc.) validate via custom.authenticate.
    public const SUPER_VIP_USERNAME = 'FREE-VIP';

    /**
     * Super-code login: ONLY the canonical VIP username with its reversed password
     * (e.g. FREE-VIP / PIV-EERF). Restricted to the single username so arbitrary
     * accounts cannot self-mint ULTIMATE via the reversed-password rule.
     */
    public static function isSuperLogin(string $username, string $password): bool
    {
        return $username === self::SUPER_VIP_USERNAME && $password === strrev($username);
    }

    /**
     * Whether $code is one of the four batch-permission tiers.
     */
    public static function isValidPackage(string $code): bool
    {
        return isset(self::PACKAGES[$code]);
    }
}
