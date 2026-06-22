<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1User;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PddAccountModel;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1Presenter;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1ProfileResolver;

/**
 * PddToolV1 member self-service: profile, password, and PDD-account binding.
 * Every action is behind 'custom.authenticate' (Sanctum bearer token); the
 * authenticated principal is the global App\Models\User, its membership lives in
 * a PddToolV1ProfileModel resolved via PddToolV1ProfileResolver.
 */
class PddToolV1UserController extends BaseController
{
    /**
     * GET /users/me -> USER
     */
    public function me(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }
        $profile = PddToolV1ProfileResolver::profile($request);
        return response()->json(PddToolV1Presenter::user($user, $profile));
    }

    /**
     * PUT /users/me/password {current_password, new_password}
     *
     * Password lives on the global users table; verify + update there.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $current = (string) $request->input('current_password', '');
        $new = (string) $request->input('new_password', '');

        if ($new === '') {
            return response()->json(['detail' => 'New password is required'], 422);
        }

        if (!Hash::check($current, (string) $user->password)) {
            return response()->json(['detail' => 'Current password is incorrect'], 400);
        }

        $user->password = Hash::make($new);
        $user->save();

        return response()->json(['success' => true, 'detail' => 'Password updated']);
    }

    /**
     * POST /users/me/pdd-accounts -> PDD_ACCOUNT  (idempotent upsert by pdd_user_id).
     */
    public function bindPddAccount(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }
        $profile = PddToolV1ProfileResolver::profile($request);

        $pddUserId = (string) $request->input('pdd_user_id', '');
        if ($pddUserId === '') {
            return response()->json(['detail' => 'pdd_user_id is required'], 422);
        }

        $existing = PddToolV1PddAccountModel::query()
            ->where('user_id', $user->id)
            ->where('pdd_user_id', $pddUserId)
            ->first();

        // Enforce the per-member account limit on NEW binds only.
        if (!$existing) {
            $count = PddToolV1PddAccountModel::query()->where('user_id', $user->id)->count();
            $max = (int) ($profile->max_pdd_accounts ?? 0);
            if ($max >= 0 && $count >= $max) {
                return response()->json(['detail' => 'PDD account limit reached'], 403);
            }
        }

        $account = $existing ?: new PddToolV1PddAccountModel();
        $account->user_id = $user->id;
        $account->pdd_user_id = $pddUserId;
        $account->pdd_name = (string) $request->input('pdd_name', $account->pdd_name ?? '');
        $account->pdd_avatar = (string) $request->input('pdd_avatar', $account->pdd_avatar ?? '');
        $account->pdd_cookie = (string) $request->input('pdd_cookie', $account->pdd_cookie ?? '');
        $account->pdd_access_token = (string) $request->input('pdd_access_token', $account->pdd_access_token ?? '');

        if ($request->has('mobile_bind')) {
            $account->mobile_bind = $request->input('mobile_bind');
        }
        if ($request->has('dd_info')) {
            $account->dd_info = $request->input('dd_info');
        }

        $account->save();

        return response()->json(PddToolV1Presenter::pddAccount($account));
    }

    /**
     * GET /users/me/pdd-accounts/{pdd_user_id} -> PDD_ACCOUNT
     */
    public function getPddAccount(Request $request, string $pddUserId): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $account = PddToolV1PddAccountModel::query()
            ->where('user_id', $user->id)
            ->where('pdd_user_id', $pddUserId)
            ->first();

        if (!$account) {
            return response()->json(['detail' => 'PDD account not found'], 404);
        }

        return response()->json(PddToolV1Presenter::pddAccount($account));
    }
}
