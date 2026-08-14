<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Auth;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Http\Common\CommonUserGen;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1Presenter;
use App\Apps\PddToolV1\PddToolV1Constants\PddToolV1Defaults;

/**
 * PddToolV1 (订多多) authentication: login / register / health.
 *
 * Auth is unified with the rest of the project: the principal is the global
 * App\Models\User (users table on connection `main`) and tokens are Laravel
 * Sanctum bearer tokens ($user->createToken('pdd-tool')->plainTextToken). The
 * protected routes are guarded by `custom.authenticate`. Membership data lives in
 * PddToolV1ProfileModel keyed by user_id.
 *
 * All errors use the FastAPI {"detail":"..."} shape the Chrome extension reads.
 */
class PddToolV1AuthController extends BaseController
{
    /**
     * Sanctum token name used for all PddToolV1 logins.
     */
    private const TOKEN_NAME = 'pdd-tool';

    /**
     * GET / health probe (3s timeout, used by the extension to pick a live host).
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'service' => 'PddToolV1',
            'status' => 'ok',
            'time' => now()->toIso8601String(),
        ]);
    }

    /**
     * POST /login  (form: username, password) -> {access_token, user:USER}
     */
    public function login(Request $request): JsonResponse
    {
        $username = (string) $request->input('username', '');
        $password = (string) $request->input('password', '');

        if ($username === '' || $password === '') {
            return response()->json(['detail' => 'Username and password are required'], 422);
        }

        // Super-code free unlock: password is the username reversed (e.g. FREE-VIP / PIV-EERF).
        // Ensure a real global User + ULTIMATE profile exists and issue a REAL Sanctum token so
        // authenticated calls validate via custom.authenticate. Restricted to the single
        // SUPER_VIP_USERNAME by PddToolV1Defaults::isSuperLogin.
        if (PddToolV1Defaults::isSuperLogin($username, $password)) {
            $user = $this->ensureSuperUser($username, $password);
            $profile = PddToolV1ProfileModel::ensureUltimate((int) $user->id);
            $profile->last_login = now();
            $profile->saveRecord();

            return response()->json([
                'access_token' => $user->createToken(self::TOKEN_NAME)->plainTextToken,
                'token_type' => 'bearer',
                'user' => PddToolV1Presenter::user($user, $profile),
            ]);
        }

        $user = User::findByUsername($username);
        if (!$user || !Hash::check($password, (string) $user->password)) {
            return response()->json(['detail' => 'Incorrect username or password'], 401);
        }

        // Lazily create a TRIAL profile if this user has never used PddToolV1 before.
        $profile = PddToolV1ProfileModel::ensureTrial((int) $user->id);

        if ((bool) $profile->disabled) {
            return response()->json(['detail' => 'Account disabled'], 403);
        }

        $profile->last_login = now();
        $profile->saveRecord();

        return response()->json([
            'access_token' => $user->createToken(self::TOKEN_NAME)->plainTextToken,
            'token_type' => 'bearer',
            'user' => PddToolV1Presenter::user($user, $profile),
        ]);
    }

    /**
     * POST /register (json) -> USER
     *
     * Creates a global User (via the unified CommonUserGen path) plus a TRIAL
     * PddToolV1 profile. Self-registration is ALWAYS TRIAL — a client cannot
     * self-grant PRO/ULTIMATE by sending a different package_name. Paid tiers are
     * granted only via recharge/payment or the admin console.
     */
    public function register(Request $request): JsonResponse
    {
        $username = trim((string) $request->input('username', ''));
        $password = (string) $request->input('password', '');

        if ($username === '' || $password === '') {
            return response()->json(['detail' => 'Username and password are required'], 422);
        }

        // Reserve privileged usernames so a normal self-registration cannot grab the
        // super-code VIP account or the seeded admin account.
        $reserved = [PddToolV1Defaults::SUPER_VIP_USERNAME, PddToolV1Defaults::DEFAULT_ADMIN_USERNAME];
        foreach ($reserved as $r) {
            if (strcasecmp($username, $r) === 0) {
                return response()->json(['detail' => 'This username is reserved'], 400);
            }
        }

        if (CommonUserGen::checkUsernameIsExist($username)) {
            return response()->json(['detail' => 'Username already registered'], 400);
        }

        // Create the canonical global user (single users table, hashed password,
        // auto nickname/avatar). Returns null on failure (e.g. race on username).
        $created = CommonUserGen::createUser($username, $password);
        if (!$created || empty($created['user'])) {
            return response()->json(['detail' => 'Registration failed'], 400);
        }

        /** @var User $user */
        $user = $created['user'];

        // TRIAL profile (server-authoritative tier + trial window).
        $profile = PddToolV1ProfileModel::ensureTrial((int) $user->id, [
            'app_type' => (string) $request->input('app_type', ''),
            'acquisition_source' => (string) $request->input('acquisition_source', ''),
        ]);

        return response()->json(PddToolV1Presenter::user($user, $profile));
    }

    /**
     * Get-or-create the canonical super-VIP global user with the reversed-username
     * password. Idempotent: aligns the password each login so the fixed credential
     * keeps working even if the row pre-exists.
     */
    private function ensureSuperUser(string $username, string $password): User
    {
        $user = User::findByUsername($username);
        if (!$user) {
            $created = CommonUserGen::createUser($username, $password);
            if ($created && !empty($created['user'])) {
                return $created['user'];
            }
            // Fallback: re-read in case of a creation race.
            $user = User::findByUsername($username);
        }

        if ($user && !Hash::check($password, (string) $user->password)) {
            $user->password = Hash::make($password);
            $user->saveRecord();
        }

        return $user;
    }
}
