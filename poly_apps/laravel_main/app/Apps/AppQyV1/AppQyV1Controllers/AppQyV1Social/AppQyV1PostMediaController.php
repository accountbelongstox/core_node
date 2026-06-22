<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Routing\Controller as BaseController;
use App\Models\User;
use App\Services\AvatarService;
use App\Traits\ApiResponse;
use App\Providers\PathMapper;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostImageModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PostLikeModel;

/**
 * Social Center post media uploads (Social Center expansion §POSTS images/video).
 *
 * Images: up to 9 per call, each GD-decoded, downscaled (max 1600px edge),
 * re-encoded as JPEG (raw bytes never written verbatim), stored at
 * getLaravelStaticDir('app_qy_v1/post_images/{post_id}/{seq}.jpg'). Served at
 * the root-relative '/static/app_qy_v1/post_images/{post_id}/{seq}.jpg'.
 *
 * Video: single file <=200MB, stored verbatim (NO transcoding) at
 * getLaravelStaticDir('app_qy_v1/post_videos/{user_id}/{post_id}.mp4'), served
 * at '/static/app_qy_v1/post_videos/{user_id}/{post_id}.mp4'.
 *
 * Every path resolves through PathMapper — never raw storage_path().
 */
class AppQyV1PostMediaController extends BaseController
{
    use ApiResponse;

    private const MAX_IMAGES = 9;
    private const IMAGE_MAX_DIMENSION = 1600;
    private const IMAGE_JPEG_QUALITY = 85;

    private const POST_IMAGES_SUBDIR = 'app_qy_v1/post_images';
    private const POST_VIDEOS_SUBDIR = 'app_qy_v1/post_videos';
    private const POST_IMAGES_URL_PREFIX = '/static/app_qy_v1/post_images';
    private const POST_VIDEOS_URL_PREFIX = '/static/app_qy_v1/post_videos';

