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

use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1SuperCodeModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Enums\DingDuoDuoV1LicenseMode;
use Carbon\Carbon;

/**
 * Resolves a presented token into a license payload the 订多多 extension consumes.
 *
 * Resolution order: a DB super code (or an offline-valid one) -> a Sanctum
 * member token (validated via DingDuoDuoV1MemberService) -> locked. The
 * returned array ALWAYS carries these keys: mode, tier, features (array),
 * max_binds (int), expires_at (unix seconds or null), label, token,
 * member_id (int or null).
 */
class DingDuoDuoV1LicenseService
{
    /**
     * @return array{mode:string,tier:string,features:array,max_binds:int,expires_at:int|null,label:string|null,token:string,member_id:int|null}
     */
    public static function resolveByToken(?string $token, ?string $deviceId = null): array
    {
        $token = is_string($token) ? trim($token) : '';
        if ($token === '') {
            return self::lockedPayload($token);
        }

        // 1) Super code stored in the DB (active + not expired). Case-insensitive
        //    match so a lowercase-presented code still resolves.
        $superCode = DingDuoDuoV1SuperCodeModel::findActiveCode($token);

        if ($superCode && !self::isExpired($superCode->expires_at)) {
            return [
                'mode' => DingDuoDuoV1LicenseMode::Super->value,
                'tier' => $superCode->tier ?: DingDuoDuoV1Constants::TIER_UNLIMITED,
                'features' => ['*'],
                'max_binds' => (int) ($superCode->max_binds ?? 0),
                'expires_at' => self::toUnix($superCode->expires_at),
                'label' => $superCode->label ?: 'Super Code',
                'token' => $token,
                'member_id' => null,
            ];
        }

        // 2) Offline-valid super code not (yet) persisted: honor it as unlimited so
        //    the extension's offline-issued codes keep working server-side.
        if (DingDuoDuoV1SuperCodeService::verify($token)) {
            return [
                'mode' => DingDuoDuoV1LicenseMode::Super->value,
                'tier' => DingDuoDuoV1Constants::TIER_UNLIMITED,
                'features' => ['*'],
                'max_binds' => 0,
                'expires_at' => null,
                'label' => 'Super Code',
                'token' => $token,
                'member_id' => null,
            ];
        }

        // 3) Member token: a Sanctum personal access token whose owning global
        //    user has an active, unexpired member extension row.
        $member = DingDuoDuoV1MemberService::activeMemberForToken($token);

        if ($member && !self::isExpired($member->expires_at)) {
            $features = is_array($member->permissions) ? array_values($member->permissions) : [];
            return [
                'mode' => DingDuoDuoV1LicenseMode::Member->value,
                'tier' => $member->tier ?: DingDuoDuoV1Constants::TIER_FREE,
                'features' => $features,
                'max_binds' => (int) ($member->max_binds ?? DingDuoDuoV1Constants::DEFAULT_MAX_BINDS),
                'expires_at' => self::toUnix($member->expires_at),
                'label' => $member->remark ?: $member->username,
                'token' => $token,
                'member_id' => (int) $member->id,
            ];
        }

        // 4) Nothing matched -> locked.
        return self::lockedPayload($token);
    }

    /**
     * The locked / no-entitlement payload.
     *
     * @return array{mode:string,tier:string,features:array,max_binds:int,expires_at:null,label:null,token:string,member_id:null}
     */
    private static function lockedPayload(string $token): array
    {
        return [
            'mode' => DingDuoDuoV1LicenseMode::Locked->value,
            'tier' => DingDuoDuoV1Constants::TIER_FREE,
            'features' => [],
            'max_binds' => 0,
            'expires_at' => null,
            'label' => null,
            'token' => $token,
            'member_id' => null,
        ];
    }

    /**
     * True when an expiry timestamp is set AND already in the past.
     */
    private static function isExpired($expiresAt): bool
    {
        if ($expiresAt === null || $expiresAt === '') {
            return false;
        }
        $when = $expiresAt instanceof Carbon ? $expiresAt : Carbon::parse((string) $expiresAt);
        return $when->isPast();
    }

    /**
     * Convert a nullable timestamp to unix seconds (or null).
     */
    private static function toUnix($expiresAt): ?int
    {
        if ($expiresAt === null || $expiresAt === '') {
            return null;
        }
        $when = $expiresAt instanceof Carbon ? $expiresAt : Carbon::parse((string) $expiresAt);
        return $when->getTimestamp();
    }
}
