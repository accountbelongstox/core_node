<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1DBTablesBrige;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * DingDuoDuoV1 (订多多) database table mappings. Centralizes table-name resolution
 * for the sub-app; all DB operations reference these instead of hardcoded names.
 * Mirrors the PddToolV1TableMaps / AppQyV1TableMaps convention exactly.
 */
class DingDuoDuoV1TableMaps
{
    /**
     * Get the table prefix from the central app registry (config/app_registry.php).
     */
    private static function getTablePrefix(): string
    {
        static $prefix = null;
        if ($prefix === null) {
            $appKey = AppKeys::DINGDUODUOV1;
            $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        }
        return $prefix;
    }

    public const ding_duo_duo_v1_MEMBERS = [
        'tablename' => 'members',
        'fields' => [
            'id' => 'id',
            'username' => 'username',
            'password' => 'password',
            'token' => 'token',
            'tier' => 'tier',
            'max_binds' => 'max_binds',
            'balance' => 'balance',
            'permissions' => 'permissions',
            'expires_at' => 'expires_at',
            'status' => 'status',
            'remark' => 'remark',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const ding_duo_duo_v1_SUPER_CODES = [
        'tablename' => 'super_codes',
        'fields' => [
            'id' => 'id',
            'code' => 'code',
            'label' => 'label',
            'tier' => 'tier',
            'max_binds' => 'max_binds',
            'features' => 'features',
            'scope' => 'scope',
            'expires_at' => 'expires_at',
            'status' => 'status',
            'created_by' => 'created_by',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const ding_duo_duo_v1_DEVICES = [
        'tablename' => 'devices',
        'fields' => [
            'id' => 'id',
            'device_id' => 'device_id',
            'member_id' => 'member_id',
            'last_seen_at' => 'last_seen_at',
            'info' => 'info',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const ding_duo_duo_v1_PDD_BINDINGS = [
        'tablename' => 'pdd_bindings',
        'fields' => [
            'id' => 'id',
            'owner_type' => 'owner_type',
            'owner_id' => 'owner_id',
            'pdd_user_id' => 'pdd_user_id',
            'nickname' => 'nickname',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const ding_duo_duo_v1_RECHARGE_CONFIGS = [
        'tablename' => 'recharge_configs',
        'fields' => [
            'id' => 'id',
            'provider' => 'provider',
            'api_key' => 'api_key',
            'api_secret' => 'api_secret',
            'endpoint' => 'endpoint',
            'notify_url' => 'notify_url',
            'packages' => 'packages',
            'enabled' => 'enabled',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const ding_duo_duo_v1_RECHARGE_ORDERS = [
        'tablename' => 'recharge_orders',
        'fields' => [
            'id' => 'id',
            'member_id' => 'member_id',
            'package_id' => 'package_id',
            'amount' => 'amount',
            'status' => 'status',
            'out_trade_no' => 'out_trade_no',
            'paid_at' => 'paid_at',
            'raw' => 'raw',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    /**
     * Get the full table name by key. Automatically adds the app prefix when absent.
     */
    public static function getTableName(string $tableKey): string
    {
        $prefix = self::getTablePrefix();
        $fullKey = $tableKey;
        $prefixLower = strtolower($prefix);
        if (!str_starts_with(strtolower($tableKey), $prefixLower . '_')) {
            $fullKey = $prefix . '_' . $tableKey;
        }

        if (defined("self::{$fullKey}")) {
            $tableSuffix = constant("self::{$fullKey}")['tablename'];
            return "{$prefix}_{$tableSuffix}";
        }
        return '';
    }

    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $prefix = self::getTablePrefix();
        $fullKey = $tableKey;
        $prefixLower = strtolower($prefix);
        if (!str_starts_with(strtolower($tableKey), $prefixLower . '_')) {
            $fullKey = $prefix . '_' . $tableKey;
        }

        if (defined("self::{$fullKey}")) {
            $tableMap = constant("self::{$fullKey}");
            return $tableMap['fields'][$fieldKey] ?? $fieldKey;
        }
        return $fieldKey;
    }

    public static function getTableFields(string $tableKey): array
    {
        $prefix = self::getTablePrefix();
        $fullKey = $tableKey;
        $prefixLower = strtolower($prefix);
        if (!str_starts_with(strtolower($tableKey), $prefixLower . '_')) {
            $fullKey = $prefix . '_' . $tableKey;
        }

        if (defined("self::{$fullKey}")) {
            return constant("self::{$fullKey}")['fields'];
        }
        return [];
    }

    public static function getAvailableTableKeys(): array
    {
        $prefix = self::getTablePrefix();
        return [
            "{$prefix}_MEMBERS",
            "{$prefix}_SUPER_CODES",
            "{$prefix}_DEVICES",
            "{$prefix}_PDD_BINDINGS",
            "{$prefix}_RECHARGE_CONFIGS",
            "{$prefix}_RECHARGE_ORDERS",
        ];
    }
}
