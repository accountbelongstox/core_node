<?php

namespace App\Services;

use App\Constants\AppKeys;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class AvatarService
{
    private const DICEBEAR_API_BASE = 'https://api.dicebear.com/9.x';

    private const AVATAR_STYLES = [
        'lorelei',
        'avataaars',
        'bottts',
        'pixel-art',
        'adventurer',
        'big-smile',
        'personas',
        'fun-emoji',
    ];

    /**
     * Generate avatar using DiceBear API and save to file system
     *
     * @param string $seed Seed for deterministic generation (username, email, etc.)
     * @param int $userId User ID for filename
     * @param string $appKey App key for subdirectory (e.g., AppKeys::APPQYV1)
     * @return string|null Relative path to avatar file
     */
    public static function generateAndSave(string $seed, int $userId, string $appKey = null): ?string
    {
        if ($appKey === null) {
            $appKey = \App\Constants\AppKeys::APPQYV1;
        }
        $style = self::AVATAR_STYLES[array_rand(self::AVATAR_STYLES)];
        $url = self::DICEBEAR_API_BASE . "/{$style}/png?seed=" . urlencode($seed) . "&size=256&backgroundColor=b6e3f4,c0aede,d1d4f9";

        Log::info('[AvatarService] Generating avatar', [
            'seed' => $seed,
            'style' => $style,
            'user_id' => $userId,
        ]);

        $response = null;
        $imageData = null;
        $path = null;
        $fullPath = null;

        try {
            $response = Http::timeout(10)->get($url);

            if (!$response->successful()) {
                Log::error('[AvatarService] Failed to generate avatar', [
                    'status' => $response->status(),
                    'seed' => $seed,
                ]);
                return null;
            }

            $imageData = $response->body();

            $filename = 'avatar_' . $userId . '_' . time() . '.png';

            $avatarsDir = PathMapper::getLaravelAvatarsDir();
            $appDir = $avatarsDir . '/' . $appKey;

            if (!file_exists($appDir)) {
                mkdir($appDir, 0755, true);
            }

            $fullPath = $appDir . '/' . $filename;
            $saved = file_put_contents($fullPath, $imageData);

            if ($saved === false) {
                Log::error('[AvatarService] Failed to save avatar file', [
                    'path' => $fullPath,
                ]);
                return null;
            }

            $path = 'avatars/' . $appKey . '/' . $filename;

            Log::info('[AvatarService] Avatar generated and saved', [
                'relative_path' => $path,
                'full_path' => $fullPath,
                'size' => strlen($imageData),
            ]);

            return $path;
        } catch (\Exception $e) {
            Log::error('[AvatarService] Exception during avatar generation', [
                'error' => $e->getMessage(),
                'seed' => $seed,
            ]);
            return null;
        }
    }

    /**
     * Save base64 avatar to file system
     *
     * @param string $base64Data Base64 encoded image data (with or without data URI prefix)
     * @param int $userId User ID for filename
     * @param string $appName App name for subdirectory
     * @param string|null $filename Optional custom filename
     * @return string|null Relative path to avatar file
     */
    public static function saveBase64Avatar(string $base64Data, int $userId, string $appName = null, ?string $filename = null): ?string
    {
        $extension = 'png';
        $cleanBase64 = null;
        $matchResult = null;

        if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $matchResult)) {
            $extension = $matchResult[1];
            $cleanBase64 = substr($base64Data, strpos($base64Data, ',') + 1);
        } else {
            $cleanBase64 = $base64Data;
        }

        $imageData = base64_decode($cleanBase64);

        if ($imageData === false) {
            Log::error('[AvatarService] Failed to decode base64 avatar');
            return null;
        }

        $finalFilename = null;
        if ($filename) {
            $finalFilename = $filename;
        }

        if (!$finalFilename) {
            $finalFilename = 'avatar_' . $userId . '_' . time() . '.' . $extension;
        }

        if ($appKey === null) {
            $appKey = AppKeys::APPQYV1;
        }
        
        $avatarsDir = PathMapper::getLaravelAvatarsDir();
        $appDir = $avatarsDir . '/' . $appKey;

        if (!file_exists($appDir)) {
            mkdir($appDir, 0755, true);
        }

        $fullPath = $appDir . '/' . $finalFilename;
        $saved = file_put_contents($fullPath, $imageData);

        if ($saved === false) {
            Log::error('[AvatarService] Failed to save base64 avatar', [
                'path' => $fullPath,
            ]);
            return null;
        }

        $relativePath = 'avatars/' . $appKey . '/' . $finalFilename;

        Log::info('[AvatarService] Base64 avatar saved', [
            'relative_path' => $relativePath,
            'size' => strlen($imageData),
        ]);

        return $relativePath;
    }

    /**
     * Delete avatar file
     *
     * @param string $relativePath Relative path to avatar (e.g., 'avatars/appqyv1/avatar_1_123.png')
     * @return bool Success
     */
    public static function deleteAvatar(string $relativePath): bool
    {
        $avatarsDir = PathMapper::getLaravelAvatarsDir();
        $fullPath = dirname($avatarsDir) . '/' . $relativePath;

        if (file_exists($fullPath)) {
            $deleted = unlink($fullPath);
            Log::info('[AvatarService] Avatar deleted', [
                'path' => $relativePath,
                'success' => $deleted,
            ]);
            return $deleted;
        }

        return false;
    }

    /**
     * Get full URL for avatar
     *
     * @param string|null $relativePath Relative path to avatar
     * @return string|null Full URL or null
     */
    public static function getAvatarUrl(?string $relativePath): ?string
    {
        return FileService::getAvatarUrl($relativePath);
    }

    /**
     * Generate nickname from username/email
     *
     * @param string $username Username or email
     * @return string Generated nickname
     */
    public static function generateNickname(string $username): string
    {
        if (filter_var($username, FILTER_VALIDATE_EMAIL)) {
            $localPart = explode('@', $username)[0];
            $clean = preg_replace('/[^a-zA-Z0-9]/', '', $localPart);
            return ucfirst($clean);
        }

        $clean = preg_replace('/[^a-zA-Z0-9]/', '', $username);
        return ucfirst($clean);
    }
}
