<?php

namespace App\CallPycoreUtils;

use App\Helpers\PycoreCaller;
use Illuminate\Support\Facades\Log;

/**
 * PycoreOCRUtil - OCR Utility using Pycore Module Caller Service
 *
 * Provides OCR functionality by calling Pycore service via HTTP.
 * Uses PycoreCaller helper for HTTP communication.
 *
 * Usage:
 *   $result = PycoreOCRUtil::recognizeImage('/path/to/image.jpg');
 *   $result = PycoreOCRUtil::recognizeImage('/path/to/image.jpg', 'doc');
 *   $batchResult = PycoreOCRUtil::recognizeBatch(['/path/1.jpg', '/path/2.jpg']);
 *
 * Available model types:
 *   - general: General purpose model for mixed content (default)
 *   - scene: Optimized for general scene photos with text
 *   - doc: Optimized for document screenshots and scans
 *   - number: Optimized for number recognition (0-9 only)
 *   - english: Optimized for English text
 *   - chinese_traditional: Optimized for Traditional Chinese
 */
class PycoreOCRUtil
{
    /**
     * Check if OCR service is available
     *
     * @return bool
     */
    public static function isAvailable(): bool
    {
        $status = PycoreCaller::ocrStatus();
        return $status !== null && ($status['result']['available'] ?? false);
    }

    /**
     * Get all available OCR models
     *
     * @return array|null Array of available models or null on error
     */
    public static function getAvailableModels(): ?array
    {
        $response = PycoreCaller::ocrGetModels();

        if ($response && ($response['success'] ?? false)) {
            return $response['result'] ?? null;
        }

        Log::error('OCR: Failed to get available models', ['response' => $response]);
        return null;
    }

    /**
     * Get information about a specific OCR model
     *
     * @param string $modelType Model type (e.g., 'scene', 'doc', 'number')
     * @return array|null Model information or null on error
     */
    public static function getModelInfo(string $modelType): ?array
    {
        $response = PycoreCaller::ocrGetModelInfo($modelType);

        if ($response && ($response['success'] ?? false)) {
            return $response['result'] ?? null;
        }

        Log::error('OCR: Failed to get model info', [
            'model_type' => $modelType,
            'response' => $response
        ]);
        return null;
    }

    /**
     * Check if a specific model is loaded
     *
     * @param string $modelType Model type to check
     * @return bool
     */
    public static function isModelLoaded(string $modelType): bool
    {
        return PycoreCaller::ocrIsModelLoaded($modelType) ?? false;
    }

    /**
     * Get OCR service status
     *
     * @return array|null Status information including available and loaded models
     */
    public static function getStatus(): ?array
    {
        $response = PycoreCaller::ocrStatus();
        return $response['result'] ?? null;
    }

    /**
     * Recognize text from a single image
     *
     * @param string $imagePath Absolute path to image file
     * @param string $modelType Model type (general, scene, doc, number, english, chinese_traditional)
     * @return array OCR result with success, text, confidence, words, etc.
     */
    public static function recognizeImage(string $imagePath, string $modelType = 'general'): array
    {
        // Validate image path
        if (!file_exists($imagePath)) {
            Log::error('OCR: Image file not found', ['image_path' => $imagePath]);
            return [
                'success' => false,
                'error' => "Image file not found: {$imagePath}"
            ];
        }

        Log::info('OCR: Recognizing image', [
            'image_path' => $imagePath,
            'model_type' => $modelType
        ]);

        // Call Pycore via HTTP using function name 'recognize_image'
        $response = PycoreCaller::callModule(
            'pycore.pyutils.ocr.ocr_manager',
            'ocr_manager.recognize_image',
            [],
            [
                'image_path' => $imagePath,
                'model_type' => $modelType,
            ]
        );

        if ($response['success'] ?? false) {
            Log::info('OCR: Recognition successful', [
                'text_length' => strlen($response['result']['text'] ?? ''),
                'confidence' => $response['result']['confidence'] ?? 0.0
            ]);
            return $response['result'];
        }

        Log::error('OCR: Recognition failed', ['error' => $response['error'] ?? 'Unknown error']);
        return [
            'success' => false,
            'error' => $response['error'] ?? 'Unknown error'
        ];
    }

    /**
     * Recognize text from multiple images (batch processing)
     *
     * @param array $imagePaths Array of absolute paths to image files
     * @param string $modelType Model type (general, scene, doc, number, english, chinese_traditional)
     * @return array Batch OCR results
     */
    public static function recognizeBatch(array $imagePaths, string $modelType = 'general'): array
    {
        // Validate all image paths
        foreach ($imagePaths as $imagePath) {
            if (!file_exists($imagePath)) {
                Log::error('OCR: Image file not found in batch', ['image_path' => $imagePath]);
                return [
                    'success' => false,
                    'error' => "Image file not found: {$imagePath}"
                ];
            }
        }

        Log::info('OCR: Batch recognition', [
            'image_count' => count($imagePaths),
            'model_type' => $modelType
        ]);

        // Call Pycore via HTTP using function name 'recognize_batch'
        $response = PycoreCaller::callModule(
            'pycore.pyutils.ocr.ocr_manager',
            'ocr_manager.recognize_batch',
            [],
            [
                'image_paths' => $imagePaths,
                'model_type' => $modelType,
            ]
        );

        if ($response['success'] ?? false) {
            Log::info('OCR: Batch recognition successful', [
                'results_count' => count($response['result'] ?? [])
            ]);
            return $response['result'];
        }

        Log::error('OCR: Batch recognition failed', ['error' => $response['error'] ?? 'Unknown error']);
        return [
            'success' => false,
            'error' => $response['error'] ?? 'Unknown error'
        ];
    }

