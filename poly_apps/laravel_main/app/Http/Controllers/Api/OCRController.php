<?php

namespace App\Http\Controllers\Api;

use App\Services\PycoreTasks\PycoreTaskQueue;
use App\Http\Controllers\Controller;
use App\Services\PycoreTasks\OcrRecognizeTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

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
            'model_type' => ['sometimes', 'string', Rule::in(OcrRecognizeTask::MODEL_TYPES)],
            'client_task_id' => PycoreTaskQueue::CLIENT_TASK_ID_RULE,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $imagePath = $request->input('image_path');
        $modelType = $request->input('model_type', OcrRecognizeTask::DEFAULT_MODEL_TYPE);

        Log::info('OCR API: recognize request', [
            'image_path' => $imagePath,
            'model_type' => $modelType
        ]);

        $result = OcrRecognizeTask::recognizeImage($imagePath, $modelType, [], PycoreTaskQueue::clientTaskId($request));

        return PycoreTaskQueue::response($result) ?? response()->json($result);
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
            'model_type' => ['sometimes', 'string', Rule::in(OcrRecognizeTask::MODEL_TYPES)],
            'client_task_id' => PycoreTaskQueue::CLIENT_TASK_ID_RULE,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $imagePaths = $request->input('image_paths');
        $modelType = $request->input('model_type', OcrRecognizeTask::DEFAULT_MODEL_TYPE);

        Log::info('OCR API: batch recognize request', [
            'image_count' => count($imagePaths),
            'model_type' => $modelType
        ]);

        $result = OcrRecognizeTask::recognizeBatch($imagePaths, $modelType, PycoreTaskQueue::clientTaskId($request));

        return PycoreTaskQueue::response($result) ?? response()->json($result);
    }

    /**
     * Get available OCR models
     *
     * GET /api/ocr/models
     */
    public function getModels(): JsonResponse
    {
        return response()->json(OcrRecognizeTask::describe());
    }

    /**
     * Get OCR engine information
     *
     * GET /api/ocr/engine-info
     */
    public function getEngineInfo(): JsonResponse
    {
        return response()->json(OcrRecognizeTask::describe());
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
