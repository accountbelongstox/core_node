<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\EnvironmentApiInfo;

use App\Http\Common\CommonAuthService;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Dashboard\DashboardAuthService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

/**
 * Dashboard authentication controller.
 *
 * Backs the API Testing Dashboard login wall, the top-right user menu and
 * the management page. State queries (status/user) always answer 200 so
 * the frontend never treats "not signed in" as a transport error.
 * Mutations (login/register/elevate) are rate limited via throttle:dashboard-auth.
 */
class DashboardAuthController extends Controller
{
    use ApiResponse;

    /**
     * Combined auth + mode status. Public: drives the login wall decision.
     */
    public function status(Request $request): JsonResponse
    {
        return $this->success(DashboardAuthService::statusPayload($request));
    }

    /**
     * Current dashboard user (null when signed out). Public for the same reason.
     */
    public function user(Request $request): JsonResponse
    {
        $payload = DashboardAuthService::statusPayload($request);

        return $this->success($payload);
    }

    /**
     * Sign in with username, email or phone against the canonical users table,
     * so super administrators can access the dashboard with their real account.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $verification = CommonAuthService::verifyCredentials(
            $validated['identifier'],
            $validated['password']
        );

        if ($verification['status'] === 'not_found' || $verification['status'] === 'invalid_password') {
            return $this->error('The provided credentials do not match our records.', 401);
        }

        $user = $verification['user'];

        $credentials = ['username' => $user->username, 'password' => $validated['password']];
        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return $this->error('The provided credentials do not match our records.', 401);
        }

        $request->session()->regenerate();

        $session = CommonAuthService::issueLoginToken($user);
        $user = $session['user'];

        return $this->success([
            'user' => DashboardAuthService::userPayload($user),
            'token' => $session['token'],
            'token_type' => $session['token_type'],
            'expiration' => $session['expiration'],
            'registration_open' => DashboardAuthService::registrationOpen(),
            'elevation_open' => DashboardAuthService::elevationOpen(),
        ], 'Signed in successfully');
    }

    /**
     * Self-registration. Closed unless DASHBOARD_INVITATION_CODE is configured.
     */
    public function register(Request $request): JsonResponse
    {
        if (!DashboardAuthService::registrationOpen()) {
            return $this->error('Registration is closed: no invitation code is configured on the server.', 403);
        }

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'name' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'invitation_code' => ['required', 'string'],
        ]);

        if (!DashboardAuthService::verifyInvitationCode($validated['invitation_code'])) {
            return $this->error('Invalid invitation code.', 403);
        }

        $user = DashboardAuthService::registerUser(
            $validated['username'],
            $validated['name'] ?? null,
            $validated['password'],
            filter_var($validated['username'], FILTER_VALIDATE_EMAIL) ? $validated['username'] : null
        );

        $request->session()->regenerate();
        $session = CommonAuthService::issueLoginToken($user);

        return $this->success([
            'user' => DashboardAuthService::userPayload($session['user']),
            'token' => $session['token'],
            'token_type' => $session['token_type'],
            'expiration' => $session['expiration'],
        ], 'Registration successful');
    }

    /**
     * Elevate the signed-in account to Super Administrator using the
     * server-configured super code. Requires an authenticated dashboard user.
     */
    public function elevate(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user instanceof User) {
            return $this->error('Authentication required.', 401);
        }

        if (!DashboardAuthService::elevationOpen()) {
            return $this->error('Elevation is closed: no super code is configured on the server.', 403);
        }

        $validated = $request->validate([
            'super_code' => ['required', 'string'],
        ]);

        if (!DashboardAuthService::verifySuperCode($validated['super_code'])) {
            return $this->error('Invalid super code.', 403);
        }

        $user = User::grantSuperAdmin($user->id);

        return $this->success([
            'user' => DashboardAuthService::userPayload($user),
        ], 'Account elevated to Super Administrator');
    }

    /**
     * Registered accounts listing for the management page. Super admins only.
     */
    public function users(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user instanceof User || !$user->isSuperAdmin()) {
            return $this->error('Super administrator privileges required.', 403);
        }

        $users = User::query()
            ->orderByDesc('rolelevel')
            ->orderBy('id')
            ->limit(200)
            ->get(['id', 'username', 'nickname', 'email', 'rolelevel', 'rolename', 'created_at']);

        return $this->success([
            'users' => $users,
            'total' => $users->count(),
        ]);
    }

    /**
     * Update the signed-in account profile (nickname, email, password).
     * Password changes require the current password; other fields are optional.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user instanceof User) {
            return $this->error('Authentication required.', 401);
        }

        $validated = $request->validate([
            'nickname' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['nullable', 'string', 'required_with:password'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        if (($validated['password'] ?? null) !== null &&
            !Hash::check($validated['current_password'] ?? '', $user->password)) {
            return $this->error('The current password is incorrect.', 403);
        }

        $updated = DashboardAuthService::updateProfile($user, [
            'nickname' => $validated['nickname'] ?? null,
            'email' => $validated['email'] ?? null,
            'password' => $validated['password'] ?? null,
        ]);

        return $this->success([
            'user' => DashboardAuthService::userPayload($updated),
        ], 'Profile updated successfully');
    }

    /**
     * Sign out: revoke the bearer token and destroy the web session.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->revokeCurrentAccessToken();

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->success([], 'Signed out successfully');
    }
}