    /**
     * Legacy compatibility wrapper used by older code paths.
     *
     * @param string $imagePath
     * @param string $modelType
     * @return array
     */
    public static function performOCR(string $imagePath, string $modelType = 'general'): array
    {
        return self::recognizeImage($imagePath, $modelType);
    }

    /**
     * Get OCR engine information
     *
     * @param string|null $modelType Specific model type (optional)
     * @return array Engine information
     */
    public static function getEngineInfo(?string $modelType = null): array
    {
        Log::info('OCR: Getting engine info', ['model_type' => $modelType]);

        // Call Pycore via HTTP using function name 'get_engine_info'
        $kwargs = $modelType !== null ? ['model_type' => $modelType] : [];

        $response = PycoreCaller::callModule(
            'pycore.pyutils.ocr.ocr_manager',
            'ocr_manager.get_engine_info',
            [],
            $kwargs
        );

        if ($response['success'] ?? false) {
            return $response['result'];
        }

        Log::error('OCR: Failed to get engine info', ['error' => $response['error'] ?? 'Unknown error']);
        return [
            'success' => false,
            'error' => $response['error'] ?? 'Unknown error'
        ];
    }

    /**
     * Extract text only from image (simplified result)
     *
     * @param string $imagePath Absolute path to image file
     * @param string $modelType Model type (default: 'general')
     * @return string|null Extracted text or null on error
     */
    public static function extractText(string $imagePath, string $modelType = 'general'): ?string
    {
        $result = self::recognizeImage($imagePath, $modelType);

        if ($result && ($result['success'] ?? false)) {
            return $result['text'] ?? null;
        }

        return null;
    }

    /**
     * Get available model types with descriptions
     *
     * @return array Model types with descriptions
     */
    public static function getModelTypes(): array
    {
        return [
            'general' => 'General purpose OCR model',
            'scene' => 'Optimized for scene text (photos, signs)',
            'doc' => 'Optimized for document text (scanned documents)',
            'number' => 'Optimized for number recognition',
            'english' => 'Optimized for English text',
            'chinese_traditional' => 'Optimized for Traditional Chinese',
        ];
    }

    /**
     * Validate OCR result structure
     *
     * @param array|null $result OCR result to validate
     * @return bool
     */
    public static function isValidResult(?array $result): bool
    {
        if (!$result || !($result['success'] ?? false)) {
            return false;
        }

        return isset($result['text']) && isset($result['confidence']);
    }

    /**
     * Get OCR result confidence score
     *
     * @param array|null $result OCR result
     * @return float|null Confidence score (0.0 to 1.0) or null
     */
    public static function getConfidence(?array $result): ?float
    {
        if (!self::isValidResult($result)) {
            return null;
        }

        return $result['confidence'] ?? null;
    }

    /**
     * Filter OCR results by confidence threshold
     *
     * @param array|null $result OCR result
     * @param float $threshold Minimum confidence (0.0 to 1.0)
     * @return bool Whether result meets confidence threshold
     */
    public static function meetsConfidenceThreshold(?array $result, float $threshold = 0.7): bool
    {
        $confidence = self::getConfidence($result);
        return $confidence !== null && $confidence >= $threshold;
    }

    /**
     * Get detailed word information from OCR result
     *
     * @param array|null $result OCR result
     * @return array|null Array of words with bounding boxes and confidence
     */
    public static function getWords(?array $result): ?array
    {
        if (!self::isValidResult($result)) {
            return null;
        }

        return $result['words'] ?? null;
    }

    /**
     * Format OCR result for logging
     *
     * @param array|null $result OCR result
     * @return string Formatted log string
     */
    public static function formatForLog(?array $result): string
    {
        if (!$result) {
            return 'OCR: No result';
        }

        if (!($result['success'] ?? false)) {
            return 'OCR: Error - ' . ($result['error'] ?? 'Unknown error');
        }

        $text = $result['text'] ?? '';
        $confidence = $result['confidence'] ?? 0.0;
        $provider = $result['provider'] ?? 'unknown';
        $processingTime = $result['processing_time'] ?? 0.0;

        return sprintf(
            'OCR: Success [%s] - Text: "%s" (Confidence: %.2f%%, Time: %.3fs)',
            $provider,
            substr($text, 0, 50) . (strlen($text) > 50 ? '...' : ''),
            $confidence * 100,
            $processingTime
        );
    }
}
