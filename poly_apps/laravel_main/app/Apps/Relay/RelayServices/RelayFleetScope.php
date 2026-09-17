<?php

namespace App\Apps\Relay\RelayServices;

use App\Models\User;

final class RelayFleetScope
{
    public static function publicOwner(): ?User
    {
        return User::query()->where('rolelevel', '>=', 100)->orderBy('id')->first()
            ?? User::highestRoleUser();
    }

    /**
     * Owner ids whose devices the given user may see and bind.
     *
     * @return array<int,int>
     */
    public static function deviceOwnerIds(int $userId): array
    {
        $publicOwnerId = self::publicOwner()?->getAuthIdentifier();

        if ($publicOwnerId !== null && $userId === (int) $publicOwnerId) {
            return User::query()->pluck('id')->map(static fn ($id): int => (int) $id)->all();
        }

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
        $publicOwnerId = self::publicOwner()?->getAuthIdentifier();
        $audienceIds = self::isSuperAdminId($ownerUserId) ? self::superAdminIds() : [$ownerUserId];

        if ($publicOwnerId !== null) {
            $audienceIds[] = (int) $publicOwnerId;
        }

        return array_values(array_unique($audienceIds));
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
