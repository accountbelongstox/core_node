<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;

class CodeMartV1FileUploadService
{
    private const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'];
    private const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
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
            $path = Storage::disk(CodeMartV1Constants::KYC_PRIVATE_DISK)->putFileAs(
                self::KYC_UPLOAD_PATH,
                $file,
                $fileName
            );

            return $path;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Resolve a stored KYC document on the private disk (the only KYC read
     * path; sys:init moves documents of older uploads off the public disk).
     *
     * @return array{disk:string,path:string}|null
     */
    public function locateKycFile(?string $path): ?array
    {
        if ($path === null || $path === '' || !Storage::disk(CodeMartV1Constants::KYC_PRIVATE_DISK)->exists($path)) {
            return null;
        }

        return ['disk' => CodeMartV1Constants::KYC_PRIVATE_DISK, 'path' => $path];
    }

    /**
     * First half of moving a KYC document that an upload before the
     * private-disk change left on the public upload disk: copy it to the
     * private KYC disk and verify the checksum. Returns the private path the
     * row must store (the same path, unless a different file already occupies
     * it; the alternative name derives from the checksum so a rerun reuses
     * it), or null when the public disk holds no copy.
     */
    public function copyLegacyKycFileToPrivate(string $path): ?string
    {
        $public = Storage::disk(self::UPLOAD_DISK);
        $private = Storage::disk(CodeMartV1Constants::KYC_PRIVATE_DISK);
        if ($path === '' || !$public->exists($path)) {
            return null;
        }

        $checksum = $public->checksum($path);
        if ($checksum === false) {
            throw new \RuntimeException(__('codemart.cli.init.kyc_read_failed', ['path' => $path]));
        }

        $target = $path;
        if ($private->exists($target) && $private->checksum($target) !== $checksum) {
            $target = self::KYC_UPLOAD_PATH . '/' . substr((string) $checksum, 0, 16) . '_' . basename($path);
        }

        if (!$private->exists($target)) {
            $stream = $public->readStream($path);
            $written = is_resource($stream) && $private->writeStream($target, $stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
            if (!$written) {
                throw new \RuntimeException(__('codemart.cli.init.kyc_write_failed', ['path' => $target]));
            }
        }

        if ($private->checksum($target) !== $checksum) {
            throw new \RuntimeException(__('codemart.cli.init.kyc_checksum_mismatch', ['path' => $path, 'target' => $target]));
        }

        return $target;
    }

    /** Second half of the move: delete the verified public copy. */
    public function deleteLegacyKycFile(string $path): void
    {
        if (!Storage::disk(self::UPLOAD_DISK)->delete($path)) {
            throw new \RuntimeException(__('codemart.cli.init.kyc_delete_failed', ['path' => $path]));
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

    /**
     * Store a delivery file (project attachment, submission upload) on the
     * private disk. Returns the descriptor or null when the file is invalid
     * or cannot be stored.
     */
    public function storePrivateDeliveryFile(object $file, string $directory): ?array
    {
        if (!$file || !$file->isValid()) {
            return null;
        }

        try {
            $extension = strtolower((string) $file->getClientOriginalExtension());
            $storedName = Str::uuid()->toString() . ($extension !== '' ? '.' . $extension : '');
            $path = Storage::disk(CodeMartV1Constants::DELIVERY_PRIVATE_DISK)->putFileAs($directory, $file, $storedName);
            if (!is_string($path) || $path === '') {
                return null;
            }

            return [
                'file_name' => $storedName,
                'original_name' => (string) $file->getClientOriginalName(),
                'mime_type' => (string) ($file->getMimeType() ?? $file->getClientMimeType()),
                'size' => (int) $file->getSize(),
                'path' => $path,
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function privateDeliveryFileExists(?string $path): bool
    {
        return is_string($path) && $path !== ''
            && Storage::disk(CodeMartV1Constants::DELIVERY_PRIVATE_DISK)->exists($path);
    }

    public function downloadPrivateDeliveryFile(string $path, string $downloadName)
    {
        return Storage::disk(CodeMartV1Constants::DELIVERY_PRIVATE_DISK)->download($path, $downloadName);
    }

    /** First bytes of a private text file (for cheap keyword extraction). */
    public function readPrivateDeliverySnippet(string $path, int $maxBytes): string
    {
        try {
            $stream = Storage::disk(CodeMartV1Constants::DELIVERY_PRIVATE_DISK)->readStream($path);
            if (!is_resource($stream)) {
                return '';
            }
            $snippet = (string) fread($stream, $maxBytes);
            fclose($stream);

            return $snippet;
        } catch (\Throwable $e) {
            return '';
        }
    }

    private function isValidImageFile(object $file): bool
    {
        if (!$file || !$file->isValid()) {
            return false;
        }

        $extension = strtolower($file->getClientOriginalExtension());
        $allowedTypes = CodeMartV1PolicyService::list('allowed_image_types');
        if (!in_array($extension, $allowedTypes, true)) {
            return false;
        }

        if ($file->getSize() > CodeMartV1PolicyService::int('max_kyc_image_size_kb') * 1024) {
            return false;
        }

        $mimeType = $file->getMimeType();
        $allowedMimes = array_map(static fn (string $type): string => $type === 'png' ? 'image/png' : 'image/jpeg', $allowedTypes);
        if (!in_array($mimeType, $allowedMimes, true)) {
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
