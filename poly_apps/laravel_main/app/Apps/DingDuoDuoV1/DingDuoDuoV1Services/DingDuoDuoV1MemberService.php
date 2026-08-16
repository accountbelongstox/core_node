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
use App\Models\User;
use App\Services\UnifiedAuthService;
use App\Http\Common\CommonAuthService;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;

/**
 * Member membership operations on top of the canonical global users table:
 * credential login verifies against users (via UnifiedAuthService) and issues a
 * Sanctum token; the members table keeps only app-specific extension fields
 * linked by user_id. Also covers device upsert and the recharge-driven
 * membership extension.
 *
 * Migration path for legacy rows (member-local username/password, user_id NULL):
 * on a failed global login the legacy member password is checked once; on match
 * a global user is registered with the same credentials and the member row is
 * linked (user_id set). Legacy `token` values are no longer honored.
 */
class DingDuoDuoV1MemberService
{
    /**
     * Sanctum token name issued for DingDuoDuoV1 member logins.
     */
    private const TOKEN_NAME = 'dingduoduo-member';

    /**
     * Verify credentials against the global users table, link (or lazily
     * migrate) the member extension row, issue a Sanctum token, upsert the
     * calling device, and return the token plus the public member shape.
     * Returns null on bad creds / disabled account / unlinked identity.
     *
     * @return array{token:string,member:array}|null
     */
    public static function login(string $username, string $password, ?string $deviceId = null): ?array
    {
        $user = null;
        $member = null;

        $auth = UnifiedAuthService::login($username, $password);

        if ($auth['success']) {
            $user = $auth['user'];
            $member = self::linkableMemberForUser($user, $username);
        } else {
            $member = self::migrateLegacyMember($username, $password);
            if ($member !== null) {
                $user = User::findById((int) $member->user_id);
            }
        }

        if (!$user || !$member) {
            return null;
        }

        if ($member->status !== 'active') {
            return null;
        }

        $token = $user->createToken(self::TOKEN_NAME)->plainTextToken;

        if ($deviceId !== null && $deviceId !== '') {
            self::upsertDevice($deviceId, (int) $member->id);
        }

        $member->refreshRecord();

        return [
            'token' => $token,
            'member' => $member->toArray(),
        ];
    }

    /**
     * Resolve an active member from a presented Sanctum plain-text token (the
     * extension sends it on the X-DD-Token header / token param). This replaces
     * the legacy members.token lookup: validation now goes through Sanctum.
     */
    public static function activeMemberForToken(string $token): ?DingDuoDuoV1MemberModel
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        $user = CommonAuthService::getUserByLoginToken($token);
        if (!$user) {
            return null;
        }

        $member = DingDuoDuoV1MemberModel::findByUserId((int) $user->id);
        if (!$member || $member->status !== 'active') {
            return null;
        }

        return $member;
    }

    /**
     * Member extension row for a global user: linked row first, otherwise an
     * unlinked legacy row with the same username gets linked additively. Null
     * when no member exists or the row is linked to a different user.
     */
    private static function linkableMemberForUser(User $user, string $username): ?DingDuoDuoV1MemberModel
    {
        $member = DingDuoDuoV1MemberModel::findByUserId((int) $user->id);
        if ($member) {
            return $member;
        }

        $member = DingDuoDuoV1MemberModel::findByUsername($username);
        if ($member && $member->user_id === null) {
            $member->user_id = (int) $user->id;
            $member->saveRecord();
            return $member;
        }

        return null;
    }

    /**
     * Legacy migration path: the member row still holds the only copy of the
     * credentials (user_id NULL). Verify the legacy password once, register the
     * global user with the same credentials, and link the row. Refuses when a
     * global identity already exists under the username (ambiguous ownership) —
     * such rows must be linked/reset via the admin console.
     */
    private static function migrateLegacyMember(string $username, string $password): ?DingDuoDuoV1MemberModel
    {
        $member = DingDuoDuoV1MemberModel::findByUsername($username);

        if (!$member || $member->user_id !== null) {
            return null;
        }

        if (empty($member->password) || !Hash::check($password, (string) $member->password)) {
            return null;
        }

        if (User::findByUsernameOrEmail($username)) {
            return null;
        }

        $registered = UnifiedAuthService::register([
            'username' => $username,
            'email' => null,
            'password' => $password,
        ]);

        if (!$registered['success']) {
            return null;
        }

        $member->user_id = (int) $registered['user']->id;
        $member->saveRecord();

        return $member;
    }

    /**
     * Upsert a device row by device_id, attaching the member and bumping last_seen.
     */
    public static function upsertDevice(string $deviceId, ?int $memberId = null, array $info = []): DingDuoDuoV1DeviceModel
    {
        /** @var DingDuoDuoV1DeviceModel $device */
        $device = DingDuoDuoV1DeviceModel::findOrNewByDeviceId($deviceId);
        if ($memberId !== null) {
            $device->member_id = $memberId;
        }
        if (!empty($info)) {
            $device->info = $info;
        }
        $device->last_seen_at = now();
        $device->saveRecord();

        return $device;
    }

    /**
     * Set the membership expiry (null = never expires).
     */
    public static function setExpiry(DingDuoDuoV1MemberModel $member, ?string $expiresAt): DingDuoDuoV1MemberModel
    {
        $member->expires_at = ($expiresAt === null || $expiresAt === '') ? null : Carbon::parse($expiresAt);
        $member->saveRecord();

        return $member;
    }

    /**
     * Replace the member permission (feature) list.
     */
    public static function setPermissions(DingDuoDuoV1MemberModel $member, array $permissions): DingDuoDuoV1MemberModel
    {
        $member->permissions = array_values($permissions);
        $member->saveRecord();

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
        $member->saveRecord();

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

        $member->saveRecord();

        return $member;
    }
}
