<?php

namespace App\Apps\McpV1\McpV1Controllers;

use App\Http\Controllers\Controller;
use App\Apps\McpV1\McpV1Utils\TaskCategoryService;
use App\Apps\McpV1\McpV1Utils\TaskQueueService;
use App\Apps\McpV1\McpV1Utils\PromptMappingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * McpV1 Task Dispatch Controller
 *
 * Handles task dispatch and queue management for MCP bridge
 * Supports both MCP (Model Context Protocol) and web query interfaces
 *
 * Following Laravel 12.x MCP specifications
 * @see https://laravel.com/docs/12.x/mcp
 *
 * MCP Endpoints: /api/mcp/v1/task-dispatch/*
 * Web Endpoints: /api/mcp/v1/task-dispatch/* (same)
 */
class McpV1TaskDispatchCtl extends Controller
{
    private $categoryService;
    private $queueService;
    private $mappingService;

    public function __construct()
    {
        $this->categoryService = new TaskCategoryService();
        $this->queueService = new TaskQueueService();
        $this->mappingService = new PromptMappingService();
    }

    /**
     * Get all task categories
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/categories
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getCategories(Request $request): JsonResponse
    {
        Log::info('McpV1: Get task categories');

        try {
            $categories = $this->categoryService->getAllCategories();

            return response()->json([
                'success' => true,
                'data' => [
                    'categories' => $categories,
                    'total' => count($categories)
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get categories', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve categories',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get files in a specific category
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/categories/{categoryId}/files
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function getCategoryFiles(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Get category files', ['category' => $categoryId]);

        try {
            $files = $this->categoryService->getCategoryFiles($categoryId);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'files' => $files,
                    'total' => count($files)
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get category files', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve category files',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Create a new task category
     *
     * MCP & Web: POST /api/mcp/v1/task-dispatch/categories
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function createCategory(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id' => 'required|string|max:50|regex:/^[a-z0-9-]+$/',
            'name' => 'required|string|max:100',
            'path' => 'required|string|max:200'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $id = $request->input('id');
        $name = $request->input('name');
        $path = $request->input('path');

        Log::info('McpV1: Create category', [
            'id' => $id,
            'name' => $name,
            'path' => $path
        ]);

        try {
            $result = $this->categoryService->createCategory($id, $name, $path);

            if (!$result['success']) {
                return response()->json($result, 400);
            }

            return response()->json([
                'success' => true,
                'data' => $result['category'],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to create category', [
                'id' => $id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to create category',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Add file content to task queue
     *
     * MCP & Web: POST /api/mcp/v1/task-dispatch/queue/add-file
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function addFileToQueue(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'category_id' => 'required|string',
            'file_path' => 'required|string',
            'content' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $categoryId = $request->input('category_id');
        $filePath = $request->input('file_path');
        $content = $request->input('content');

        Log::info('McpV1: Add file to queue', [
            'category' => $categoryId,
            'file' => $filePath
        ]);

        try {
            $result = $this->queueService->addFileToQueue($categoryId, $filePath, $content);

            return response()->json([
                'success' => true,
                'data' => $result,
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to add file to queue', [
                'category' => $categoryId,
                'file' => $filePath,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to add file to queue',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get all tasks for a category
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function getTasks(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Get tasks', ['category' => $categoryId]);

        try {
            $tasks = $this->queueService->getAllTasks($categoryId);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'tasks' => $tasks,
                    'total' => count($tasks)
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get tasks', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve tasks',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get the latest task for a category
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/queue/{categoryId}/last-task
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function getLastTask(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Get last task', ['category' => $categoryId]);

        try {
            $task = $this->queueService->getLastTask($categoryId);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'task' => $task
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get last task', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve last task',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Check if category has latest task
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/queue/{categoryId}/has-latest
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function hasLatestTask(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Check has latest task', ['category' => $categoryId]);

        try {
            $has = $this->queueService->hasLatestTask($categoryId);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'has_latest' => $has
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to check has latest task', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to check latest task',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Search tasks by keyword
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/queue/{categoryId}/search
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function searchTasks(Request $request, string $categoryId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'keyword' => 'required|string|min:1'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $keyword = $request->input('keyword');

        Log::info('McpV1: Search tasks', [
            'category' => $categoryId,
            'keyword' => $keyword
        ]);

        try {
            $tasks = $this->queueService->searchTasksByKeyword($categoryId, $keyword);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'keyword' => $keyword,
                    'tasks' => $tasks,
                    'total' => count($tasks)
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to search tasks', [
                'category' => $categoryId,
                'keyword' => $keyword,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to search tasks',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Update task status
     *
     * MCP & Web: PUT /api/mcp/v1/task-dispatch/queue/{categoryId}/tasks/{taskId}/status
     *
     * @param Request $request
     * @param string $categoryId
     * @param string $taskId
     * @return JsonResponse
     */
    public function updateTaskStatus(Request $request, string $categoryId, string $taskId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:pending,in_progress,completed,failed'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => 'Validation failed',
                'details' => $validator->errors()
            ], 400);
        }

        $status = $request->input('status');

        Log::info('McpV1: Update task status', [
            'category' => $categoryId,
            'task' => $taskId,
            'status' => $status
        ]);

        try {
            $result = $this->queueService->updateTaskStatus($categoryId, $taskId, $status);

            return response()->json([
                'success' => true,
                'data' => $result,
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to update task status', [
                'category' => $categoryId,
                'task' => $taskId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to update task status',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get queue statistics
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/queue/{categoryId}/stats
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function getQueueStats(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Get queue stats', ['category' => $categoryId]);

        try {
            $stats = $this->queueService->getQueueStats($categoryId);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'stats' => $stats
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get queue stats', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve queue statistics',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get all prompt mappings
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/mappings
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getAllMappings(Request $request): JsonResponse
    {
        Log::info('McpV1: Get all prompt mappings');

        try {
            $mappings = $this->mappingService->getAllMappings();

            return response()->json([
                'success' => true,
                'data' => [
                    'mappings' => $mappings,
                    'total' => count($mappings)
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get mappings', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve prompt mappings',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Get mapping for specific category
     *
     * MCP & Web: GET /api/mcp/v1/task-dispatch/mappings/{categoryId}
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function getCategoryMapping(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Get category mapping', ['category' => $categoryId]);

        try {
            $mapping = $this->mappingService->getCategoryMapping($categoryId);

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'mapping' => $mapping
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to get category mapping', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to retrieve category mapping',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Update mapping for specific category
     *
     * MCP & Web: PUT /api/mcp/v1/task-dispatch/mappings/{categoryId}
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function updateCategoryMapping(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Update category mapping', [
            'category' => $categoryId,
            'input' => $request->all()
        ]);

        try {
            $validator = Validator::make($request->all(), [
                'prefix' => 'nullable|string',
                'suffix' => 'nullable|string',
                'replace_map' => 'nullable|array'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'error' => 'Validation failed',
                    'details' => $validator->errors()
                ], 400);
            }

            $prefix = $request->input('prefix', '');
            $suffix = $request->input('suffix', '');
            $replaceMap = $request->input('replace_map', []);

            $result = $this->mappingService->updateCategoryMapping(
                $categoryId,
                $prefix,
                $suffix,
                $replaceMap
            );

            return response()->json([
                'success' => true,
                'data' => $result,
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to update category mapping', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to update category mapping',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Reset mapping to default
     *
     * MCP & Web: POST /api/mcp/v1/task-dispatch/mappings/{categoryId}/reset
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function resetCategoryMapping(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Reset category mapping', ['category' => $categoryId]);

        try {
            $result = $this->mappingService->resetCategoryMapping($categoryId);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'] ?? 'Failed to reset mapping'
                ], 400);
            }

            return response()->json([
                'success' => true,
                'data' => $result,
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to reset category mapping', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to reset category mapping',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }

    /**
     * Delete mapping for specific category
     *
     * MCP & Web: DELETE /api/mcp/v1/task-dispatch/mappings/{categoryId}
     *
     * @param Request $request
     * @param string $categoryId
     * @return JsonResponse
     */
    public function deleteCategoryMapping(Request $request, string $categoryId): JsonResponse
    {
        Log::info('McpV1: Delete category mapping', ['category' => $categoryId]);

        try {
            $result = $this->mappingService->deleteCategoryMapping($categoryId);

            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'error' => $result['error'] ?? 'Failed to delete mapping'
                ], 400);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'category_id' => $categoryId,
                    'deleted' => true
                ],
                'meta' => [
                    'mcp_compatible' => true,
                    'timestamp' => now()->toIso8601String()
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('McpV1: Failed to delete category mapping', [
                'category' => $categoryId,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Failed to delete category mapping',
                'details' => config('app.debug') ? $e->getMessage() : null
            ], 500);
        }
    }
}
