<?php

namespace App\Services;

use App\Constants\AppKeys;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class AvatarService
{
    /**
     * Hard cap on the size of a decoded uploaded avatar (raw bytes, before
     * re-encode). Uploads larger than this are rejected outright. This is the
     * shared contract value the frontend role must respect.
     */
    public const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

    /**
     * Maximum stored avatar edge length in pixels. The image is scaled down
     * (aspect preserved) so the longest side is at most this value.
     */
    public const MAX_DIMENSION = 512;

    /**
     * Output JPEG quality (0-100) used when re-encoding uploaded avatars.
     */
    public const OUTPUT_JPEG_QUALITY = 82;

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
     * Generate avatar and save to file system.
     *
     * Single generation pipeline: DiceBear HTTP first, then the local Laravolt
     * generator as fallback so avatar creation never hard-depends on an external
     * service.
     *
     * @param string $seed Seed for deterministic generation (username, email, etc.)
     * @param int $userId User ID for filename
     * @param string $appKey App key for subdirectory (e.g., AppKeys::APPQYV1)
     * @return string|null Relative path to avatar file
     */
    public static function generateAndSave(string $seed, int $userId, ?string $appKey = null): ?string
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

        $imageData = null;
        $path = null;
        $fullPath = null;

        try {
            $response = Http::timeout(10)->get($url);

            if ($response->successful()) {
                $imageData = $response->body();
            } else {
                Log::error('[AvatarService] DiceBear avatar request failed, falling back to local generator', [
                    'status' => $response->status(),
                    'seed' => $seed,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('[AvatarService] Exception during DiceBear avatar generation, falling back to local generator', [
                'error' => $e->getMessage(),
                'seed' => $seed,
            ]);
        }

        $filename = 'avatar_' . $userId . '_' . time() . '.png';

        $avatarsDir = PathMapper::getLaravelAvatarsDir();
        $appDir = $avatarsDir . '/' . $appKey;

        if (!file_exists($appDir)) {
            mkdir($appDir, 0755, true);
        }

        $fullPath = $appDir . '/' . $filename;

        if ($imageData === null) {
            if (!self::generateLocalAvatar($seed, $fullPath)) {
                return null;
            }
        } else {
            $saved = file_put_contents($fullPath, $imageData);

            if ($saved === false) {
                Log::error('[AvatarService] Failed to save avatar file', [
                    'path' => $fullPath,
                ]);
                return null;
            }
        }

        $path = 'avatars/' . $appKey . '/' . $filename;

        Log::info('[AvatarService] Avatar generated and saved', [
            'relative_path' => $path,
            'full_path' => $fullPath,
        ]);

        return $path;
    }

    /**
     * Local avatar generation fallback (Laravolt initials avatar). Used when the
     * external DiceBear HTTP API is unreachable so registration/login never
     * depends on outbound connectivity.
     *
     * @param string $seed Seed text (username, email, etc.)
     * @param string $fullPath Absolute output path for the PNG
     * @return bool Success
     */
    private static function generateLocalAvatar(string $seed, string $fullPath): bool
    {
        if (!class_exists(\Laravolt\Avatar\Avatar::class)) {
            Log::error('[AvatarService] Laravolt avatar generator not installed, no local fallback available', [
                'seed' => $seed,
            ]);
            return false;
        }

        try {
            $avatarCreator = new \Laravolt\Avatar\Avatar();
            $avatarCreator->create($seed);
            $avatarCreator->save($fullPath, 80);

            if (!file_exists($fullPath)) {
                Log::error('[AvatarService] Local avatar generator produced no file', [
                    'path' => $fullPath,
                ]);
                return false;
            }

            Log::info('[AvatarService] Avatar generated locally (fallback)', [
                'seed' => $seed,
                'full_path' => $fullPath,
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('[AvatarService] Exception during local avatar generation', [
                'error' => $e->getMessage(),
                'seed' => $seed,
            ]);
            return false;
        }
    }

    /**
     * Idempotent read-time repair for a user's avatar.
     *
     * Only acts when the avatar is actually broken, so it does not slow down
     * normal requests. Regenerates through the single pipeline (DiceBear HTTP
     * with local Laravolt fallback), persists the new path, and returns the
     * (possibly unchanged) user.
     *
     * Repaired when:
     *  - avatar is empty / "null",
     *  - the referenced local file is missing,
     *  - the on-disk file exceeds self::MAX_UPLOAD_BYTES
     *    (legacy oversized avatars, e.g. the 27 MB case).
     *
     * Remote URLs (http/https) are left untouched.
     *
     * @param User|null $user
     * @return mixed The same user instance
     */
    public static function backfillAvatar($user)
    {
        $avatarDir = null;
        $avatar = null;
        $needsRepair = false;
        $relative = null;
        $localPath = null;
        $seed = null;
        $path = null;

        if (!$user) {
            return $user;
        }

        $avatarDir = PathMapper::getLaravelAvatarsDir();
        $avatar = $user->avatar;

        if (!$avatar || $avatar === '' || $avatar === 'null') {
            $needsRepair = true;
        } else if (stripos($avatar, 'http://') === 0 || stripos($avatar, 'https://') === 0) {
            // External URL (e.g. gravatar fallback) - nothing local to check.
            $needsRepair = false;
        } else {
            // Resolve the on-disk location strictly via the canonical
            // PathMapper-backed avatars dir helper. Stored values are either
            // "avatars/<app>/<file>" (strip the "avatars/" prefix) or a
            // bare/root "/avatars/<id>.png" (legacy default layout).
            $relative = ltrim($avatar, '/');
            if (strpos($relative, 'avatars/') === 0) {
                $relative = substr($relative, strlen('avatars/'));
            }
            $localPath = PathMapper::getLaravelAvatarsDir($relative);

            if (!file_exists($localPath)) {
                $needsRepair = true;
            } else if (filesize($localPath) > self::MAX_UPLOAD_BYTES) {
                $needsRepair = true;
            }
        }

        if (!$needsRepair) {
            return $user;
        }

        if (!file_exists($avatarDir)) {
            mkdir($avatarDir, 0755, true);
        }

        // Drop the broken oversized file so the legacy 27 MB payloads do not
        // linger once the avatar moves to the standard per-app layout.
        if ($localPath !== null && file_exists($localPath) && filesize($localPath) > self::MAX_UPLOAD_BYTES) {
            self::deleteAvatar($avatar);
        }

        $seed = $user->username;
        if (!$seed) {
            $seed = $user->email;
        }
        if (!$seed) {
            $seed = 'user' . $user->id;
        }

        $path = self::generateAndSave($seed, (int) $user->id);

        if ($path === null) {
            Log::error('[AvatarService] Backfill failed, avatar left unchanged', [
                'user_id' => $user->id,
            ]);
            return $user;
        }

        $user->avatar = $path;
        $user->saveRecord();

        Log::info('[AvatarService] Avatar backfilled', [
            'user_id' => $user->id,
            'avatar_path' => $path,
        ]);

        return $user;
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
    public static function saveBase64Avatar(string $base64Data, int $userId, ?string $appName = null, ?string $filename = null): ?string
    {
        $allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
        $extension = 'png';
        $cleanBase64 = null;
        $matchResult = null;
        $imageData = null;
        $decodedSize = 0;
        $finalFilename = null;
        $appKey = null;
        $avatarsDir = null;
        $appDir = null;
        $fullPath = null;
        $sourceImage = null;
        $srcWidth = 0;
        $srcHeight = 0;
        $scale = 1.0;
        $dstWidth = 0;
        $dstHeight = 0;
        $destImage = null;
        $encoded = false;
        $saved = false;
        $relativePath = null;

        if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $matchResult)) {
            $extension = strtolower($matchResult[1]);
            $cleanBase64 = substr($base64Data, strpos($base64Data, ',') + 1);
        } else {
            $cleanBase64 = $base64Data;
        }

        if (!in_array($extension, $allowedExtensions, true)) {
            Log::error('[AvatarService] Rejected avatar: unsupported extension', [
                'extension' => $extension,
                'user_id' => $userId,
            ]);
            return null;
        }

        $imageData = base64_decode($cleanBase64, true);

        if ($imageData === false || $imageData === '') {
            Log::error('[AvatarService] Failed to decode base64 avatar');
            return null;
        }

        $decodedSize = strlen($imageData);
        if ($decodedSize > self::MAX_UPLOAD_BYTES) {
            Log::error('[AvatarService] Rejected avatar: exceeds size cap', [
                'decoded_bytes' => $decodedSize,
                'max_bytes' => self::MAX_UPLOAD_BYTES,
                'user_id' => $userId,
            ]);
            return null;
        }

        // Decode into a GD resource so we can downscale and re-encode. The
        // raw uploaded bytes are NEVER written to disk verbatim (that was the
        // 27 MB bug). Stored output is always a recompressed JPEG.
        $sourceImage = @imagecreatefromstring($imageData);
        if ($sourceImage === false) {
            Log::error('[AvatarService] Rejected avatar: not a decodable image', [
                'user_id' => $userId,
            ]);
            return null;
        }

        $srcWidth = imagesx($sourceImage);
        $srcHeight = imagesy($sourceImage);

        if ($srcWidth < 1 || $srcHeight < 1) {
            imagedestroy($sourceImage);
            Log::error('[AvatarService] Rejected avatar: invalid dimensions', [
                'user_id' => $userId,
            ]);
            return null;
        }

        $scale = 1.0;
        if ($srcWidth > self::MAX_DIMENSION || $srcHeight > self::MAX_DIMENSION) {
            $scale = self::MAX_DIMENSION / max($srcWidth, $srcHeight);
        }

        $dstWidth = max(1, (int) round($srcWidth * $scale));
        $dstHeight = max(1, (int) round($srcHeight * $scale));

        $destImage = imagecreatetruecolor($dstWidth, $dstHeight);
        // Flatten any alpha onto white so JPEG output looks correct.
        imagefilledrectangle(
            $destImage,
            0,
            0,
            $dstWidth,
            $dstHeight,
            imagecolorallocate($destImage, 255, 255, 255)
        );
        imagecopyresampled(
            $destImage,
            $sourceImage,
            0,
            0,
            0,
            0,
            $dstWidth,
            $dstHeight,
            $srcWidth,
            $srcHeight
        );
        imagedestroy($sourceImage);

        // Always store as a compressed .jpg regardless of source format so the
        // served file is small (target well under ~150 KB at 512px max edge).
        if ($filename) {
            $finalFilename = preg_replace('/\.[^.]+$/', '', $filename) . '.jpg';
        } else {
            $finalFilename = 'avatar_' . $userId . '_' . time() . '.jpg';
        }

        $appKey = $appName ?? AppKeys::APPQYV1;

        $avatarsDir = PathMapper::getLaravelAvatarsDir();
        $appDir = $avatarsDir . '/' . $appKey;

        if (!file_exists($appDir)) {
            mkdir($appDir, 0755, true);
        }

        $fullPath = $appDir . '/' . $finalFilename;
        $encoded = imagejpeg($destImage, $fullPath, self::OUTPUT_JPEG_QUALITY);
        imagedestroy($destImage);

        if ($encoded === false || !file_exists($fullPath)) {
            Log::error('[AvatarService] Failed to save base64 avatar', [
                'path' => $fullPath,
            ]);
            return null;
        }

        $relativePath = 'avatars/' . $appKey . '/' . $finalFilename;

        Log::info('[AvatarService] Base64 avatar saved', [
            'relative_path' => $relativePath,
            'source_bytes' => $decodedSize,
            'stored_bytes' => filesize($fullPath),
            'dimensions' => $dstWidth . 'x' . $dstHeight,
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
        $normalized = null;
        $fullPath = null;
        $deleted = false;

        // Resolve strictly through the canonical PathMapper-backed helper.
        // No ad-hoc dirname()/string concatenation of root directories
        // (PATH_CONVERSION_SPECIFICATION §6).
        $normalized = ltrim($relativePath, '/');

        // Layout A: "avatars/<app>/<file>" -> strip the "avatars/" prefix and
        // resolve the remainder under the mapped avatars directory.
        if (strpos($normalized, 'avatars/') === 0) {
            $fullPath = PathMapper::getLaravelAvatarsDir(substr($normalized, strlen('avatars/')));
        } else {
            // Layout B: bare "<file>" (legacy root-level default avatars).
            $fullPath = PathMapper::getLaravelAvatarsDir($normalized);
        }

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
