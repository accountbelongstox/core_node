<?php

namespace App\Apps\Relay\RelayServices;

use App\Models\User;

/**
 * Super admins operate ONE shared relay fleet: device visibility, pairing
 * authorization and presence publication span every super-admin account.
 * All other users remain strictly owner-scoped.
 *
 * Laravel remains the membership authority — pairings and operations stay
 * keyed by the acting user, and device authentication stays signature-based;
 * this scope only widens which OWNER rows a super admin may see and bind.
 */
final class RelayFleetScope
{
    /**
     * Owner ids whose devices the given user may see and bind.
     *
     * @return array<int,int>
     */
    public static function deviceOwnerIds(int $userId): array
    {
        if (!self::isSuperAdminId($userId)) {
            return [$userId];
        }

        return self::superAdminIds();
    }

    /**
     * Presence fan-out targets for a device owner: the whole super-admin
     * fleet when the owner is a super admin, otherwise just the owner.
     *
     * @return array<int,int>
     */
    public static function presenceAudienceIds(int $ownerUserId): array
    {
        if (!self::isSuperAdminId($ownerUserId)) {
            return [$ownerUserId];
        }

        return self::superAdminIds();
    }

    /**
     * @return array<int,int>
     */
    public static function superAdminIds(): array
    {
        return User::query()
            ->where('rolelevel', '>=', 100)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }

    private static function isSuperAdminId(int $userId): bool
    {
        return (int) User::query()->whereKey($userId)->value('rolelevel') >= 100;
    }

    private function __construct()
    {
    }
}
