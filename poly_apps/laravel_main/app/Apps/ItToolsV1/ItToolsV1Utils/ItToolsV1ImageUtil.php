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
}
