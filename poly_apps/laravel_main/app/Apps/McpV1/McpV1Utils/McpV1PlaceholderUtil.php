<?php

namespace App\Apps\McpV1\McpV1Utils;

use App\Utils\FileSystemManager;
use App\Providers\PathMapper;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class McpV1PlaceholderUtil
{
    private const STORAGE_DIR = 'mcp_placeholders';

    public static function generatePlaceholder(
        int $width,
        int $height,
        ?string $text = null,
        bool $realImage = false
    ): array {
        try {
            $uuid = (string) Str::uuid();
            $filename = "placeholder_{$width}x{$height}_{$uuid}.png";

            $storageDir = PathMapper::getLaravelStaticDir() . DIRECTORY_SEPARATOR . self::STORAGE_DIR;
            FileSystemManager::ensureDirectoryExists($storageDir);

            $filePath = $storageDir . DIRECTORY_SEPARATOR . $filename;

            if ($realImage) {
                $result = self::generateRealImage($width, $height, $text, $filePath);
            } else {
                $result = self::generateSimpleImage($width, $height, $text, $filePath);
            }

            if (!$result['success']) {
                return $result;
            }

            $fileSize = FileSystemManager::fileSize($filePath);

            return [
                'success' => true,
                'uuid' => $uuid,
                'filename' => $filename,
                'file_path' => $filePath,
                'file_size' => $fileSize,
                'width' => $width,
                'height' => $height,
                'text' => $text,
                'type' => $realImage ? 'real' : 'simple',
            ];
        } catch (\Exception $e) {
            Log::error('Failed to generate placeholder', [
                'width' => $width,
                'height' => $height,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    private static function generateSimpleImage(
        int $width,
        int $height,
        ?string $text,
        string $filePath
    ): array {
        try {
            $image = imagecreatetruecolor($width, $height);

            $backgroundColor = imagecolorallocate($image, 240, 240, 240);
            $textColor = imagecolorallocate($image, 51, 51, 51);
            $borderColor = imagecolorallocate($image, 204, 204, 204);

            imagefill($image, 0, 0, $backgroundColor);
            imagerectangle($image, 0, 0, $width - 1, $height - 1, $borderColor);

            $displayText = $text ?: "{$width}x{$height}";

            $fontSize = min(5, floor($height / 20));
            $fontPath = self::getFontPath();

            if ($fontPath && function_exists('imagettftext')) {
                $fontSize = min(48, floor($height / 10));
                $bbox = imagettfbbox($fontSize, 0, $fontPath, $displayText);
                $textWidth = abs($bbox[4] - $bbox[0]);
                $textHeight = abs($bbox[5] - $bbox[1]);

                $x = ($width - $textWidth) / 2;
                $y = ($height + $textHeight) / 2;

                imagettftext($image, $fontSize, 0, $x, $y, $textColor, $fontPath, $displayText);
            } else {
                $textWidth = imagefontwidth($fontSize) * strlen($displayText);
                $textHeight = imagefontheight($fontSize);

                $x = ($width - $textWidth) / 2;
                $y = ($height - $textHeight) / 2;

                imagestring($image, $fontSize, $x, $y, $displayText, $textColor);
            }

            $dimensionsText = "{$width}x{$height}";
            if ($fontPath && function_exists('imagettftext')) {
                $smallFontSize = max(12, floor($height / 30));
                $bbox = imagettfbbox($smallFontSize, 0, $fontPath, $dimensionsText);
                $dimWidth = abs($bbox[4] - $bbox[0]);
                $dimX = $width - $dimWidth - 10;
                $dimY = $height - 10;
                imagettftext($image, $smallFontSize, 0, $dimX, $dimY, $textColor, $fontPath, $dimensionsText);
            } else {
                $dimX = $width - (imagefontwidth(2) * strlen($dimensionsText)) - 5;
                $dimY = $height - imagefontheight(2) - 5;
                imagestring($image, 2, $dimX, $dimY, $dimensionsText, $textColor);
            }

            imagepng($image, $filePath);
            imagedestroy($image);

            return ['success' => true];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => "Failed to generate simple image: " . $e->getMessage()
            ];
        }
    }

    private static function generateRealImage(
        int $width,
        int $height,
        ?string $text,
        string $filePath
    ): array {
        try {
            $imageData = self::fetchRandomImage();

            if (!$imageData) {
                return self::generateSimpleImage($width, $height, $text, $filePath);
            }

            $sourceImage = imagecreatefromstring($imageData);
            if (!$sourceImage) {
                return self::generateSimpleImage($width, $height, $text, $filePath);
            }

            $srcWidth = imagesx($sourceImage);
            $srcHeight = imagesy($sourceImage);

            $resizedImage = imagecreatetruecolor($width, $height);

            $targetRatio = $width / $height;
            $srcRatio = $srcWidth / $srcHeight;

            if ($srcRatio > $targetRatio) {
                $newHeight = $height;
                $newWidth = intval($height * $srcRatio);
            } else {
                $newWidth = $width;
                $newHeight = intval($width / $srcRatio);
            }

            $tempImage = imagecreatetruecolor($newWidth, $newHeight);
            imagecopyresampled($tempImage, $sourceImage, 0, 0, 0, 0, $newWidth, $newHeight, $srcWidth, $srcHeight);

            $left = intval(($newWidth - $width) / 2);
            $top = intval(($newHeight - $height) / 2);

            imagecopy($resizedImage, $tempImage, 0, 0, $left, $top, $width, $height);

            imagedestroy($sourceImage);
            imagedestroy($tempImage);

            imagepng($resizedImage, $filePath);
            imagedestroy($resizedImage);

            return ['success' => true];
        } catch (\Exception $e) {
            Log::warning('Failed to generate real image, falling back to simple', [
                'error' => $e->getMessage()
            ]);
            return self::generateSimpleImage($width, $height, $text, $filePath);
        }
    }

    private static function fetchRandomImage(): ?string
    {
        $apis = [
            'https://picsum.photos/1920/1080',
            'https://source.unsplash.com/random/1920x1080',
        ];

        foreach ($apis as $api) {
            try {
                $context = stream_context_create([
                    'http' => [
                        'timeout' => 10,
                        'follow_location' => true,
                    ],
                ]);

                $imageData = @file_get_contents($api, false, $context);

                if ($imageData !== false && strlen($imageData) > 0) {
                    return $imageData;
                }
            } catch (\Exception $e) {
                Log::debug('Failed to fetch from image API', [
                    'api' => $api,
                    'error' => $e->getMessage()
                ]);
                continue;
            }
        }

        return null;
    }

    private static function getFontPath(): ?string
    {
        $possiblePaths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/calibri.ttf',
        ];

        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return null;
    }

    public static function getDownloadUrl(string $uuid): string
    {
        return url("/api/mcp/v1/placeholders/{$uuid}/download");
    }

    public static function cleanupOldFiles(): int
    {
        $storageDir = PathMapper::getLaravelStaticDir() . DIRECTORY_SEPARATOR . self::STORAGE_DIR;

        if (!FileSystemManager::exists($storageDir)) {
            return 0;
        }

        $files = FileSystemManager::scanDirectory($storageDir);
        $deletedCount = 0;
        $oneDayAgo = now()->subDay()->timestamp;

        foreach ($files as $file) {
            $filePath = $storageDir . DIRECTORY_SEPARATOR . $file;

            if (FileSystemManager::isFile($filePath)) {
                $modTime = filemtime($filePath);

                if ($modTime < $oneDayAgo) {
                    FileSystemManager::deleteFile($filePath);
                    $deletedCount++;
                }
            }
        }

        return $deletedCount;
    }
}
