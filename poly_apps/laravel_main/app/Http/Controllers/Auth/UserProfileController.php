<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Http\Controllers\Auth\AvatarPublic;
use App\Services\AvatarService;
use App\Constants\AppKeys;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Hash;

/**
 * User Profile Controller
 * Common user profile management endpoint for all apps
 * Uses standardized ApiResponse trait
 */
class UserProfileController extends Controller
{
    use ApiResponse;

    /**
     * Get current user profile
     */
    public function getProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $userProfile = [
            'id' => $user->id,
            'username' => $user->username,
            'nickname' => $user->nickname,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'avatar_url' => $this->getAvatarUrl($user->avatar),
            'bio' => $user->bio,
            'location' => $user->location,
            'rolelevel' => (int) ($user->rolelevel ?? 0),
            'role_level' => (int) ($user->rolelevel ?? 0),
            'rolename' => $user->rolename,
            'role_name' => $user->rolename,
            'is_active' => $user->is_active ?? 1,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];

        return $this->success(['user' => $userProfile], 'Profile retrieved successfully');
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'nickname' => 'nullable|string|max:255',
            'name' => 'nullable|string|max:255',
            'bio' => 'nullable|string|max:500',
            'location' => 'nullable|string|max:255',
            'avatar_base64' => 'nullable|string',
            'avatar_filename' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray(), 'Validation failed');
        }

        $validated = $validator->validated();
        $updateData = [];
        $oldAvatar = $user->avatar;

        if (isset($validated['nickname'])) {
            $updateData['nickname'] = $validated['nickname'];
        }

        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }

        if (isset($validated['bio'])) {
            $updateData['bio'] = $validated['bio'];
        }

        if (isset($validated['location'])) {
            $updateData['location'] = $validated['location'];
        }

        if (isset($validated['avatar_base64']) && $validated['avatar_base64']) {
            $filename = null;
            if (isset($validated['avatar_filename'])) {
                $filename = $validated['avatar_filename'];
            }

            $avatarPath = $this->saveAvatarFromBase64(
                $validated['avatar_base64'],
                $user->id,
                $filename
            );

            if ($avatarPath) {
                $updateData['avatar'] = $avatarPath;

                if ($oldAvatar && $oldAvatar !== 'avatars/1.png') {
                    $this->deleteOldAvatar($oldAvatar);
                }
            }
        }

        if (!empty($updateData)) {
            $user->updateRecord($updateData);
        }

        $userProfile = [
            'id' => $user->id,
            'username' => $user->username,
            'nickname' => $user->nickname,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'avatar_url' => $this->getAvatarUrl($user->avatar),
            'bio' => $user->bio,
            'location' => $user->location,
            'rolelevel' => (int) ($user->rolelevel ?? 0),
            'role_level' => (int) ($user->rolelevel ?? 0),
            'rolename' => $user->rolename,
            'role_name' => $user->rolename,
            'is_active' => $user->is_active ?? 1,
        ];

        return $this->success(['user' => $userProfile], 'Profile updated successfully');
    }

    /**
     * Change user password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string',
            'confirm_password' => 'required|string|same:new_password',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray(), 'Validation failed');
        }

        if (!Hash::check($request->current_password, $user->password)) {
            return $this->validationError(
                ['current_password' => ['Current password is incorrect.']],
                'Current password is incorrect'
            );
        }

        $user->password = Hash::make($request->new_password);
        $user->saveRecord();

        return $this->success([], 'Password changed successfully');
    }

    /**
     * Get user preferences
     */
    public function getPreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $defaultPreferences = [
            'theme' => 'dark',
            'language' => 'en',
            'favorites' => [],
            'recentTools' => [],
        ];

        $userPreferences = $user->preferences ?? [];
        if (!is_array($userPreferences)) {
            $userPreferences = [];
        }

        $preferences = array_merge($defaultPreferences, $userPreferences);

        return $this->success($preferences, 'Preferences retrieved successfully');
    }

    /**
     * Update user preferences
     */
    public function updatePreferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return $this->error('Unauthorized', 401);
        }

        $validator = Validator::make($request->all(), [
            'theme' => 'nullable|string|in:light,dark',
            'language' => 'nullable|string|max:10',
            'favorites' => 'nullable|array',
            'recentTools' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->validationError($validator->errors()->toArray(), 'Validation failed');
        }

        $validated = $validator->validated();

        $defaultPreferences = [
            'theme' => 'dark',
            'language' => 'en',
            'favorites' => [],
            'recentTools' => [],
        ];

        $currentPreferences = $user->preferences ?? [];
        if (!is_array($currentPreferences)) {
            $currentPreferences = [];
        }

        $updatedPreferences = array_merge($defaultPreferences, $currentPreferences, $validated);

        $user->preferences = $updatedPreferences;
        $user->saveRecord();

        return $this->success($updatedPreferences, 'Preferences updated successfully');
    }

    /**
     * Save avatar from base64 string
     */
    private function saveAvatarFromBase64(string $base64Data, int $userId, ?string $filename = null): ?string
    {
        return AvatarService::saveBase64Avatar($base64Data, $userId, AppKeys::APPQYV1, $filename);
    }

    /**
     * Delete old avatar file
     */
    private function deleteOldAvatar(string $avatarPath): void
    {
        AvatarService::deleteAvatar($avatarPath);
    }

    /**
     * Get full avatar URL
     */
    private function getAvatarUrl(?string $avatar): ?string
    {
        return AvatarService::getAvatarUrl($avatar);
    }
}
