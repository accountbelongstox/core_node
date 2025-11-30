<?php

namespace App\Apps\McpV1\McpV1Controllers;

use App\Http\Controllers\Controller;
use App\Utils\OCRUtil;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * McpV1 OCR Controller
 *
 * Handles OCR (Optical Character Recognition) requests for MCP bridge.
 */
class McpV1OCRCtl extends Controller
{
    /**
     * Recognize text from image
     *
     * POST /api/mcp/v1/ocr/recognize
     */
    public function recognize(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image_path' => 'required|string',
            'model_type' => 'sometimes|string|in:general,scene,doc,number,english,chinese_traditional',
            'engine' => 'sometimes|string|in:free,paddle,cnocr'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $imagePath = $request->input('image_path');
        $modelType = $request->input('model_type', 'general');

        Log::info('McpV1: OCR recognize', [
            'path' => $imagePath,
            'model' => $modelType
        ]);

        $result = OCRUtil::recognizeImage($imagePath, $modelType);

        return response()->json($result);
    }

    /**
     * Smart OCR with automatic file handling
     *
     * POST /api/mcp/v1/ocr/smart-recognize
     */
    public function smartRecognize(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file_path' => 'required|string',
            'content_type' => 'sometimes|string',
            'priority' => 'sometimes|string|in:high,normal,low'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $filePath = $request->input('file_path');
        $contentType = $request->input('content_type', 'general');

        // Determine best model based on content type
        $modelType = $this->selectModelForContent($contentType);

        $result = OCRUtil::recognizeImage($filePath, $modelType);

        // Add metadata
        $result['metadata'] = [
            'content_type' => $contentType,
            'model_selected' => $modelType,
            'processing_method' => 'smart_recognition'
        ];

        return response()->json($result);
    }

    /**
     * Batch OCR processing
     *
     * POST /api/mcp/v1/ocr/batch
     */
    public function batch(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image_paths' => 'required|array',
            'image_paths.*' => 'string',
            'model_type' => 'sometimes|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $imagePaths = $request->input('image_paths');
        $modelType = $request->input('model_type', 'general');

        Log::info('McpV1: Batch OCR', [
            'count' => count($imagePaths),
            'model' => $modelType
        ]);

        $result = OCRUtil::recognizeBatch($imagePaths, $modelType);

        return response()->json($result);
    }

    /**
     * Get available OCR engines
     *
     * GET /api/mcp/v1/ocr/engines
     */
    public function getEngines(): JsonResponse
    {
        $models = OCRUtil::getAvailableModels();

        return response()->json([
            'success' => true,
            'engines' => $models
        ]);
    }

    /**
     * Get OCR engine information
     *
     * GET /api/mcp/v1/ocr/engine-info
     */
    public function getEngineInfo(Request $request): JsonResponse
    {
        $modelType = $request->query('model_type');

        $result = OCRUtil::getEngineInfo($modelType);

        return response()->json($result);
    }

    /**
     * Select best model for content type
     *
     * @param string $contentType
     * @return string
     */
    private function selectModelForContent(string $contentType): string
    {
        return match($contentType) {
            'chinese_text' => 'general',
            'english_text' => 'english',
            'document_scan' => 'doc',
            'handwriting' => 'scene',
            'receipt' => 'doc',
            'number' => 'number',
            default => 'general'
        };
    }
}
