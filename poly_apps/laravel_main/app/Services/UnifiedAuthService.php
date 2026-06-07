<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Atrox\Haikunator;

/**
 * Unified authentication against the SINGLE canonical `users` table (main /
 * default connection).
 *
 * Identity is stored ONCE. There are no per-sub-app duplicate `users` tables
 * and no cross-database dual-write (that model produced non-ACID multi-file
 * transactions and the registration FK failure). App-specific user fields
 * belong in per-app extension tables keyed by main_user_id (see *_user_profile
 * migrations / models), NOT in a duplicated users row.
 *
 * The `$subAppConnection` parameters are retained for backward compatibility
 * with existing callers but are intentionally ignored. `sub_app_user` in the
 * result is the canonical main user (same identity) so legacy callers that
 * read it keep working.
 */
class UnifiedAuthService
{
    public static function register(array $credentials, ?string $subAppConnection = null): array
    {
        DB::beginTransaction();

        try {
            $existingUser = User::where(function ($query) use ($credentials) {
                $query->where('username', $credentials['username']);
                if (!empty($credentials['email'])) {
                    $query->orWhere('email', $credentials['email']);
                }
            })->first();

            if ($existingUser) {
                DB::rollBack();
                return [
                    'success' => false,
                    'error' => 'User already exists',
                    'user' => null,
                ];
            }

            $subAppData = $credentials['sub_app_data'] ?? [];
            $nickname = $subAppData['nickname'] ?? null;
            if (empty($nickname)) {
                $nickname = Haikunator::haikunate(['tokenLength' => 4, 'delimiter' => '-']);
            }

            $mainUserData = [
                'username' => $credentials['username'],
                'email' => $credentials['email'],
                'phone' => $credentials['phone'] ?? null,
                'name' => $credentials['name'] ?? null,
                'nickname' => $nickname,
                'password' => Hash::make($credentials['password']),
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $mainUser = User::create($mainUserData);

            DB::commit();

            // sub_app_user == the canonical user (single identity, no duplicate).
            return [
                'success' => true,
                'user' => $mainUser,
                'sub_app_user' => $mainUser,
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[UnifiedAuth] Registration exception: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'user' => null,
            ];
        }
    }

    public static function login(string $username, string $password, ?string $subAppConnection = null): array
    {
        try {
            $mainUser = User::where('username', $username)
                ->orWhere('email', $username)
                ->first();

            if (!$mainUser) {
                return [
                    'success' => false,
                    'error' => 'User not found',
                    'user' => null,
                ];
            }

            if (!Hash::check($password, $mainUser->password)) {
                return [
                    'success' => false,
                    'error' => 'Invalid credentials',
                    'user' => null,
                ];
            }

            return [
                'success' => true,
                'user' => $mainUser,
                'sub_app_user' => $mainUser,
            ];
        } catch (\Exception $e) {
            Log::error('[UnifiedAuth] Login failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'user' => null,
            ];
        }
    }

    public static function resetPassword(string $username, string $newPassword, ?string $subAppConnection = null): array
    {
        DB::beginTransaction();

        try {
            $mainUser = User::where('username', $username)
                ->orWhere('email', $username)
                ->first();

            if (!$mainUser) {
                DB::rollBack();
                return [
                    'success' => false,
                    'error' => 'User not found',
                ];
            }

            $mainUser->password = Hash::make($newPassword);
            $mainUser->updated_at = now();
            $mainUser->save();

            DB::commit();

            return [
                'success' => true,
                'message' => 'Password reset successfully',
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[UnifiedAuth] Password reset failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Backward-compatible: updates the canonical user row by id.
     * (Formerly wrote to a per-sub-app duplicate users table.)
     */
    public static function updateSubAppUserData(int $mainUserId, string $subAppConnection, array $data): array
    {
        try {
            $user = User::find($mainUserId);
            if (!$user) {
                return [
                    'success' => false,
                    'error' => 'User not found',
                ];
            }

            unset($data['password'], $data['main_user_id']);

            $fillable = (new User())->getFillable();
            $update = array_intersect_key($data, array_flip($fillable));

            if (!empty($update)) {
                $update['updated_at'] = now();
                User::where('id', $mainUserId)->update($update);
            }

            return [
                'success' => true,
                'message' => 'User data updated successfully',
            ];
        } catch (\Exception $e) {
            Log::error('[UnifiedAuth] Update user data failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update the canonical user profile. App-specific fields belong in per-app
     * extension tables (handled by the owning app), not duplicated here.
     */
    public static function updateUserProfile(int $userId, ?string $subAppConnection, array $data): array
    {
        DB::beginTransaction();

        try {
            $mainUpdateData = [];
            $mainFields = ['nickname', 'name', 'email', 'phone', 'avatar', 'bio', 'location', 'native_language', 'learning_languages'];

            foreach ($mainFields as $field) {
                if (isset($data[$field])) {
                    $mainUpdateData[$field] = $data[$field];
                }
            }

            if (!empty($mainUpdateData)) {
                $mainUpdateData['updated_at'] = now();
                User::where('id', $userId)->update($mainUpdateData);
            }

            DB::commit();

            return [
                'success' => true,
                'message' => 'User profile updated successfully',
            ];
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[UnifiedAuth] Update user profile failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
