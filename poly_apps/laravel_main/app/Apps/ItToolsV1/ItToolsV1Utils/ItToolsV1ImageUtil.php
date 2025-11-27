<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

class ItToolsV1ImageUtil
{
    public static function getImageInfo(string $imagePath): array
    {
        if (!file_exists($imagePath)) {
            throw new \InvalidArgumentException("Image file not found");
        }
        
        $imageSize = getimagesize($imagePath);
        $fileSize = filesize($imagePath);
        
        return [
            'width' => $imageSize[0],
            'height' => $imageSize[1],
            'type' => $imageSize[2],
            'mime' => $imageSize['mime'],
            'file_size' => $fileSize,
            'file_size_readable' => self::formatBytes($fileSize),
            'aspect_ratio' => round($imageSize[0] / $imageSize[1], 2)
        ];
    }
    
    public static function resizeImage(string $sourcePath, int $newWidth, int $newHeight, string $outputPath = null): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $originalWidth = $imageInfo['width'];
        $originalHeight = $imageInfo['height'];
        
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);
        
        $resizedImage = imagecreatetruecolor($newWidth, $newHeight);
        
        imagealphablending($resizedImage, false);
        imagesavealpha($resizedImage, true);
        
        imagecopyresampled(
            $resizedImage, $sourceImage,
            0, 0, 0, 0,
            $newWidth, $newHeight,
            $originalWidth, $originalHeight
        );
        
        $tempPath = $outputPath ?: tempnam(sys_get_temp_dir(), 'img_') . '.png';
        imagepng($resizedImage, $tempPath);
        
        imagedestroy($sourceImage);
        imagedestroy($resizedImage);
        
        return [
            'path' => $tempPath,
            'original_size' => ['width' => $originalWidth, 'height' => $originalHeight],
            'new_size' => ['width' => $newWidth, 'height' => $newHeight],
            'file_size' => filesize($tempPath)
        ];
    }
    
    public static function convertImage(string $sourcePath, string $targetFormat): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);
        
        $tempPath = tempnam(sys_get_temp_dir(), 'img_') . '.' . $targetFormat;
        
        $result = match(strtolower($targetFormat)) {
            'jpg', 'jpeg' => imagejpeg($sourceImage, $tempPath, 90),
            'png' => imagepng($sourceImage, $tempPath),
            'gif' => imagegif($sourceImage, $tempPath),
            'webp' => imagewebp($sourceImage, $tempPath, 90),
            default => throw new \InvalidArgumentException("Unsupported format: $targetFormat")
        };
        
        imagedestroy($sourceImage);
        
        return [
            'path' => $tempPath,
            'format' => $targetFormat,
            'file_size' => filesize($tempPath),
            'original_format' => $imageInfo['mime']
        ];
    }
    
    public static function rotateImage(string $sourcePath, int $angle): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);
        
        $rotatedImage = imagerotate($sourceImage, $angle, 0);
        
        $tempPath = tempnam(sys_get_temp_dir(), 'img_') . '.png';
        imagepng($rotatedImage, $tempPath);
        
        imagedestroy($sourceImage);
        imagedestroy($rotatedImage);
        
        return [
            'path' => $tempPath,
            'angle' => $angle,
            'file_size' => filesize($tempPath)
        ];
    }
    
    public static function flipImage(string $sourcePath, string $direction): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);
        
        $mode = match(strtolower($direction)) {
            'horizontal' => IMG_FLIP_HORIZONTAL,
            'vertical' => IMG_FLIP_VERTICAL,
            'both' => IMG_FLIP_BOTH,
            default => throw new \InvalidArgumentException("Invalid direction: $direction")
        };
        
        imageflip($sourceImage, $mode);
        
        $tempPath = tempnam(sys_get_temp_dir(), 'img_') . '.png';
        imagepng($sourceImage, $tempPath);
        
        imagedestroy($sourceImage);
        
        return [
            'path' => $tempPath,
            'direction' => $direction,
            'file_size' => filesize($tempPath)
        ];
    }
    
    public static function compressImage(string $sourcePath, int $quality = 85, string $format = null): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);
        
        $targetFormat = $format ?: ($imageInfo['mime'] === 'image/png' ? 'png' : 'jpg');
        $tempPath = tempnam(sys_get_temp_dir(), 'img_compress_') . '.' . $targetFormat;
        
        $result = match(strtolower($targetFormat)) {
            'jpg', 'jpeg' => imagejpeg($sourceImage, $tempPath, $quality),
            'png' => imagepng($sourceImage, $tempPath, (int)round(9 - ($quality / 100 * 9))),
            'webp' => imagewebp($sourceImage, $tempPath, $quality),
            default => throw new \InvalidArgumentException("Unsupported format for compression: $targetFormat")
        };
        
        imagedestroy($sourceImage);
        
        $originalSize = filesize($sourcePath);
        $compressedSize = filesize($tempPath);
        
        return [
            'path' => $tempPath,
            'format' => $targetFormat,
            'quality' => $quality,
            'original_size' => $originalSize,
            'compressed_size' => $compressedSize,
            'compression_ratio' => round((1 - $compressedSize / $originalSize) * 100, 2)
        ];
    }
    
    public static function cropImage(string $sourcePath, int $x, int $y, int $width, int $height): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);
        
        $croppedImage = imagecreatetruecolor($width, $height);
        
        imagealphablending($croppedImage, false);
        imagesavealpha($croppedImage, true);
        
        imagecopy($croppedImage, $sourceImage, 0, 0, $x, $y, $width, $height);
        
        $tempPath = tempnam(sys_get_temp_dir(), 'img_crop_') . '.png';
        imagepng($croppedImage, $tempPath);
        
        imagedestroy($sourceImage);
        imagedestroy($croppedImage);
        
        return [
            'path' => $tempPath,
            'crop_area' => ['x' => $x, 'y' => $y, 'width' => $width, 'height' => $height],
            'file_size' => filesize($tempPath)
        ];
    }
    
    public static function extractColors(string $imagePath, int $numColors = 5): array
    {
        $imageInfo = self::getImageInfo($imagePath);
        $sourceImage = self::createImageFromFile($imagePath, $imageInfo['mime']);
        
        $width = imagesx($sourceImage);
        $height = imagesy($sourceImage);
        
        $colorCounts = [];
        $sampleRate = 10;
        
        for ($x = 0; $x < $width; $x += $sampleRate) {
            for ($y = 0; $y < $height; $y += $sampleRate) {
                $rgb = imagecolorat($sourceImage, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
                
                $colorKey = "$r,$g,$b";
                $colorCounts[$colorKey] = ($colorCounts[$colorKey] ?? 0) + 1;
            }
        }
        
        arsort($colorCounts);
        $topColors = array_slice(array_keys($colorCounts), 0, $numColors, true);
        
        $result = [];
        foreach ($topColors as $colorKey) {
            list($r, $g, $b) = explode(',', $colorKey);
            $result[] = [
                'hex' => sprintf("#%02x%02x%02x", $r, $g, $b),
                'rgb' => "rgb($r, $g, $b)",
                'r' => (int)$r,
                'g' => (int)$g,
                'b' => (int)$b,
                'frequency' => $colorCounts[$colorKey]
            ];
        }
        
        imagedestroy($sourceImage);
        
        return $result;
    }
    
    private static function createImageFromFile(string $path, string $mime)
    {
        return match($mime) {
            'image/jpeg' => imagecreatefromjpeg($path),
            'image/png' => imagecreatefrompng($path),
            'image/gif' => imagecreatefromgif($path),
            'image/webp' => imagecreatefromwebp($path),
            default => throw new \InvalidArgumentException("Unsupported image type: $mime")
        };
    }
    
    private static function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    public static function mergeImagesVertically(array $imagePaths, array $descriptions = [], string $outputPath = null): array
    {
        $images = [];
        $maxWidth = 0;
        $totalHeight = 0;
        $titleHeight = 80;
        $fontSize = 24;
        $padding = 20;
        $titleBgColor = [255, 255, 255];
        $titleTextColor = [0, 0, 0];

        foreach ($imagePaths as $index => $imagePath) {
            if (!file_exists($imagePath)) {
                throw new \InvalidArgumentException("Image file not found: $imagePath");
            }

            $imageInfo = self::getImageInfo($imagePath);
            $image = self::createImageFromFile($imagePath, $imageInfo['mime']);

            $images[] = [
                'resource' => $image,
                'width' => $imageInfo['width'],
                'height' => $imageInfo['height'],
                'description' => $descriptions[$index] ?? null
            ];

            $maxWidth = max($maxWidth, $imageInfo['width']);

            if (!empty($descriptions[$index])) {
                $totalHeight += $titleHeight;
            }

            $totalHeight += $imageInfo['height'];
        }

        $mergedImage = imagecreatetruecolor($maxWidth, $totalHeight);

        imagealphablending($mergedImage, false);
        imagesavealpha($mergedImage, true);

        $white = imagecolorallocate($mergedImage, 255, 255, 255);
        imagefilledrectangle($mergedImage, 0, 0, $maxWidth, $totalHeight, $white);

        $currentY = 0;
        $fontPath = __DIR__ . '/../../../../../../storage/fonts/simhei.ttf';

        if (!file_exists($fontPath)) {
            $fontPath = null;
        }

        foreach ($images as $imageData) {
            if (!empty($imageData['description'])) {
                $titleBg = imagecolorallocate($mergedImage, $titleBgColor[0], $titleBgColor[1], $titleBgColor[2]);
                $titleText = imagecolorallocate($mergedImage, $titleTextColor[0], $titleTextColor[1], $titleTextColor[2]);

                imagefilledrectangle($mergedImage, 0, $currentY, $maxWidth, $currentY + $titleHeight, $titleBg);

                if ($fontPath) {
                    $textBox = imagettfbbox($fontSize, 0, $fontPath, $imageData['description']);
                    $textWidth = abs($textBox[4] - $textBox[0]);
                    $textHeight = abs($textBox[5] - $textBox[1]);

                    $textX = ($maxWidth - $textWidth) / 2;
                    $textY = $currentY + ($titleHeight + $textHeight) / 2;

                    imagettftext($mergedImage, $fontSize, 0, $textX, $textY, $titleText, $fontPath, $imageData['description']);
                } else {
                    $textX = $padding;
                    $textY = $currentY + ($titleHeight / 2);

                    imagestring($mergedImage, 5, $textX, $textY - 8, $imageData['description'], $titleText);
                }

                $currentY += $titleHeight;
            }

            $offsetX = ($maxWidth - $imageData['width']) / 2;
            imagecopy($mergedImage, $imageData['resource'], $offsetX, $currentY, 0, 0, $imageData['width'], $imageData['height']);

            $currentY += $imageData['height'];

            imagedestroy($imageData['resource']);
        }

        $tempPath = $outputPath ?: tempnam(sys_get_temp_dir(), 'img_merged_') . '.png';
        imagepng($mergedImage, $tempPath);

        imagedestroy($mergedImage);

        return [
            'path' => $tempPath,
            'width' => $maxWidth,
            'height' => $totalHeight,
            'image_count' => count($images),
            'file_size' => filesize($tempPath),
            'file_size_readable' => self::formatBytes(filesize($tempPath))
        ];
    }
}
