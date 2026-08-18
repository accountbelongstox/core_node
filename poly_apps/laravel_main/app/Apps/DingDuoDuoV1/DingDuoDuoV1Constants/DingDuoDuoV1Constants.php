<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants;

/**
 * Canonical DingDuoDuoV1 (订多多) constants: route prefix, membership tiers, the
 * header the Chrome extension sends its member token in, and the default recharge
 * package set seeded into the recharge_configs row at sys:init.
 */
class DingDuoDuoV1Constants
{
    /** Bare route prefix (mounted under /api by routes/api.php). */
    public const ROUTE_PREFIX = 'ding_duo_duo_v1';

    /** Header carrying a member's issued token (resolved inline in controllers). */
    public const MEMBER_TOKEN_HEADER = 'X-DD-Token';

    // Membership tiers.
    public const TIER_FREE = 'free';
    public const TIER_PRO = 'pro';
    public const TIER_VIP = 'vip';
    public const TIER_UNLIMITED = 'unlimited';

    public const TIERS = [
        self::TIER_FREE,
        self::TIER_PRO,
        self::TIER_VIP,
        self::TIER_UNLIMITED,
    ];

    /** Default member values for a brand-new free account. */
    public const DEFAULT_TIER = self::TIER_FREE;
    public const DEFAULT_MAX_BINDS = 1;

    /**
     * Default recharge packages. days = membership extension granted on payment;
     * tier / max_binds are applied to the member when the order is marked paid.
     * Seeded into the recharge_configs row and used as the fallback package list.
     */
    public const DEFAULT_PACKAGES = [
        [
            'id' => 'monthly',
            'name' => 'Monthly',
            'days' => 30,
            'price' => 19.90,
            'tier' => self::TIER_PRO,
            'max_binds' => 2,
        ],
        [
            'id' => 'quarterly',
            'name' => 'Quarterly',
            'days' => 90,
            'price' => 49.90,
            'tier' => self::TIER_PRO,
            'max_binds' => 3,
        ],
        [
            'id' => 'yearly',
            'name' => 'Yearly',
            'days' => 365,
            'price' => 159.00,
            'tier' => self::TIER_VIP,
            'max_binds' => 5,
        ],
    ];

    /** Default recharge provider. */
    public const DEFAULT_PROVIDER = 'custom';
}
