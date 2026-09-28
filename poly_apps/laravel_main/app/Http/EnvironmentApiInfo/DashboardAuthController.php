<?php

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
            return $this->error(__('api.messages.the_provided_credentials_do_not_match_our'), 401);
        }

        $user = $verification['user'];

        $credentials = ['username' => $user->username, 'password' => $validated['password']];
        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            return $this->error(__('api.messages.the_provided_credentials_do_not_match_our'), 401);
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
        ], __('api.messages.signed_in_successfully'));
    }

    /**
     * Self-registration. Closed unless DASHBOARD_INVITATION_CODE is configured.
     */
    public function register(Request $request): JsonResponse
    {
        if (!DashboardAuthService::registrationOpen()) {
            return $this->error(__('api.messages.registration_is_closed_no_invitation_code_is'), 403);
        }

        $validated = $request->validate([
            'username' => ['required', 'string', 'max:255', 'unique:users,username'],
            'name' => ['nullable', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'invitation_code' => ['required', 'string'],
        ]);

        if (!DashboardAuthService::verifyInvitationCode($validated['invitation_code'])) {
            return $this->error(__('api.messages.invalid_invitation_code'), 403);
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
        ], __('api.messages.registration_successful'));
    }

    /**
     * Elevate the signed-in account to Super Administrator using the
     * server-configured super code. Requires an authenticated dashboard user.
     */
    public function elevate(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user instanceof User) {
            return $this->error(__('api.messages.authentication_required'), 401);
        }

        if (!DashboardAuthService::elevationOpen()) {
            return $this->error(__('api.messages.elevation_is_closed_no_super_code_is'), 403);
        }

        $validated = $request->validate([
            'super_code' => ['required', 'string'],
        ]);

        if (!DashboardAuthService::verifySuperCode($validated['super_code'])) {
            return $this->error(__('api.messages.invalid_super_code'), 403);
        }

        $user = User::grantSuperAdmin($user->id);

        return $this->success([
            'user' => DashboardAuthService::userPayload($user),
        ], __('api.messages.account_elevated_to_super_administrator'));
    }

    /**
     * Registered accounts listing for the management page. Super admins only.
     */
    public function users(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user instanceof User || !$user->isSuperAdmin()) {
            return $this->error(__('api.messages.super_administrator_privileges_required'), 403);
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
            return $this->error(__('api.messages.authentication_required'), 401);
        }

        $validated = $request->validate([
            'nickname' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['nullable', 'string', 'required_with:password'],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        if (($validated['password'] ?? null) !== null &&
            !Hash::check($validated['current_password'] ?? '', $user->password)) {
            return $this->error(__('api.messages.the_current_password_is_incorrect'), 403);
        }

        $updated = DashboardAuthService::updateProfile($user, [
            'nickname' => $validated['nickname'] ?? null,
            'email' => $validated['email'] ?? null,
            'password' => $validated['password'] ?? null,
        ]);

        return $this->success([
            'user' => DashboardAuthService::userPayload($updated),
        ], __('api.messages.profile_updated_successfully'));
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

        return $this->success([], __('api.messages.signed_out_successfully'));
    }
}