    /**
     * POST /social/posts/{id}/images  (multipart images[] up to 9)
     * Each image is downscaled + JPEG re-encoded. Sequence continues after any
     * existing images on the post. Returns the refreshed Post.
     */
    public function uploadImages(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $post = null;
        $files = [];
        $startSeq = 0;
        $storageDir = '';
        $seq = 0;
        $stored = 0;
        $file = null;
        $rawBytes = null;
        $jpegBytes = null;
        $relativeUrl = '';
        $fullPath = '';

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $post = AppQyV1PostModel::query()->find($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if ((int) $post->user_id !== $myId) {
            return $this->forbidden('Only the author can add images to this post');
        }

        $validator = Validator::make($request->all(), [
            'images' => ['required', 'array', 'min:1', 'max:' . self::MAX_IMAGES],
            'images.*' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:10240'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $files = $request->file('images');
        if (!is_array($files) || empty($files)) {
            return $this->error('No images provided', 422);
        }

        // Cap total images on the post at MAX_IMAGES across calls.
        $startSeq = (int) AppQyV1PostImageModel::query()->where('post_id', $id)->max('sequence');
        $existingCount = (int) AppQyV1PostImageModel::query()->where('post_id', $id)->count();
        if (($existingCount + count($files)) > self::MAX_IMAGES) {
            return $this->error('A post can have at most ' . self::MAX_IMAGES . ' images', 422);
        }

        $storageDir = PathMapper::getLaravelStaticDir(self::POST_IMAGES_SUBDIR . '/' . $id);
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0755, true);
        }
        if (!is_dir($storageDir)) {
            return $this->error('Failed to prepare image storage directory', 500);
        }

        $seq = $startSeq;
        foreach ($files as $file) {
            $rawBytes = @file_get_contents($file->getRealPath());
            if ($rawBytes === false || $rawBytes === '') {
                continue;
            }
            $jpegBytes = $this->downscaleToJpeg($rawBytes);
            if ($jpegBytes === null) {
                continue;
            }

            $seq++;
            $fullPath = $storageDir . '/' . $seq . '.jpg';
            if (@file_put_contents($fullPath, $jpegBytes) === false) {
                $seq--;
                continue;
            }

            $relativeUrl = self::POST_IMAGES_URL_PREFIX . '/' . $id . '/' . $seq . '.jpg';
            AppQyV1PostImageModel::query()->create([
                'post_id' => $id,
                'image_url' => $relativeUrl,
                'sequence' => $seq,
                'caption' => null,
                'created_at' => now(),
            ]);
            $stored++;
        }

        if ($stored === 0) {
            return $this->error('Failed to process uploaded images', 422);
        }

        // Promote to an images post if it was plain text.
        if ((string) $post->post_type === AppQyV1PostModel::TYPE_TEXT) {
            $post->post_type = AppQyV1PostModel::TYPE_IMAGES;
            $post->updated_at = now();
            $post->save();
        }

        return $this->success([
            'post' => $this->freshPostShape($id, $myId),
        ], 'Images uploaded');
    }

    /**
     * POST /social/posts/{id}/video  (multipart video <=200MB)
     * Stored verbatim (NO transcoding). Returns the refreshed Post.
     */
    public function uploadVideo(Request $request, int $id)
    {
        $currentUser = $request->user();
        $validator = null;
        $myId = 0;
        $post = null;
        $file = null;
        $storageDir = '';
        $fullPath = '';
        $relativeUrl = '';

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $myId = (int) $currentUser->id;

        $post = AppQyV1PostModel::query()->find($id);
        if (!$post) {
            return $this->notFound('Post not found');
        }
        if ((int) $post->user_id !== $myId) {
            return $this->forbidden('Only the author can add a video to this post');
        }

        // 200MB = 204800 KB.
        $validator = Validator::make($request->all(), [
            'video' => ['required', 'file', 'mimes:mp4,webm,mov', 'max:204800'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }

        $file = $request->file('video');

        $storageDir = PathMapper::getLaravelStaticDir(self::POST_VIDEOS_SUBDIR . '/' . $myId);
        if (!is_dir($storageDir)) {
            @mkdir($storageDir, 0755, true);
        }
        if (!is_dir($storageDir)) {
            return $this->error('Failed to prepare video storage directory', 500);
        }

        // Stored verbatim as {post_id}.mp4 (extension normalized; no transcode).
        $fullPath = $storageDir . '/' . $id . '.mp4';
        if (!@move_uploaded_file($file->getRealPath(), $fullPath)) {
            // move_uploaded_file fails outside a real upload context; fall back
            // to a stream copy so the path still works under Octane test clients.
            if (@copy($file->getRealPath(), $fullPath) === false) {
                return $this->error('Failed to store uploaded video', 500);
            }
        }

        $relativeUrl = self::POST_VIDEOS_URL_PREFIX . '/' . $myId . '/' . $id . '.mp4';

        $post->video_url = $relativeUrl;
        if ((string) $post->post_type !== AppQyV1PostModel::TYPE_VIDEO) {
            $post->post_type = AppQyV1PostModel::TYPE_VIDEO;
        }
        $post->updated_at = now();
        $post->save();

        return $this->success([
            'post' => $this->freshPostShape($id, $myId),
        ], 'Video uploaded');
    }

    /**
     * GD-decode raw image bytes, downscale so the longest edge is at most
     * IMAGE_MAX_DIMENSION (aspect preserved), flatten alpha onto white, and
     * re-encode as JPEG. Returns the JPEG bytes, or null when the input is not a
     * decodable image. (Same hardening as AvatarService: raw bytes are never
     * written verbatim.)
     */
    private function downscaleToJpeg(string $rawBytes): ?string
    {
        $source = null;
        $srcWidth = 0;
        $srcHeight = 0;
        $scale = 1.0;
        $dstWidth = 0;
        $dstHeight = 0;
        $dest = null;
        $buffer = null;
        $output = '';

        $source = @imagecreatefromstring($rawBytes);
        if ($source === false) {
            return null;
        }

        $srcWidth = imagesx($source);
        $srcHeight = imagesy($source);
        if ($srcWidth < 1 || $srcHeight < 1) {
            imagedestroy($source);
            return null;
        }

        $scale = 1.0;
        if ($srcWidth > self::IMAGE_MAX_DIMENSION || $srcHeight > self::IMAGE_MAX_DIMENSION) {
            $scale = self::IMAGE_MAX_DIMENSION / max($srcWidth, $srcHeight);
        }
        $dstWidth = max(1, (int) round($srcWidth * $scale));
        $dstHeight = max(1, (int) round($srcHeight * $scale));

        $dest = imagecreatetruecolor($dstWidth, $dstHeight);
        imagefilledrectangle(
            $dest,
            0,
            0,
            $dstWidth,
            $dstHeight,
            imagecolorallocate($dest, 255, 255, 255)
        );
        imagecopyresampled($dest, $source, 0, 0, 0, 0, $dstWidth, $dstHeight, $srcWidth, $srcHeight);
        imagedestroy($source);

        ob_start();
        $buffer = imagejpeg($dest, null, self::IMAGE_JPEG_QUALITY);
        $output = (string) ob_get_clean();
        imagedestroy($dest);

        if ($buffer === false || $output === '') {
            return null;
        }
        return $output;
    }

    /**
     * Re-shape a post for the response after a media mutation. Mirrors
     * AppQyV1PostController::postShape so the FE gets an identical Post object.
     */
    private function freshPostShape(int $postId, int $myId): array
    {
        $post = null;
        $authorUser = null;
        $imageRows = null;
        $images = [];
        $liked = false;

        $post = AppQyV1PostModel::query()->find($postId);
        if (!$post) {
            return [];
        }

        $authorUser = User::find((int) $post->user_id);

        $imageRows = AppQyV1PostImageModel::query()
            ->where('post_id', $postId)
            ->orderBy('sequence')
            ->orderBy('id')
            ->get();
        foreach ($imageRows as $row) {
            $images[] = [
                'id' => (int) $row->id,
                'url' => (string) $row->image_url,
                'caption' => $row->caption !== null ? (string) $row->caption : null,
                'sequence' => (int) $row->sequence,
            ];
        }

        $liked = !empty(AppQyV1PostLikeModel::likedPostIds($myId, [$postId]));

        return [
            'id' => (int) $post->id,
            'author' => $this->userMini($authorUser, (int) $post->user_id),
            'content' => $post->content !== null ? (string) $post->content : null,
            'post_type' => (string) $post->post_type,
            'images' => $images,
            'video_url' => $post->video_url !== null ? (string) $post->video_url : null,
            'external_url' => $post->external_url !== null ? (string) $post->external_url : null,
            'cover_url' => $post->cover_image_url !== null ? (string) $post->cover_image_url : null,
            'like_count' => (int) $post->like_count,
            'comment_count' => (int) $post->comment_count,
            'liked_by_me' => $liked,
            'visibility' => (string) $post->visibility,
            'created_at' => $post->created_at ? $post->created_at->toISOString() : null,
        ];
    }

    private function userMini(?User $user, int $fallbackId): array
    {
        if (!$user) {
            return ['id' => $fallbackId, 'name' => 'Unknown', 'avatar_url' => null];
        }
        return [
            'id' => (int) $user->id,
            'name' => $this->displayName($user),
            'avatar_url' => $this->avatarUrl($user),
        ];
    }

    private function displayName(User $user): string
    {
        if (!empty($user->nickname)) {
            return $user->nickname;
        }
        if (!empty($user->name)) {
            return $user->name;
        }
        return (string) $user->username;
    }

    private function avatarUrl(User $user): ?string
    {
        if (!empty($user->avatar)) {
            return AvatarService::getAvatarUrl($user->avatar);
        }
        return null;
    }
}
