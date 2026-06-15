<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ItToolsV1\ItToolsV1Utils;

use App\Utils\ImageProcessUtil;

/**
 * ITTools Image Utility
 *
 * Wrapper for common image processing functions
 * Uses shared ImageProcessUtil for core functionality
 */
class ItToolsV1ImageUtil
{
    public static function getImageInfo(string $imagePath): array
    {
        return ImageProcessUtil::getImageInfo($imagePath);
    }

    public static function resizeImage(string $sourcePath, int $newWidth, int $newHeight, string $outputPath = null): array
    {
        return ImageProcessUtil::resizeImage($sourcePath, $newWidth, $newHeight, $outputPath);
    }

    public static function convertImage(string $sourcePath, string $targetFormat): array
    {
        return ImageProcessUtil::convertImage($sourcePath, $targetFormat);
    }

    public static function rotateImage(string $sourcePath, int $angle): array
    {
        return ImageProcessUtil::rotateImage($sourcePath, $angle);
    }

    public static function flipImage(string $sourcePath, string $direction): array
    {
        return ImageProcessUtil::flipImage($sourcePath, $direction);
    }

    public static function compressImage(string $sourcePath, int $quality = 85, string $format = null): array
    {
        return ImageProcessUtil::compressImage($sourcePath, $quality, $format);
    }

    public static function cropImage(string $sourcePath, int $x, int $y, int $width, int $height): array
    {
        return ImageProcessUtil::cropImage($sourcePath, $x, $y, $width, $height);
    }

    public static function extractColors(string $imagePath, int $numColors = 5): array
    {
        return ImageProcessUtil::extractColors($imagePath, $numColors);
    }

    public static function mergeImagesVertically(array $imagePaths, array $descriptions = [], string $outputPath = null): array
    {
        return ImageProcessUtil::mergeImagesVertically($imagePaths, $descriptions, $outputPath);
    }

    private static function createImageFromFile(string $path, string $mime)
    {
        return ImageProcessUtil::createImageFromFile($path, $mime);
    }

    private static function formatBytes(int $bytes): string
    {
        return ImageProcessUtil::formatBytes($bytes);
    }
}
