<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class CodeMartV1FileUploadService
{
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
    private const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    private const IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5MB for images
    private const UPLOAD_DISK = 'public';
    private const KYC_UPLOAD_PATH = 'codemart/kyc';
    private const PROFILE_UPLOAD_PATH = 'codemart/profiles';

    public function uploadKycImage(object $file, string $imageType): string|bool
    {
        if (!$this->isValidImageFile($file)) {
            return false;
        }

        try {
            $fileName = $this->generateFileName($imageType);
            $path = Storage::disk(self::UPLOAD_DISK)->putFileAs(
                self::KYC_UPLOAD_PATH,
                $file,
                $fileName
            );

            return $path;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function uploadProfileImage(object $file): string|bool
    {
        if (!$this->isValidImageFile($file)) {
            return false;
        }

        try {
            $fileName = $this->generateFileName('profile');
            $path = Storage::disk(self::UPLOAD_DISK)->putFileAs(
                self::PROFILE_UPLOAD_PATH,
                $file,
                $fileName
            );

            return $path;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function deleteFile(string $path): bool
    {
        try {
            if (Storage::disk(self::UPLOAD_DISK)->exists($path)) {
                Storage::disk(self::UPLOAD_DISK)->delete($path);
                return true;
            }
            return false;
        } catch (\Exception $e) {
            return false;
        }
    }

    private function isValidImageFile(object $file): bool
    {
        if (!$file || !$file->isValid()) {
            return false;
        }

        $extension = strtolower($file->getClientOriginalExtension());
        if (!in_array($extension, ['jpg', 'jpeg', 'png'])) {
            return false;
        }

        if ($file->getSize() > self::IMAGE_MAX_SIZE) {
            return false;
        }

        $mimeType = $file->getMimeType();
        if (!in_array($mimeType, ['image/jpeg', 'image/png'])) {
            return false;
        }

        return true;
    }

    private function generateFileName(string $prefix): string
    {
        return "{$prefix}_" . time() . '_' . Str::random(8) . '.jpg';
    }

    public function getFileUrl(string $path): string
    {
        return Storage::disk(self::UPLOAD_DISK)->url($path);
    }
}
