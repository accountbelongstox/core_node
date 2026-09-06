<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Services\Dashboard;

use App\Http\Common\CommonAvatarPublic;
use App\Models\User;
use App\Services\FileService;
use App\Support\RuntimeConfigurationStore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Centralized authentication service for the debug dashboard.
 *
 * Unifies the three identity sources the dashboard accepts, in priority
 * order: a Sanctum bearer token, the web session cookie, or the loopback
 * debug bypass (DebugAuthService). All dashboard auth endpoints resolve
 * their user through resolveRequestUser() so every surface reports the
 * same identity.
 *
 * Runtime configuration keys (RuntimeConfigurationStore):
 * - DASHBOARD_SUPER_CODE       enables super-code elevation; unset disables it.
 * - DASHBOARD_INVITATION_CODE  required for self-registration; unset closes it.
 * - DASHBOARD_LOCAL_DEBUG      loopback login bypass (see DebugAuthService).
 */
class DashboardAuthService
{
    /** Runtime store key holding the super-code required for elevation. */
    public const SUPER_CODE_KEY = 'DASHBOARD_SUPER_CODE';

    /** Runtime store key holding the invitation code required to register. */
    public const INVITATION_CODE_KEY = 'DASHBOARD_INVITATION_CODE';

    /** Role level assigned to newly registered dashboard users. */
    public const DEFAULT_ROLE_LEVEL = 1;

    /**
     * Resolve the acting user for a dashboard request.
     *
     * Priority: Sanctum bearer token -> web session user -> loopback debug
     * bypass user. Returns null when no identity source applies.
     */
    public static function resolveRequestUser(Request $request): ?User
    {
        $sanctumUser = auth('sanctum')->user();
        if ($sanctumUser instanceof User) {
            return $sanctumUser;
        }

        if (auth()->check()) {
            $sessionUser = auth()->user();
            if ($sessionUser instanceof User) {
                return $sessionUser;
            }
        }

        if (DebugAuthService::isDebugBypass($request)) {
            return DebugAuthService::resolveDebugUser();
        }

        return null;
    }

    /**
     * Whether the resolved identity grants super-admin privileges.
     */
    public static function isSuperAdmin(?User $user): bool
    {
        return $user !== null && $user->isSuperAdmin();
    }

    /**
     * Whether self-registration is open (invitation code configured).
     */
    public static function registrationOpen(): bool
    {
        return self::invitationCode() !== null;
    }

    /**
     * Whether super-code elevation is open (super code configured).
     */
    public static function elevationOpen(): bool
    {
        return self::superCode() !== null;
    }

    /**
     * Check a submitted super code against the runtime store.
     */
    public static function verifySuperCode(string $submittedCode): bool
    {
        $expected = self::superCode();

        return $expected !== null && hash_equals($expected, trim($submittedCode));
    }

    /**
     * Check a submitted invitation code against the runtime store.
     */
    public static function verifyInvitationCode(string $submittedCode): bool
    {
        $expected = self::invitationCode();

        return $expected !== null && hash_equals($expected, trim($submittedCode));
    }

    /**
     * Persist a newly registered dashboard user with default (non-admin) role.
     */
    public static function registerUser(string $username, ?string $name, string $password, ?string $email): User
    {
        $attributes = [
            'username' => $username,
            'nickname' => $name !== null && $name !== '' ? $name : $username,
            'name' => $name,
            'password' => $password,
            'rolelevel' => self::DEFAULT_ROLE_LEVEL,
            'rolename' => 'user',
        ];

        if ($email !== null && $email !== '') {
            $attributes['email'] = $email;
        }

        return User::createRecord($attributes);
    }

    /**
     * Update profile fields for the signed-in dashboard user. Only provided
     * (non-null) fields are written; the password is hashed explicitly because
     * updateById writes at the query level and bypasses the model cast.
     */
    public static function updateProfile(User $user, array $attributes): User
    {
        $updatable = [];

        if (isset($attributes['nickname']) && $attributes['nickname'] !== '') {
            $updatable['nickname'] = $attributes['nickname'];
        }
        if (isset($attributes['email']) && $attributes['email'] !== '') {
            $updatable['email'] = $attributes['email'];
        }
        if (isset($attributes['password']) && $attributes['password'] !== '') {
            $updatable['password'] = Hash::make($attributes['password']);
        }

        if ($updatable !== []) {
            User::updateById($user->id, $updatable);
        }

        return $user->refresh();
    }

    /**
     * Frontend-facing summary of a user. Never includes secrets.
     */
    public static function userPayload(?User $user): ?array
    {
        if ($user === null) {
            return null;
        }

        $user = CommonAvatarPublic::createAvatar($user, true);

        return [
            'id' => $user->id,
            'username' => $user->username,
            'nickname' => $user->nickname,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => FileService::getAvatarUrl($user->avatar),
            'rolelevel' => (int) $user->rolelevel,
            'rolename' => $user->rolename,
            'is_admin' => $user->isAdmin(),
            'is_super_admin' => $user->isSuperAdmin(),
        ];
    }

    /**
     * Combined status payload consumed by the dashboard frontend to decide
     * between the login wall and the signed-in user menu.
     */
    public static function statusPayload(Request $request): array
    {
        $debugStatus = DebugAuthService::status($request);
        $user = self::resolveRequestUser($request);

        return array_merge($debugStatus, [
            'authenticated' => $user !== null,
            'user' => self::userPayload($user),
            'registration_open' => self::registrationOpen(),
            'elevation_open' => self::elevationOpen(),
        ]);
    }

    private static function superCode(): ?string
    {
        $code = RuntimeConfigurationStore::get(self::SUPER_CODE_KEY);

        return ($code !== null && trim($code) !== '') ? trim($code) : null;
    }

    private static function invitationCode(): ?string
    {
        $code = RuntimeConfigurationStore::get(self::INVITATION_CODE_KEY);

        return ($code !== null && trim($code) !== '') ? trim($code) : null;
    }
}
