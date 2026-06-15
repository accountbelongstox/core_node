<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\McpV1\McpV1Utils;

use Intervention\Image\ImageManager;
use Intervention\Image\Drivers\Gd\Driver;
use App\Apps\McpV1\McpV1Gvar\McpV1Config;

class McpV1ImageProcessor
{
    private ImageManager $manager;

    public function __construct()
    {
        $this->manager = new ImageManager(new Driver());
    }

    /**
     * Process image manipulation operation
     *
     * @param string $imagePath Input image path
     * @param string $operation Operation type
     * @param array $params Operation parameters
     * @param string|null $outputPath Output path (if null, overwrites original)
     * @return array Result with success status and message
     */
    public function processImage(string $imagePath, string $operation, array $params, ?string $outputPath = null): array
    {
        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'message' => "Image file not found at path: {$imagePath}"
            ];
        }

        $outputPath = $outputPath ?? $imagePath;

        try {
            $image = $this->manager->read($imagePath);

            switch ($operation) {
                case 'resize':
                    $this->handleResize($image, $params);
                    break;

                case 'crop':
                    $this->handleCrop($image, $params);
                    break;

                case 'convert':
                    $format = $params['format'] ?? 'jpeg';
                    $outputPath = preg_replace('/\.(jpeg|jpg|png|gif|webp)$/i', '.' . $format, $outputPath);
                    break;

                case 'quality':
                    break;

                case 'rotate':
                    $angle = $params['angle'] ?? 0;
                    $image->rotate($angle);
                    break;

                case 'flip':
                    $this->handleFlip($image, $params);
                    break;

                default:
                    return [
                        'success' => false,
                        'message' => "Unknown operation: {$operation}"
                    ];
            }

            $format = $params['format'] ?? pathinfo($outputPath, PATHINFO_EXTENSION);
            $quality = $params['quality'] ?? McpV1Config::DEFAULT_QUALITY;

            $image->save($outputPath, $quality, $format);

            return [
                'success' => true,
                'message' => "Image manipulation completed successfully. Output saved to: {$outputPath}",
                'output_path' => $outputPath
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => "Error processing image: " . $e->getMessage()
            ];
        }
    }

    /**
     * Handle resize operation
     */
    private function handleResize($image, array $params): void
    {
        $width = $params['width'] ?? null;
        $height = $params['height'] ?? null;

        if ($width && $height) {
            $image->scale($width, $height);
        } elseif ($width) {
            $image->scaleWidth($width);
        } elseif ($height) {
            $image->scaleHeight($height);
        } else {
            throw new \InvalidArgumentException("Width or height required for resize operation");
        }
    }

    /**
     * Handle crop operation
     */
    private function handleCrop($image, array $params): void
    {
        $width = $params['width'] ?? $image->width();
        $height = $params['height'] ?? $image->height();
        $x = $params['x'] ?? 0;
        $y = $params['y'] ?? 0;

        $image->crop($width, $height, $x, $y);
    }

    /**
     * Handle flip operation
     */
    private function handleFlip($image, array $params): void
    {
        $direction = $params['direction'] ?? 'horizontal';

        if ($direction === 'horizontal') {
            $image->flip();
        } else {
            $image->flip('v');
        }
    }

    /**
     * Validate image format
     */
    public function validateFormat(string $format): bool
    {
        return in_array(strtolower($format), McpV1Config::SUPPORTED_IMAGE_FORMATS);
    }

    /**
     * Validate operation type
     */
    public function validateOperation(string $operation): bool
    {
        return in_array($operation, McpV1Config::SUPPORTED_OPERATIONS);
    }
}

