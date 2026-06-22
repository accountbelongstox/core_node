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
