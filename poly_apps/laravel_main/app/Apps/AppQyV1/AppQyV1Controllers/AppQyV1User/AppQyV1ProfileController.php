<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1User;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Traits\ApiResponse;
use App\Services\AvatarService;
use App\Services\UnifiedAuthService;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\DB;

class AppQyV1ProfileController extends BaseController
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
            'learning_languages' => $user->learning_languages ?? [],
            'native_language' => $user->native_language,
            'bio' => $user->bio,
            'location' => $user->location,
            'member_type' => $user->member_type,
            'vip_points' => $user->vip_points ?? 0,
            'is_active' => $user->is_active ?? 1,
        ];

        return $this->success(['user' => $userProfile], 'Profile retrieved successfully');
    }

    /**
     * Update user profile (including avatar)
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
            'native_language' => 'nullable|string|max:10',
            'learning_languages' => 'nullable|array',
            'avatar_base64' => 'nullable|string',
            'avatar_filename' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
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

        if (isset($validated['native_language'])) {
            $updateData['native_language'] = $validated['native_language'];
        }

        if (isset($validated['learning_languages'])) {
            $updateData['learning_languages'] = $validated['learning_languages'];
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
            $user->update($updateData);

            $subAppUpdateData = [];
            $syncFields = ['nickname', 'name', 'avatar', 'email', 'phone'];

            foreach ($syncFields as $field) {
                if (isset($updateData[$field])) {
                    $subAppUpdateData[$field] = $updateData[$field];
                }
            }

            if (!empty($subAppUpdateData)) {
                $subAppUpdateData['updated_at'] = now();

                $user->getConnection()
                    ->table('users')
                    ->where('main_user_id', $user->id)
                    ->update($subAppUpdateData);
            }
        }

        $userProfile = [
            'id' => $user->id,
            'username' => $user->username,
            'nickname' => $user->nickname,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'avatar_url' => $this->getAvatarUrl($user->avatar),
            'learning_languages' => $user->learning_languages ?? [],
            'native_language' => $user->native_language,
            'bio' => $user->bio,
            'location' => $user->location,
            'member_type' => $user->member_type,
            'vip_points' => $user->vip_points ?? 0,
            'is_active' => $user->is_active ?? 1,
        ];

        return $this->success(['user' => $userProfile], 'Profile updated successfully');
    }

    /**
     * Save avatar from base64 string
     */
    private function saveAvatarFromBase64(string $base64Data, int $userId, ?string $filename = null): ?string
    {
        return AvatarService::saveBase64Avatar($base64Data, $userId, \App\Constants\AppKeys::APPQYV1, $filename);
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
