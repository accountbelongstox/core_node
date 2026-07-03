<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Services;

use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1MemberModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1DeviceModel;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;

/**
 * Member identity + membership operations: credential login (bcrypt), token
 * (re)issue, device upsert, and the recharge-driven membership extension.
 */
class DingDuoDuoV1MemberService
{
    /**
     * Verify credentials, (re)issue a token, upsert the calling device, and return
     * the issued token plus the public member shape. Returns null on bad creds /
     * disabled account.
     *
     * @return array{token:string,member:array}|null
     */
    public static function login(string $username, string $password, ?string $deviceId = null): ?array
    {
        $member = DingDuoDuoV1MemberModel::query()->where('username', $username)->first();

        if (!$member || !Hash::check($password, (string) $member->password)) {
            return null;
        }

        if ($member->status !== 'active') {
            return null;
        }

        $token = self::issueToken($member);

        if ($deviceId !== null && $deviceId !== '') {
            self::upsertDevice($deviceId, (int) $member->id);
        }

        $member->refresh();

        return [
            'token' => $token,
            'member' => $member->toArray(),
        ];
    }

    /**
     * Generate a fresh unique token and persist it on the member.
     */
    public static function issueToken(DingDuoDuoV1MemberModel $member): string
    {
        do {
            $token = 'ddm_' . Str::random(48);
        } while (DingDuoDuoV1MemberModel::query()->where('token', $token)->exists());

        $member->token = $token;
        $member->save();

        return $token;
    }

    /**
     * Upsert a device row by device_id, attaching the member and bumping last_seen.
     */
    public static function upsertDevice(string $deviceId, ?int $memberId = null, array $info = []): DingDuoDuoV1DeviceModel
    {
        /** @var DingDuoDuoV1DeviceModel $device */
        $device = DingDuoDuoV1DeviceModel::query()->firstOrNew(['device_id' => $deviceId]);
        if ($memberId !== null) {
            $device->member_id = $memberId;
        }
        if (!empty($info)) {
            $device->info = $info;
        }
        $device->last_seen_at = now();
        $device->save();

        return $device;
    }

    /**
     * Set the membership expiry (null = never expires).
     */
    public static function setExpiry(DingDuoDuoV1MemberModel $member, ?string $expiresAt): DingDuoDuoV1MemberModel
    {
        $member->expires_at = ($expiresAt === null || $expiresAt === '') ? null : Carbon::parse($expiresAt);
        $member->save();

        return $member;
    }

    /**
     * Replace the member permission (feature) list.
     */
    public static function setPermissions(DingDuoDuoV1MemberModel $member, array $permissions): DingDuoDuoV1MemberModel
    {
        $member->permissions = array_values($permissions);
        $member->save();

        return $member;
    }

    /**
     * Set the member tier and optionally its bind quota.
     */
    public static function setTier(DingDuoDuoV1MemberModel $member, string $tier, ?int $maxBinds = null): DingDuoDuoV1MemberModel
    {
        $member->tier = $tier;
        if ($maxBinds !== null) {
            $member->max_binds = $maxBinds;
        }
        $member->save();

        return $member;
    }

    /**
     * Apply a paid recharge package to a member: extend expires_at by the package's
     * days (from the later of now / current expiry) and set tier + max_binds.
     */
    public static function applyRecharge(DingDuoDuoV1MemberModel $member, array $package): DingDuoDuoV1MemberModel
    {
        $days = (int) ($package['days'] ?? 0);

        $base = ($member->expires_at instanceof Carbon && $member->expires_at->isFuture())
            ? $member->expires_at->copy()
            : now();

        if ($days > 0) {
            $member->expires_at = $base->addDays($days);
        }

        if (!empty($package['tier'])) {
            $member->tier = (string) $package['tier'];
        }

        if (isset($package['max_binds'])) {
            $member->max_binds = (int) $package['max_binds'];
        }

        $member->save();

        return $member;
    }
}
