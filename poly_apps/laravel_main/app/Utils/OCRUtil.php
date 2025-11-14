<?php

namespace App\Utils;

use App\CallPycoreUtils\PycoreOCRUtil;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Global OCR Utility
 *
 * Wrapper for PycoreOCRUtil providing additional validation and error handling.
 * Provides OCR functionality for all applications.
 */
class OCRUtil
{
    /**
     * Recognize text from single image
     *
     * @param string $imagePath Absolute path to image
     * @param string $modelType Model type
     * @return array OCR result
     */
    public static function recognizeImage(string $imagePath, string $modelType = 'general'): array
    {
        // Validate image path
        $validator = Validator::make([
            'image_path' => $imagePath,
            'model_type' => $modelType
        ], [
            'image_path' => 'required|file',
            'model_type' => 'required|in:general,scene,doc,number,english,chinese_traditional'
        ]);

        if ($validator->fails()) {
            return [
                'success' => false,
                'error' => 'Validation failed: ' . $validator->errors()->first()
            ];
        }

        return PycoreOCRUtil::recognizeImage($imagePath, $modelType);
    }

    /**
     * Recognize text from multiple images
     *
     * @param array $imagePaths Array of absolute paths
     * @param string $modelType Model type
     * @return array Batch OCR results
     */
    public static function recognizeBatch(array $imagePaths, string $modelType = 'general'): array
    {
        // Validate inputs
        if (empty($imagePaths)) {
            return [
                'success' => false,
                'error' => 'No image paths provided'
            ];
        }

        return PycoreOCRUtil::recognizeBatch($imagePaths, $modelType);
    }

    /**
     * Get available OCR models
     *
     * @return array Available models
     */
    public static function getAvailableModels(): array
    {
        return PycoreOCRUtil::getAvailableModels();
    }

    /**
     * Get OCR engine information
     *
     * @param string|null $modelType Specific model type
     * @return array Engine info
     */
    public static function getEngineInfo(?string $modelType = null): array
    {
        return PycoreOCRUtil::getEngineInfo($modelType);
    }
}
