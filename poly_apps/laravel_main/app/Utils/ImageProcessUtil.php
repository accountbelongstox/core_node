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

namespace App\Utils;

/**
 * Common Image Processing Utility
 *
 * Shared image processing functions used by ITTools and MCP
 */
class ImageProcessUtil
{
    private static $defaultFontPath = null;
    private static $titleHeight = 80;
    private static $fontSize = 24;
    private static $padding = 20;
    private static $titleBgColor = [255, 255, 255];
    private static $titleTextColor = [0, 0, 0];

    /**
     * Get image information
     *
     * @param string $imagePath Path to image
     * @return array Image info
     */
    public static function getImageInfo(string $imagePath): array
    {
        if (!file_exists($imagePath)) {
            throw new \InvalidArgumentException("Image file not found: $imagePath");
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

    /**
     * Create GD image resource from file
     *
     * @param string $path Image path
     * @param string $mime MIME type
     * @return \GdImage
     */
    public static function createImageFromFile(string $path, string $mime)
    {
        $image = match($mime) {
            'image/jpeg' => imagecreatefromjpeg($path),
            'image/png' => imagecreatefrompng($path),
            'image/gif' => imagecreatefromgif($path),
            'image/webp' => imagecreatefromwebp($path),
            'image/bmp', 'image/x-ms-bmp' => imagecreatefrombmp($path),
            'image/avif' => function_exists('imagecreatefromavif') ? imagecreatefromavif($path) : self::createFromString($path),
            default => self::createFromString($path)
        };

        if ($image === false) {
            throw new \InvalidArgumentException("Failed to create image from file: $path (mime: $mime)");
        }

        return $image;
    }

    /**
     * Create GD image from file contents (fallback for unsupported formats)
     *
     * @param string $path Image path
     * @return \GdImage|false
     */
    private static function createFromString(string $path)
    {
        $contents = file_get_contents($path);
        if ($contents === false) {
            return false;
        }
        return @imagecreatefromstring($contents);
    }

    /**
     * Format bytes to human readable format
     *
     * @param int $bytes Bytes
     * @return string Formatted string
     */
    public static function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Set font path for text rendering
     *
     * @param string $fontPath Path to TTF font file
     */
    public static function setFontPath(string $fontPath): void
    {
        self::$defaultFontPath = $fontPath;
    }

    /**
     * Get font path
     *
     * @return string|null Font path
     */
    public static function getFontPath(): ?string
    {
        if (self::$defaultFontPath !== null && file_exists(self::$defaultFontPath)) {
            return self::$defaultFontPath;
        }

        $possiblePaths = [
            storage_path('fonts/simhei.ttf'),
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        ];

        foreach ($possiblePaths as $path) {
            if (file_exists($path)) {
                return $path;
            }
        }

        return null;
    }

    /**
     * Merge multiple images vertically with optional title headers
     *
     * @param array $imagePaths Array of image paths
     * @param array $descriptions Array of descriptions (same index as images)
     * @param string|null $outputPath Output file path (auto-generated if null)
     * @param array $options Optional settings (titleHeight, fontSize, titleBgColor, titleTextColor)
     * @return array Result with merged image info
     */
    public static function mergeImagesVertically(
        array $imagePaths,
        array $descriptions = [],
        ?string $outputPath = null,
        array $options = []
    ): array {
        $images = [];
        $maxWidth = 0;
        $totalHeight = 0;
        $titleHeight = $options['titleHeight'] ?? self::$titleHeight;
        $fontSize = $options['fontSize'] ?? self::$fontSize;
        $padding = $options['padding'] ?? self::$padding;
        $titleBgColor = $options['titleBgColor'] ?? self::$titleBgColor;
        $titleTextColor = $options['titleTextColor'] ?? self::$titleTextColor;

        // First pass: collect image info and calculate dimensions
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

        // Create merged image canvas
        $mergedImage = imagecreatetruecolor($maxWidth, $totalHeight);

        imagealphablending($mergedImage, false);
        imagesavealpha($mergedImage, true);

        $white = imagecolorallocate($mergedImage, 255, 255, 255);
        imagefilledrectangle($mergedImage, 0, 0, $maxWidth, $totalHeight, $white);

        $currentY = 0;
        $fontPath = self::getFontPath();

        // Second pass: draw images with titles
        foreach ($images as $imageData) {
            // Draw title header if description exists
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

                    imagettftext($mergedImage, $fontSize, 0, (int)$textX, (int)$textY, $titleText, $fontPath, $imageData['description']);
                } else {
                    $textX = $padding;
                    $textY = $currentY + ($titleHeight / 2);

                    imagestring($mergedImage, 5, (int)$textX, (int)$textY - 8, $imageData['description'], $titleText);
                }

                $currentY += $titleHeight;
            }

            // Draw image (centered horizontally)
            $offsetX = (int)(($maxWidth - $imageData['width']) / 2);
            imagecopy($mergedImage, $imageData['resource'], $offsetX, $currentY, 0, 0, $imageData['width'], $imageData['height']);

            $currentY += $imageData['height'];

            imagedestroy($imageData['resource']);
        }

        // Save merged image
        $tempPath = $outputPath ?: tempnam(sys_get_temp_dir(), 'img_merged_') . '.png';
        imagepng($mergedImage, $tempPath);

        imagedestroy($mergedImage);

        return [
            'success' => true,
            'path' => $tempPath,
            'width' => $maxWidth,
            'height' => $totalHeight,
            'image_count' => count($images),
            'file_size' => filesize($tempPath),
            'file_size_readable' => self::formatBytes(filesize($tempPath))
        ];
    }

