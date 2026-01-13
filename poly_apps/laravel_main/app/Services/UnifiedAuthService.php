<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Atrox\Haikunator;

class UnifiedAuthService
{
    public static function register(array $credentials, ?string $subAppConnection = null): array
    {
        DB::beginTransaction();
        
        try {
            $existingUser = User::where(function($query) use ($credentials) {
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
            
            $mainUserData = [
                'username' => $credentials['username'],
                'email' => $credentials['email'],
                'phone' => $credentials['phone'] ?? null,
                'name' => $credentials['name'] ?? null,
                'password' => Hash::make($credentials['password']),
                'created_at' => now(),
                'updated_at' => now(),
            ];
            
            $mainUser = User::create($mainUserData);
            
            $result = [
                'success' => true,
                'user' => $mainUser,
                'sub_app_user' => null,
            ];
            
            if ($subAppConnection) {
                $subAppUserData = [
                    'main_user_id' => $mainUser->id,
                    'username' => $credentials['username'],
                    'email' => $credentials['email'],
                    'phone' => $credentials['phone'] ?? null,
                    'name' => $credentials['name'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                if (isset($credentials['sub_app_data'])) {
                    $subAppUserData = array_merge($subAppUserData, $credentials['sub_app_data']);
                }

                if (!isset($subAppUserData['nickname']) || empty($subAppUserData['nickname'])) {
                    $subAppUserData['nickname'] = Haikunator::haikunate([
                        'tokenLength' => 4,
                        'delimiter' => '-'
                    ]);
                }
                
                // Use model connection for query builder (Laravel best practice)
                $userModel = new User();
                $userModel->setConnection($subAppConnection);
                $dbConnection = $userModel->getConnection();
                $subAppUserId = $dbConnection->table('users')->insertGetId($subAppUserData);
                $result['sub_app_user'] = $dbConnection->table('users')->find($subAppUserId);
            }
            
            DB::commit();
            return $result;
            
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[UnifiedAuth] Registration exception: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
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
            
            $result = [
                'success' => true,
                'user' => $mainUser,
                'sub_app_user' => null,
            ];
            
            if ($subAppConnection) {
                // Use model connection for query builder (Laravel best practice)
                $userModel = new User();
                $userModel->setConnection($subAppConnection);
                $dbConnection = $userModel->getConnection();
                
                $subAppUser = $dbConnection
                    ->table('users')
                    ->where('main_user_id', $mainUser->id)
                    ->first();
                
                if (!$subAppUser) {
                    $subAppUserData = [
                        'main_user_id' => $mainUser->id,
                        'username' => $mainUser->username,
                        'email' => $mainUser->email,
                        'phone' => $mainUser->phone,
                        'name' => $mainUser->name,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    
                    $subAppUserId = $dbConnection->table('users')->insertGetId($subAppUserData);
                    $subAppUser = $dbConnection->table('users')->find($subAppUserId);
                }
                
                $result['sub_app_user'] = $subAppUser;
            }
            
            return $result;
            
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
    
    public static function updateSubAppUserData(int $mainUserId, string $subAppConnection, array $data): array
    {
        try {
            // Use model connection for query builder (Laravel best practice)
            $userModel = new User();
            $userModel->setConnection($subAppConnection);
            $dbConnection = $userModel->getConnection();
            
            $subAppUser = $dbConnection
                ->table('users')
                ->where('main_user_id', $mainUserId)
                ->first();

            if (!$subAppUser) {
                return [
                    'success' => false,
                    'error' => 'Sub-app user not found',
                ];
            }

            unset($data['password']);
            unset($data['main_user_id']);

            $data['updated_at'] = now();

            $dbConnection
                ->table('users')
                ->where('main_user_id', $mainUserId)
                ->update($data);

            return [
                'success' => true,
                'message' => 'Sub-app user data updated successfully',
            ];

        } catch (\Exception $e) {
            Log::error('[UnifiedAuth] Update sub-app user failed: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Update user profile in both main and sub-app tables
     *
     * @param int $userId Main user ID
     * @param string|null $subAppConnection Sub-app database connection name
     * @param array $data Data to update
     * @return array
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
                User::where('id', $userId)->update($mainUpdateData);
            }

            if ($subAppConnection) {
                $subAppUpdateData = [];
                $syncFields = ['nickname', 'name', 'avatar', 'email', 'phone'];

                foreach ($syncFields as $field) {
                    if (isset($data[$field])) {
                        $subAppUpdateData[$field] = $data[$field];
                    }
                }

                if (!empty($subAppUpdateData)) {
                    $subAppUpdateData['updated_at'] = now();

                    // Use model connection for query builder (Laravel best practice)
                    $userModel = new User();
                    $userModel->setConnection($subAppConnection);
                    $dbConnection = $userModel->getConnection();

                    $subAppUser = $dbConnection
                        ->table('users')
                        ->where('main_user_id', $userId)
                        ->first();

                    if (!$subAppUser) {
                        $subAppUserData = [
                            'main_user_id' => $userId,
                            'username' => User::find($userId)->username,
                            'created_at' => now(),
                        ];
                        $subAppUserData = array_merge($subAppUserData, $subAppUpdateData);

                        $dbConnection->table('users')->insert($subAppUserData);
                    } else {
                        $dbConnection
                            ->table('users')
                            ->where('main_user_id', $userId)
                            ->update($subAppUpdateData);
                    }
                }
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
