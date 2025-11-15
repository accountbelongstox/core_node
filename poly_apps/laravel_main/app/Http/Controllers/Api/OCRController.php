<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Utils\OCRUtil;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * OCR API Controller
 *
 * Provides OCR (Optical Character Recognition) endpoints for MCP bridge.
 * All endpoints return JSON responses compatible with MCP protocol.
 */
class OCRController extends Controller
{
    /**
     * Recognize text from single image
     *
     * POST /api/ocr/recognize
     * Body: {
     *   "image_path": "/absolute/path/to/image.jpg",
     *   "model_type": "general"
     * }
     */
    public function recognize(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image_path' => 'required|string',
            'model_type' => 'sometimes|string|in:general,scene,doc,number,english,chinese_traditional'
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

        Log::info('OCR API: recognize request', [
            'image_path' => $imagePath,
            'model_type' => $modelType
        ]);

        $result = OCRUtil::recognizeImage($imagePath, $modelType);

        return response()->json($result);
    }

    /**
     * Recognize text from multiple images (batch)
     *
     * POST /api/ocr/recognize-batch
     * Body: {
     *   "image_paths": ["/path/1.jpg", "/path/2.jpg"],
     *   "model_type": "general"
     * }
     */
    public function recognizeBatch(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'image_paths' => 'required|array',
            'image_paths.*' => 'required|string',
            'model_type' => 'sometimes|string|in:general,scene,doc,number,english,chinese_traditional'
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

        Log::info('OCR API: batch recognize request', [
            'image_count' => count($imagePaths),
            'model_type' => $modelType
        ]);

        $result = OCRUtil::recognizeBatch($imagePaths, $modelType);

        return response()->json($result);
    }

    /**
     * Get available OCR models
     *
     * GET /api/ocr/models
     */
    public function getModels(): JsonResponse
    {
        $result = OCRUtil::getAvailableModels();
        return response()->json($result);
    }

    /**
     * Get OCR engine information
     *
     * GET /api/ocr/engine-info
     * Query: ?model_type=doc
     */
    public function getEngineInfo(Request $request): JsonResponse
    {
        $modelType = $request->query('model_type');

        $result = OCRUtil::getEngineInfo($modelType);

        return response()->json($result);
    }

    /**
     * Health check endpoint
     *
     * GET /api/ocr/health
     */
    public function health(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'service' => 'OCR API',
            'status' => 'healthy',
            'timestamp' => now()->toIso8601String()
        ]);
    }
}
