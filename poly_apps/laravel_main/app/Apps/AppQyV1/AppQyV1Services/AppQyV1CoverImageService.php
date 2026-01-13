<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\McpV1\McpV1Utils\McpV1PlaceholderUtil;
use App\Utils\ImageProcessUtil;
use App\Utils\FileSystemManager;
use App\Providers\PathMapper;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class AppQyV1CoverImageService
{
    private static function getStorageSubdir(): string
    {
        static $subdir = null;
        if ($subdir === null) {
            $appKey = \App\Constants\AppKeys::APPQYV1;
            $prefix = \App\Providers\AppTablePrefixServiceProvider::getPrefix($appKey);
            $subdir = $prefix . '_covers';
        }
        return $subdir;
    }

    private const DEFAULT_WIDTH = 400;
    private const DEFAULT_HEIGHT = 300;

    private const THUMBNAIL_WIDTH = 200;
    private const THUMBNAIL_HEIGHT = 150;

    // Cover image category constants with colors
    private const CATEGORY_CONFIGS = [
        'vocabulary' => [
            'name' => 'Vocabulary Library',
            'emoji' => '📚',
            'bg_color' => [66, 133, 244],  // Blue
            'text_color' => [255, 255, 255],
        ],
        'grammar' => [
            'name' => 'Grammar',
            'emoji' => '📝',
            'bg_color' => [52, 168, 83],  // Green
            'text_color' => [255, 255, 255],
        ],
        'reading' => [
            'name' => 'Reading',
            'emoji' => '📖',
            'bg_color' => [251, 188, 5],  // Yellow
            'text_color' => [51, 51, 51],
        ],
        'listening' => [
            'name' => 'Listening',
            'emoji' => '🎧',
            'bg_color' => [234, 67, 53],  // Red
            'text_color' => [255, 255, 255],
        ],
        'speaking' => [
            'name' => 'Speaking',
            'emoji' => '🗣️',
            'bg_color' => [156, 39, 176],  // Purple
            'text_color' => [255, 255, 255],
        ],
        'writing' => [
            'name' => 'Writing',
            'emoji' => '✍️',
            'bg_color' => [255, 112, 67],  // Orange
            'text_color' => [255, 255, 255],
        ],
        'exam' => [
            'name' => 'Exam Prep',
            'emoji' => '🎯',
            'bg_color' => [0, 150, 136],  // Teal
            'text_color' => [255, 255, 255],
        ],
        'daily' => [
            'name' => 'Daily Practice',
            'emoji' => '📅',
            'bg_color' => [121, 85, 72],  // Brown
            'text_color' => [255, 255, 255],
        ],
        'custom' => [
            'name' => 'Custom Group',
            'emoji' => '⭐',
            'bg_color' => [96, 125, 139],  // Blue Grey
            'text_color' => [255, 255, 255],
        ],
    ];

    /**
     * Generate cover image for word group
     *
     * @param string $groupName Group name
     * @param string $category Category (vocabulary, grammar, reading, etc.)
     * @param int $wordCount Total words in group
     * @param bool $generateThumbnail Also generate thumbnail
     * @return array Result with paths and URLs
     */
    public static function generateGroupCover(
        string $groupName,
        string $category = 'custom',
        int $wordCount = 0,
        bool $generateThumbnail = true
    ): array {
        try {
            $config = self::CATEGORY_CONFIGS[$category] ?? self::CATEGORY_CONFIGS['custom'];

            $storageDir = PathMapper::getLaravelStaticDir() . DIRECTORY_SEPARATOR . self::getStorageSubdir();
            FileSystemManager::ensureDirectoryExists($storageDir);

            $uuid = (string) Str::uuid();
            $mainFilename = "cover_{$category}_{$uuid}.png";
            $mainFilePath = $storageDir . DIRECTORY_SEPARATOR . $mainFilename;

            // Generate main cover image
            $mainImage = self::createCoverImage(
                self::DEFAULT_WIDTH,
                self::DEFAULT_HEIGHT,
                $groupName,
                $config,
                $wordCount
            );

            imagepng($mainImage, $mainFilePath);
            imagedestroy($mainImage);

            $result = [
                'success' => true,
                'uuid' => $uuid,
                'category' => $category,
                'main' => [
                    'filename' => $mainFilename,
                    'path' => $mainFilePath,
                    'url' => self::getImageUrl($mainFilename),
                    'width' => self::DEFAULT_WIDTH,
                    'height' => self::DEFAULT_HEIGHT,
                    'size' => filesize($mainFilePath),
                ],
            ];

            // Generate thumbnail if requested
            if ($generateThumbnail) {
                $thumbnailFilename = "thumb_{$category}_{$uuid}.png";
                $thumbnailPath = $storageDir . DIRECTORY_SEPARATOR . $thumbnailFilename;

                $resizeResult = ImageProcessUtil::resizeImage(
                    $mainFilePath,
                    self::THUMBNAIL_WIDTH,
                    self::THUMBNAIL_HEIGHT,
                    $thumbnailPath
                );

                $result['thumbnail'] = [
                    'filename' => $thumbnailFilename,
                    'path' => $thumbnailPath,
                    'url' => self::getImageUrl($thumbnailFilename),
                    'width' => self::THUMBNAIL_WIDTH,
                    'height' => self::THUMBNAIL_HEIGHT,
                    'size' => $resizeResult['file_size'],
                ];
            }

            Log::info('[AppQyV1CoverImage] Generated cover', [
                'group_name' => $groupName,
                'category' => $category,
                'uuid' => $uuid,
            ]);

            return $result;

        } catch (\Exception $e) {
            Log::error('[AppQyV1CoverImage] Failed to generate cover', [
                'error' => $e->getMessage(),
                'group_name' => $groupName,
                'category' => $category,
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Create cover image with GD
     */
    private static function createCoverImage(
        int $width,
        int $height,
        string $groupName,
        array $config,
        int $wordCount
    ) {
        $image = imagecreatetruecolor($width, $height);

        // Background gradient (simple two-tone)
        $bgColor1 = imagecolorallocate($image, $config['bg_color'][0], $config['bg_color'][1], $config['bg_color'][2]);
        $bgColor2 = imagecolorallocate(
            $image,
            max(0, $config['bg_color'][0] - 30),
            max(0, $config['bg_color'][1] - 30),
            max(0, $config['bg_color'][2] - 30)
        );

        // Fill background with gradient
        for ($y = 0; $y < $height; $y++) {
            $ratio = $y / $height;
            $r = (int)($config['bg_color'][0] * (1 - $ratio) + max(0, $config['bg_color'][0] - 30) * $ratio);
            $g = (int)($config['bg_color'][1] * (1 - $ratio) + max(0, $config['bg_color'][1] - 30) * $ratio);
            $b = (int)($config['bg_color'][2] * (1 - $ratio) + max(0, $config['bg_color'][2] - 30) * $ratio);
            $lineColor = imagecolorallocate($image, $r, $g, $b);
            imageline($image, 0, $y, $width, $y, $lineColor);
        }

        $textColor = imagecolorallocate($image, $config['text_color'][0], $config['text_color'][1], $config['text_color'][2]);

        $fontPath = ImageProcessUtil::getFontPath();

        // Draw emoji at top
        if ($fontPath) {
            $emojiSize = 48;
            $emojiY = 80;
            $emojiBbox = imagettfbbox($emojiSize, 0, $fontPath, $config['emoji']);
            $emojiWidth = abs($emojiBbox[4] - $emojiBbox[0]);
            $emojiX = ($width - $emojiWidth) / 2;
            imagettftext($image, $emojiSize, 0, (int)$emojiX, (int)$emojiY, $textColor, $fontPath, $config['emoji']);
        }

        // Draw group name
        $groupNameDisplay = mb_strlen($groupName) > 20 ? mb_substr($groupName, 0, 20) . '...' : $groupName;

        if ($fontPath) {
            $titleSize = 24;
            $titleY = 150;
            $titleBbox = imagettfbbox($titleSize, 0, $fontPath, $groupNameDisplay);
            $titleWidth = abs($titleBbox[4] - $titleBbox[0]);
            $titleX = ($width - $titleWidth) / 2;
            imagettftext($image, $titleSize, 0, (int)$titleX, (int)$titleY, $textColor, $fontPath, $groupNameDisplay);
        } else {
            $titleX = ($width - (imagefontwidth(5) * strlen($groupNameDisplay))) / 2;
            $titleY = 140;
            imagestring($image, 5, (int)$titleX, (int)$titleY, $groupNameDisplay, $textColor);
        }

        // Draw word count
        if ($wordCount > 0) {
            $countText = "{$wordCount} words";
            if ($fontPath) {
                $countSize = 16;
                $countY = 190;
                $countBbox = imagettfbbox($countSize, 0, $fontPath, $countText);
                $countWidth = abs($countBbox[4] - $countBbox[0]);
                $countX = ($width - $countWidth) / 2;
                imagettftext($image, $countSize, 0, (int)$countX, (int)$countY, $textColor, $fontPath, $countText);
            } else {
                $countX = ($width - (imagefontwidth(3) * strlen($countText))) / 2;
                $countY = 180;
                imagestring($image, 3, (int)$countX, (int)$countY, $countText, $textColor);
            }
        }

        // Draw category label at bottom
        if ($fontPath) {
            $labelSize = 14;
            $labelY = $height - 30;
            $labelBbox = imagettfbbox($labelSize, 0, $fontPath, $config['name']);
            $labelWidth = abs($labelBbox[4] - $labelBbox[0]);
            $labelX = ($width - $labelWidth) / 2;
            imagettftext($image, $labelSize, 0, (int)$labelX, (int)$labelY, $textColor, $fontPath, $config['name']);
        } else {
            $labelX = ($width - (imagefontwidth(2) * strlen($config['name']))) / 2;
            $labelY = $height - 40;
            imagestring($image, 2, (int)$labelX, (int)$labelY, $config['name'], $textColor);
        }

        return $image;
    }

    /**
     * Get image URL for serving via controller
     */
    public static function getImageUrl(string $filename): string
    {
        return url("/api/app_qy_v1/covers/{$filename}");
    }

    /**
     * Get image path from filename
     */
    public static function getImagePath(string $filename): ?string
    {
        $storageDir = PathMapper::getLaravelStaticDir() . DIRECTORY_SEPARATOR . self::STORAGE_SUBDIR;
        $path = $storageDir . DIRECTORY_SEPARATOR . $filename;

        return file_exists($path) ? $path : null;
    }

    /**
     * Delete cover images
     */
    public static function deleteCover(string $uuid): bool
    {
        try {
            $storageDir = PathMapper::getLaravelStaticDir() . DIRECTORY_SEPARATOR . self::getStorageSubdir();
            $deleted = 0;

            $patterns = [
                "cover_*_{$uuid}.png",
                "thumb_*_{$uuid}.png",
            ];

            foreach ($patterns as $pattern) {
                $files = glob($storageDir . DIRECTORY_SEPARATOR . $pattern);
                foreach ($files as $file) {
                    if (file_exists($file) && unlink($file)) {
                        $deleted++;
                    }
                }
            }

            return $deleted > 0;
        } catch (\Exception $e) {
            Log::error('[AppQyV1CoverImage] Failed to delete cover', [
                'uuid' => $uuid,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Get all available categories
     */
    public static function getCategories(): array
    {
        return array_keys(self::CATEGORY_CONFIGS);
    }

    /**
     * Get category config
     */
    public static function getCategoryConfig(string $category): ?array
    {
        return self::CATEGORY_CONFIGS[$category] ?? null;
    }

    /**
     * Infer category from group name
     */
    public static function inferCategory(string $groupName): string
    {
        $name = strtolower($groupName);

        $keywords = [
            'vocabulary' => ['vocab', 'word', 'dictionary', '词汇', '单词'],
            'grammar' => ['grammar', 'syntax', '语法'],
            'reading' => ['read', '阅读', 'comprehension'],
            'listening' => ['listen', '听力', 'audio'],
            'speaking' => ['speak', '口语', 'conversation'],
            'writing' => ['writ', '写作', 'essay'],
            'exam' => ['exam', 'test', 'toefl', 'ielts', 'jlpt', '考试'],
            'daily' => ['daily', 'everyday', '日常'],
        ];

        foreach ($keywords as $category => $keys) {
            foreach ($keys as $keyword) {
                if (str_contains($name, $keyword)) {
                    return $category;
                }
            }
        }

        return 'custom';
    }
}
