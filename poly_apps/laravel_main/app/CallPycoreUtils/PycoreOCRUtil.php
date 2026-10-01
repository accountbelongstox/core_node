<?php

namespace App\CallPycoreUtils;

use App\Utils\FileSystemManager;

/**
 * OCR through pycore's OCR engine registry.
 *
 * Images travel as base64 `image_data`, so pycore may run on another host than
 * Laravel. Success payloads are pycore's own
 * ({success, engine, text, latency_ms, error, model_type}); failures are
 * PycoreRpcException::payload() arrays.
 */
class PycoreOCRUtil
{
    /** CnOCR model types pycore's `model_type` parameter accepts. */
    public const MODEL_TYPES = ['general', 'scene', 'doc', 'number', 'english', 'chinese_traditional'];
    public const DEFAULT_MODEL_TYPE = 'general';

    public static function recognizeImage(string $imagePath, string $modelType = self::DEFAULT_MODEL_TYPE): array
    {
        $image = FileSystemManager::exists($imagePath) ? FileSystemManager::readFile($imagePath, false) : false;

        if (!is_string($image) || $image === '') {
            return [
                'success' => false,
                'error' => __('pycore.ocr_image_unreadable', ['path' => $imagePath]),
            ];
        }
        try {
            return PycoreHttpClient::call('localOcrRecognize', [
                'image_data' => base64_encode($image),
                'model_type' => $modelType,
            ]);
        } catch (PycoreRpcException $e) {
            return $e->payload();
        }
    }

    /**
     * @return array{success: bool, count: int, results: array<int, array>}
     */
    public static function recognizeBatch(array $imagePaths, string $modelType = self::DEFAULT_MODEL_TYPE): array
    {
        $results = [];

        foreach (array_values($imagePaths) as $imagePath) {
            $results[] = ['image_path' => $imagePath] + self::recognizeImage((string) $imagePath, $modelType);
        }

        return [
            'success' => $results !== [] && !in_array(false, array_column($results, 'success'), true),
            'count' => count($results),
            'results' => $results,
        ];
    }

    /**
     * pycore's OCR engine panel ({success, best, active, available_count, engines[...]}).
     */
    public static function status(): array
    {
        try {
            return PycoreHttpClient::call('localOcrStatus');
        } catch (PycoreRpcException $e) {
            return $e->payload();
        }
    }
}
