<?php

namespace App\Apps\McpV1\McpV1Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\McpV1\McpV1Utils\ScreenshotService;
use App\Utils\FileSystemManager;

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
            $id = $request->input('id');
            $description = $request->input('description', '');
            $replace = filter_var($request->input('replace', false), FILTER_VALIDATE_BOOLEAN);
            $keywords = $this->normalizeKeywords($request->input('keywords', []));
            $imageDescriptions = $this->normalizeDescriptions($request->input('image_descriptions', []));

            $multiFiles = $request->file('images');
            if ($multiFiles) {
                $files = is_array($multiFiles) ? $multiFiles : [$multiFiles];
                if (count($files) > 1) {
                    return $this->handleMultiImageUpload(
                        $files,
                        $imageDescriptions,
                        $description,
                        $keywords,
                        $id,
                        $replace
                    );
                }

                if (!$request->hasFile('image') && isset($files[0])) {
                    $request->files->set('image', $files[0]);
                }
            }

            // Get uploaded file
            if (!$request->hasFile('image')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No image file provided'
                ], 400);
            }

            $uploadedFile = $request->file('image');
            $singleDescription = $description;
            if ($singleDescription === '' && !empty($imageDescriptions)) {
                $singleDescription = $imageDescriptions[0];
            }
            $result = $this->screenshotService->uploadScreenshot(
                $uploadedFile->getRealPath(),
                $id,
                $singleDescription,
                $keywords,
                $replace
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

        if (!FileSystemManager::exists($screenshot['file_path'])) {
            return response()->json([
                'success' => false,
                'error' => 'Screenshot file not found'
            ], 404);
        }

        $contents = FileSystemManager::readFile($screenshot['file_path']);

        if ($contents === false) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to read screenshot file'
            ], 500);
        }

        return response($contents, 200, [
            'Content-Type' => $screenshot['mime_type'],
            'Content-Disposition' => 'inline; filename="' . $screenshot['original_name'] . '"'
        ]);
    }

    /**
     * Stream screenshot file with extension in URL (for AI recognition)
     *
     * GET /api/mcp/v1/screenshots/{id}.jpg
     * GET /api/mcp/v1/screenshots/{id}.png
     *
     * @param string $id
     * @param string $ext
     * @return mixed
     */
    public function streamFileWithExt($id, $ext)
    {
        // Just call the existing streamFile method - the extension is for URL recognition only
        return $this->streamFile($id);
    }

    /**
     * Upload multiple screenshots and merge them into one image
     *
     * POST /api/mcp/v1/screenshots/upload-merge
     *
     * Request body:
     * - images[]: Array of image files
     * - descriptions[]: Array of descriptions (optional, same index as images)
     * - keyword: Common keyword for the merged image
     * - id: Custom ID (optional)
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadAndMerge(Request $request): JsonResponse
    {
        try {
            // Check for uploaded files
            if (!$request->hasFile('images')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No image files provided. Use images[] field for multiple files.'
                ], 400);
            }

            $uploadedFiles = $request->file('images');
            if (!is_array($uploadedFiles)) {
                $uploadedFiles = [$uploadedFiles];
            }

            if (count($uploadedFiles) < 1) {
                return response()->json([
                    'success' => false,
                    'error' => 'At least 1 image is required'
                ], 400);
            }

            // Get descriptions array
            $descriptions = $request->input('descriptions', []);
            if (is_string($descriptions)) {
                $descriptions = json_decode($descriptions, true) ?: [];
            }

            // Get keyword and optional ID
            $keyword = $request->input('keyword', '');
            $id = $request->input('id');
            $replace = filter_var($request->input('replace', false), FILTER_VALIDATE_BOOLEAN);

            // Collect file paths
            $filePaths = [];
            foreach ($uploadedFiles as $file) {
                $filePaths[] = $file->getRealPath();
            }

            // Call service to merge and upload
            $result = $this->screenshotService->uploadAndMerge($filePaths, $descriptions, $keyword, $id, $replace);

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Images merged and uploaded successfully',
                'data' => $result['screenshot']
            ]);

        } catch (\Exception $e) {
            error_log('[McpV1ScreenshotCtl] Upload merge error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Upload merge failed: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Upload multiple screenshots individually (batch upload without merge)
     *
     * POST /api/mcp/v1/screenshots/upload-batch
     *
     * Request body:
     * - images[]: Array of image files
     * - descriptions[]: Array of descriptions (optional)
     * - keyword: Common keyword for all images
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function uploadBatch(Request $request): JsonResponse
    {
        try {
            // Check for uploaded files
            if (!$request->hasFile('images')) {
                return response()->json([
                    'success' => false,
                    'error' => 'No image files provided. Use images[] field for multiple files.'
                ], 400);
            }

            $uploadedFiles = $request->file('images');
            if (!is_array($uploadedFiles)) {
                $uploadedFiles = [$uploadedFiles];
            }

            // Get descriptions array
            $descriptions = $request->input('descriptions', []);
            if (is_string($descriptions)) {
                $descriptions = json_decode($descriptions, true) ?: [];
            }

            // Get keyword
            $keyword = $request->input('keyword', '');

            // Collect file paths
            $filePaths = [];
            foreach ($uploadedFiles as $file) {
                $filePaths[] = $file->getRealPath();
            }

            // Call service to batch upload
            $result = $this->screenshotService->uploadBatch($filePaths, $descriptions, $keyword);

            $statusCode = $result['success'] ? 200 : 207; // 207 Multi-Status if partial success

            return response()->json([
                'success' => $result['success'],
                'message' => sprintf(
                    'Batch upload completed: %d/%d successful',
                    $result['success_count'],
                    $result['total']
                ),
                'data' => $result
            ], $statusCode);

        } catch (\Exception $e) {
            error_log('[McpV1ScreenshotCtl] Batch upload error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Batch upload failed: ' . $e->getMessage()
            ], 500);
        }
    }

    private function handleMultiImageUpload(array $files, array $imageDescriptions, string $summaryDescription, array $keywords, ?string $id, bool $replace): JsonResponse
    {
        $filePaths = [];
        foreach ($files as $file) {
            if ($file && method_exists($file, 'getRealPath')) {
                $filePaths[] = $file->getRealPath();
            }
        }

        if (empty($filePaths)) {
            return response()->json([
                'success' => false,
                'error' => 'No valid image files provided'
            ], 400);
        }

        $customDescriptions = [];
        foreach ($filePaths as $index => $_path) {
            $customDescriptions[$index] = $imageDescriptions[$index] ?? '';
        }

        $displayDescriptions = [];
        foreach ($filePaths as $index => $_path) {
            $label = 'Screenshot ' . ($index + 1);
            $customText = trim($customDescriptions[$index] ?? '');
            if ($customText !== '') {
                $label .= ' - ' . $customText;
            }
            $displayDescriptions[$index] = $label;
        }

        $options = [
            'image_options' => [
                'maxImageWidth' => 1080,
                'fontSize' => 36,
                'titleHeight' => 110,
                'padding' => 32
            ],
            'original_descriptions' => $customDescriptions,
            'summary_description' => $summaryDescription
        ];

        $keywordString = empty($keywords) ? '' : implode(',', $keywords);

        $result = $this->screenshotService->uploadAndMerge(
            $filePaths,
            $displayDescriptions,
            $keywordString,
            $id,
            $replace,
            $options
        );

        if (!$result['success']) {
            return response()->json($result, 400);
        }

        return response()->json([
            'success' => true,
            'data' => $result['screenshot']
        ]);
    }

    private function normalizeKeywords($input): array
    {
        if (is_array($input)) {
            return array_values(array_filter(array_map('trim', $input)));
        }

        if (is_string($input)) {
            $decoded = json_decode($input, true);
            if (is_array($decoded)) {
                return array_values(array_filter(array_map('trim', $decoded)));
            }

            return array_values(array_filter(array_map('trim', explode(',', $input))));
        }

        return [];
    }

    private function normalizeDescriptions($input): array
    {
        if (is_array($input)) {
            return array_map(function ($value) {
                return trim((string) $value);
            }, $input);
        }

        if (is_string($input) && $input !== '') {
            return [trim($input)];
        }

        return [];
    }
}
