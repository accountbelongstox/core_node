<?php

namespace App\Apps\McpV1\McpV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\McpV1\McpV1Utils\ScreenshotService;

/**
 * MCP Screenshot Controller (McpV1)
 *
 * Provides MCP and Web API endpoints for screenshot management
 * Following Laravel 12.x MCP specifications
 *
 * @see https://laravel.com/docs/12.x/mcp
 */
class McpV1ScreenshotCtl
{
    private $screenshotService;

    public function __construct()
    {
        $this->screenshotService = new ScreenshotService();
    }

    /**
     * Upload a screenshot
     *
     * POST /api/mcp/v1/screenshots/upload
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function upload(Request $request): JsonResponse
    {
        try {
            // Get uploaded file
            if (!$request->hasFile('image')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No image file provided'
                ], 400);
            }

            $uploadedFile = $request->file('image');
            $id = $request->input('id');
            $description = $request->input('description', '');
            $keywords = $request->input('keywords', []);

            // Parse keywords if string
            if (is_string($keywords)) {
                $keywords = array_filter(array_map('trim', explode(',', $keywords)));
            }

            // Upload screenshot
            $result = $this->screenshotService->uploadScreenshot(
                $uploadedFile->getRealPath(),
                $id,
                $description,
                $keywords
            );

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json([
                'success' => true,
                'data' => $result['screenshot']
            ]);

        } catch (\Exception $e) {
            error_log('[McpV1ScreenshotCtl] Upload error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Upload failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get the latest screenshot
     *
     * GET /api/mcp/v1/screenshots/latest
     *
     * @return JsonResponse
     */
    public function getLatest(): JsonResponse
    {
        $screenshot = $this->screenshotService->getLatest();

        if ($screenshot === null) {
            return response()->json([
                'success' => false,
                'error' => 'No screenshots found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $screenshot
        ]);
    }

    /**
     * Get screenshot by ID
     *
     * GET /api/mcp/v1/screenshots/{id}
     *
     * @param string $id
     * @return JsonResponse
     */
    public function getById($id): JsonResponse
    {
        $screenshot = $this->screenshotService->getById($id);

        if ($screenshot === null) {
            return response()->json([
                'success' => false,
                'error' => 'Screenshot not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $screenshot
        ]);
    }

    /**
     * Search screenshots by keyword
     *
     * GET /api/mcp/v1/screenshots/search?keyword={keyword}
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function search(Request $request): JsonResponse
    {
        $keyword = $request->input('keyword', '');

        if (empty($keyword)) {
            return response()->json([
                'success' => false,
                'error' => 'Keyword parameter is required'
            ], 400);
        }

        $results = $this->screenshotService->searchByKeyword($keyword);

        return response()->json([
            'success' => true,
            'data' => [
                'keyword' => $keyword,
                'count' => count($results),
                'screenshots' => $results
            ]
        ]);
    }

    /**
     * Get all screenshots
     *
     * GET /api/mcp/v1/screenshots
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getAll(Request $request): JsonResponse
    {
        $limit = $request->input('limit');
        $offset = $request->input('offset', 0);

        $screenshots = $this->screenshotService->getAll($limit, $offset);

        return response()->json([
            'success' => true,
            'data' => [
                'count' => count($screenshots),
                'screenshots' => $screenshots
            ]
        ]);
    }

    /**
     * Delete screenshot by ID
     *
     * DELETE /api/mcp/v1/screenshots/{id}
     *
     * @param string $id
     * @return JsonResponse
     */
    public function delete($id): JsonResponse
    {
        $result = $this->screenshotService->delete($id);

        if (!$result) {
            return response()->json([
                'success' => false,
                'error' => 'Screenshot not found'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Screenshot deleted successfully'
        ]);
    }

    /**
     * Clear all screenshots
     *
     * DELETE /api/mcp/v1/screenshots/clear-all
     *
     * @return JsonResponse
     */
    public function clearAll(): JsonResponse
    {
        $result = $this->screenshotService->clearAll();

        return response()->json([
            'success' => true,
            'message' => 'All screenshots cleared',
            'deleted_count' => $result['deleted_count']
        ]);
    }

    /**
     * Get statistics
     *
     * GET /api/mcp/v1/screenshots/stats
     *
     * @return JsonResponse
     */
    public function getStats(): JsonResponse
    {
        $stats = $this->screenshotService->getStats();

        return response()->json([
            'success' => true,
            'data' => $stats
        ]);
    }

    /**
     * Stream screenshot file
     *
     * GET /api/mcp/v1/screenshots/{id}/file
     *
     * @param string $id
     * @return mixed
     */
    public function streamFile($id)
    {
        $screenshot = $this->screenshotService->getById($id);

        if ($screenshot === null) {
            return response()->json([
                'success' => false,
                'error' => 'Screenshot not found'
            ], 404);
        }

        if (!file_exists($screenshot['file_path'])) {
            return response()->json([
                'success' => false,
                'error' => 'Screenshot file not found'
            ], 404);
        }

        return response()->file($screenshot['file_path'], [
            'Content-Type' => $screenshot['mime_type'],
            'Content-Disposition' => 'inline; filename="' . $screenshot['original_name'] . '"'
        ]);
    }
}
