<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1DBTablesBrige;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

/**
 * PddToolV1 (订多多 / PDD Order Tool) Application Database Table Mappings.
 *
 * Centralized table name and field mappings for the PddToolV1 sub-app. All DB
 * operations reference these mappings instead of hardcoded table/field names.
 * Mirrors the AppQyV1TableMaps convention exactly.
 */
class PddToolV1TableMaps
{
    /**
     * Get table prefix from the central app registry (config/app_registry.php).
     */
    private static function getTablePrefix(): string
    {
        static $prefix = null;
        if ($prefix === null) {
            $appKey = AppKeys::PDDTOOLV1;
            $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
        }
        return $prefix;
    }

    public const pdd_tool_v1_PROFILES = [
        'tablename' => 'profiles',
        'fields' => [
            'user_id' => 'user_id',
            'package_name' => 'package_name',
            'payment_model' => 'payment_model',
            'valid_until' => 'valid_until',
            'max_orders' => 'max_orders',
            'max_pdd_accounts' => 'max_pdd_accounts',
            'points' => 'points',
            'invite_code' => 'invite_code',
            'app_type' => 'app_type',
            'acquisition_source' => 'acquisition_source',
            'disabled' => 'disabled',
            'last_login' => 'last_login',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_PDD_ACCOUNTS = [
        'tablename' => 'pdd_accounts',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'pdd_user_id' => 'pdd_user_id',
            'pdd_name' => 'pdd_name',
            'pdd_avatar' => 'pdd_avatar',
            'pdd_access_token' => 'pdd_access_token',
            'pdd_cookie' => 'pdd_cookie',
            'mobile_bind' => 'mobile_bind',
            'dd_info' => 'dd_info',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_WAREHOUSES = [
        'tablename' => 'warehouses',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'warehouse_code' => 'warehouse_code',
            'warehouse_name' => 'warehouse_name',
            'receiver_name' => 'receiver_name',
            'phone' => 'phone',
            'province' => 'province',
            'city' => 'city',
            'district' => 'district',
            'detail_address' => 'detail_address',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_BATCH_ORDERS = [
        'tablename' => 'batch_orders',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'batch_id' => 'batch_id',
            'order_count' => 'order_count',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_BATCH_PURCHASE_ORDERS = [
        'tablename' => 'batch_purchase_orders',
        'fields' => [
            'id' => 'id',
            'batch_id' => 'batch_id',
            'user_id' => 'user_id',
            'purchase_order_no' => 'purchase_order_no',
            'goods_id' => 'goods_id',
            'sku_id' => 'sku_id',
            'quantity' => 'quantity',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_RECHARGES = [
        'tablename' => 'recharges',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'username' => 'username',
            'out_trade_no' => 'out_trade_no',
            'amount' => 'amount',
            'method' => 'method',
            'status' => 'status',
            'package_name' => 'package_name',
            'period' => 'period',
            'grant_days' => 'grant_days',
            'pay_url' => 'pay_url',
            'qr_code' => 'qr_code',
            'sandbox' => 'sandbox',
            'paid_at' => 'paid_at',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_PACKAGES = [
        'tablename' => 'packages',
        'fields' => [
            'id' => 'id',
            'code' => 'code',
            'name' => 'name',
            'price_month' => 'price_month',
            'price_year' => 'price_year',
            'max_orders' => 'max_orders',
            'max_pdd_accounts' => 'max_pdd_accounts',
            'enabled' => 'enabled',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    public const pdd_tool_v1_USAGE_LOGS = [
        'tablename' => 'usage_logs',
        'fields' => [
            'id' => 'id',
            'user_id' => 'user_id',
            'action' => 'action',
            'meta' => 'meta',
            'created_at' => 'created_at',
        ],
    ];

    public const pdd_tool_v1_PAYMENT_SETTINGS = [
        'tablename' => 'payment_settings',
        'fields' => [
            'id' => 'id',
            'alipay_enabled' => 'alipay_enabled',
            'alipay_app_id' => 'alipay_app_id',
            'wechat_enabled' => 'wechat_enabled',
            'wechat_mch_id' => 'wechat_mch_id',
            'wechat_app_id' => 'wechat_app_id',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
        ],
    ];

    /**
     * Get table name by key. Automatically adds the app prefix when absent.
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
            "{$prefix}_PROFILES",
            "{$prefix}_PDD_ACCOUNTS",
            "{$prefix}_WAREHOUSES",
            "{$prefix}_BATCH_ORDERS",
            "{$prefix}_BATCH_PURCHASE_ORDERS",
            "{$prefix}_RECHARGES",
            "{$prefix}_PACKAGES",
            "{$prefix}_USAGE_LOGS",
            "{$prefix}_PAYMENT_SETTINGS",
        ];
    }
}