    /**
     * Resize image
     *
     * @param string $sourcePath Source image path
     * @param int $newWidth New width
     * @param int $newHeight New height
     * @param string|null $outputPath Output path
     * @return array Result
     */
    public static function resizeImage(string $sourcePath, int $newWidth, int $newHeight, ?string $outputPath = null): array
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
            'success' => true,
            'path' => $tempPath,
            'original_size' => ['width' => $originalWidth, 'height' => $originalHeight],
            'new_size' => ['width' => $newWidth, 'height' => $newHeight],
            'file_size' => filesize($tempPath)
        ];
    }

    /**
     * Convert image format
     *
     * @param string $sourcePath Source image path
     * @param string $targetFormat Target format (jpg, png, gif, webp)
     * @param int $quality Quality (0-100)
     * @return array Result
     */
    public static function convertImage(string $sourcePath, string $targetFormat, int $quality = 90): array
    {
        $imageInfo = self::getImageInfo($sourcePath);
        $sourceImage = self::createImageFromFile($sourcePath, $imageInfo['mime']);

        $tempPath = tempnam(sys_get_temp_dir(), 'img_') . '.' . $targetFormat;

        $result = match(strtolower($targetFormat)) {
            'jpg', 'jpeg' => imagejpeg($sourceImage, $tempPath, $quality),
            'png' => imagepng($sourceImage, $tempPath),
            'gif' => imagegif($sourceImage, $tempPath),
            'webp' => imagewebp($sourceImage, $tempPath, $quality),
            default => throw new \InvalidArgumentException("Unsupported format: $targetFormat")
        };

        imagedestroy($sourceImage);

        return [
            'success' => true,
            'path' => $tempPath,
            'format' => $targetFormat,
            'file_size' => filesize($tempPath),
            'original_format' => $imageInfo['mime']
        ];
    }

    /**
     * Rotate image
     *
     * @param string $sourcePath Source image path
     * @param int $angle Rotation angle
     * @return array Result
     */
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
            'success' => true,
            'path' => $tempPath,
            'angle' => $angle,
            'file_size' => filesize($tempPath)
        ];
    }

    /**
     * Flip image
     *
     * @param string $sourcePath Source image path
     * @param string $direction Direction (horizontal, vertical, both)
     * @return array Result
     */
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
            'success' => true,
            'path' => $tempPath,
            'direction' => $direction,
            'file_size' => filesize($tempPath)
        ];
    }

    /**
     * Compress image
     *
     * @param string $sourcePath Source image path
     * @param int $quality Quality (0-100)
     * @param string|null $format Target format
     * @return array Result
     */
    public static function compressImage(string $sourcePath, int $quality = 85, ?string $format = null): array
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
            'success' => true,
            'path' => $tempPath,
            'format' => $targetFormat,
            'quality' => $quality,
            'original_size' => $originalSize,
            'compressed_size' => $compressedSize,
            'compression_ratio' => round((1 - $compressedSize / $originalSize) * 100, 2)
        ];
    }

    /**
     * Crop image
     *
     * @param string $sourcePath Source image path
     * @param int $x X offset
     * @param int $y Y offset
     * @param int $width Crop width
     * @param int $height Crop height
     * @return array Result
     */
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
            'success' => true,
            'path' => $tempPath,
            'crop_area' => ['x' => $x, 'y' => $y, 'width' => $width, 'height' => $height],
            'file_size' => filesize($tempPath)
        ];
    }

    /**
     * Extract dominant colors from image
     *
     * @param string $imagePath Image path
     * @param int $numColors Number of colors to extract
     * @return array Colors array
     */
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
}

