<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Services;

use App\Models\User;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PddAccountModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1WarehouseModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1RechargeModel;

/**
 * Shapes the global User + per-app membership profile into the EXACT response
 * schemas from the backend contract (USER / PDD_ACCOUNT / WAREHOUSE) and the
 * admin spec (USER_ADMIN / RECHARGE / PACKAGE). Centralized so the
 * extension-facing and admin surfaces never drift.
 *
 * Identity (id / username) comes from App\Models\User; membership data comes from
 * PddToolV1ProfileModel (keyed by user_id).
 */
class PddToolV1Presenter
{
    /**
     * USER object (extension-facing). Includes pdd_accounts[] inline.
     */
    public static function user(User $user, PddToolV1ProfileModel $profile): array
    {
        $accounts = PddToolV1PddAccountModel::query()
            ->where('user_id', $user->id)
            ->orderBy('id')
            ->get();

        return [
            'id' => (int) $user->id,
            'username' => (string) $user->username,
            'valid_until' => self::isoOrNull($profile->valid_until),
            'max_orders' => (int) ($profile->max_orders ?? 0),
            'max_pdd_accounts' => (int) ($profile->max_pdd_accounts ?? 0),
            'points' => self::asNumber($profile->points),
            'package_name' => (string) ($profile->package_name ?? ''),
            'payment_model' => (string) ($profile->payment_model ?? ''),
            'invite_code' => (string) ($profile->invite_code ?? ''),
            'pdd_accounts' => $accounts->map(fn ($a) => self::pddAccount($a))->all(),
        ];
    }

    /**
     * PDD_ACCOUNT object.
     */
    public static function pddAccount(PddToolV1PddAccountModel $account): array
    {
        return [
            'id' => (int) $account->id,
            'pdd_user_id' => (string) $account->pdd_user_id,
            'pdd_name' => (string) ($account->pdd_name ?? ''),
            'pdd_avatar' => (string) ($account->pdd_avatar ?? ''),
            'pdd_access_token' => (string) ($account->pdd_access_token ?? ''),
            'pdd_cookie' => (string) ($account->pdd_cookie ?? ''),
            'mobile_bind' => $account->mobile_bind !== null ? (string) $account->mobile_bind : null,
            'dd_info' => $account->dd_info !== null ? (string) $account->dd_info : null,
        ];
    }

    /**
     * WAREHOUSE object.
     */
    public static function warehouse(PddToolV1WarehouseModel $warehouse): array
    {
        return [
            'warehouse_code' => (string) $warehouse->warehouse_code,
            'warehouse_name' => (string) ($warehouse->warehouse_name ?? ''),
            'receiver_name' => (string) ($warehouse->receiver_name ?? ''),
            'phone' => (string) ($warehouse->phone ?? ''),
            'province' => (string) ($warehouse->province ?? ''),
            'city' => (string) ($warehouse->city ?? ''),
            'district' => (string) ($warehouse->district ?? ''),
            'detail_address' => (string) ($warehouse->detail_address ?? ''),
        ];
    }

    /**
     * USER_ADMIN object (admin console). is_expired derived from valid_until.
     *
     * $username is passed in because the username lives on the global users table
     * (a different connection) and the admin listing hydrates it in bulk.
     */
    public static function userAdmin(PddToolV1ProfileModel $profile, string $username): array
    {
        $accountsCount = PddToolV1PddAccountModel::query()
            ->where('user_id', $profile->user_id)
            ->count();

        return [
            'id' => (int) $profile->user_id,
            'username' => (string) $username,
            'package_name' => (string) ($profile->package_name ?? ''),
            'valid_until' => self::isoOrNull($profile->valid_until),
            'is_expired' => self::isExpired($profile),
            'points' => self::asNumber($profile->points),
            'max_orders' => (int) ($profile->max_orders ?? 0),
            'max_pdd_accounts' => (int) ($profile->max_pdd_accounts ?? 0),
            'pdd_accounts_count' => (int) $accountsCount,
            'disabled' => (bool) ($profile->disabled ?? false),
            'created_at' => self::isoOrNull($profile->created_at),
            'last_login' => self::isoOrNull($profile->last_login),
        ];
    }

    /**
     * RECHARGE object (admin console + status).
     */
    public static function recharge(PddToolV1RechargeModel $recharge): array
    {
        return [
            'id' => (int) $recharge->id,
            'user_id' => (int) $recharge->user_id,
            'username' => (string) ($recharge->username ?? ''),
            'amount' => self::asNumber($recharge->amount),
            'method' => (string) ($recharge->method ?? ''),
            'status' => (string) ($recharge->status ?? ''),
            'out_trade_no' => (string) ($recharge->out_trade_no ?? ''),
            'package_name' => $recharge->package_name !== null ? (string) $recharge->package_name : null,
            'grant_days' => $recharge->grant_days !== null ? (int) $recharge->grant_days : null,
            'created_at' => self::isoOrNull($recharge->created_at),
            'paid_at' => self::isoOrNull($recharge->paid_at),
        ];
    }

    /**
     * PACKAGE object (admin tier table + recharge package list).
     */
    public static function package(array|object $package): array
    {
        $p = (array) $package;
        return [
            'code' => (string) ($p['code'] ?? ''),
            'name' => (string) ($p['name'] ?? ''),
            'price_month' => self::asNumber($p['price_month'] ?? 0),
            'price_year' => self::asNumber($p['price_year'] ?? 0),
            'max_orders' => (int) ($p['max_orders'] ?? 0),
            'max_pdd_accounts' => (int) ($p['max_pdd_accounts'] ?? 0),
            'enabled' => (bool) ($p['enabled'] ?? true),
        ];
    }

    public static function isExpired(PddToolV1ProfileModel $profile): bool
    {
        if (empty($profile->valid_until)) {
            return true;
        }
        try {
            return $profile->valid_until->isPast();
        } catch (\Throwable $e) {
            return true;
        }
    }

    private static function isoOrNull($value): ?string
    {
        if (empty($value)) {
            return null;
        }
        try {
            return $value->toIso8601String();
        } catch (\Throwable $e) {
            return (string) $value;
        }
    }

    private static function asNumber($value): float
    {
        return round((float) $value, 2);
    }
}
