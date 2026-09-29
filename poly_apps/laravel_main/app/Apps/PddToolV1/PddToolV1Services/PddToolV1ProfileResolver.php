<?php

namespace App\Apps\PddToolV1\PddToolV1Services;

use Illuminate\Http\Request;
use App\Models\User;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;

/**
 * Bridges the `custom.authenticate` (Sanctum) principal to the PddToolV1
 * membership profile.
 *
 * The protected ROOT routes are guarded by `custom.authenticate`, which puts the
 * global App\Models\User on the request ($request->user()). This resolver reads
 * that user and loads (lazily creating a TRIAL profile if absent) the per-app
 * PddToolV1ProfileModel keyed by users.id. Returns null only when there is no
 * authenticated user at all (which should not happen behind the middleware).
 */
class PddToolV1ProfileResolver
{
    /**
     * The authenticated global user, or null if unauthenticated.
     */
    public static function user(Request $request): ?User
    {
        $user = $request->user();
        return $user instanceof User ? $user : null;
    }

    /**
     * The membership profile for the authenticated user, created on first use as
     * a TRIAL profile. Null only if there is no authenticated user.
     */
    public static function profile(Request $request): ?PddToolV1ProfileModel
    {
        $user = self::user($request);
        if (!$user) {
            return null;
        }
        return PddToolV1ProfileModel::ensureTrial((int) $user->id);
    }
}
