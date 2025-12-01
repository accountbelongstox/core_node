<?php

namespace App\Http\EnvironmentApiInfo;

use App\Services\OctaneTaskStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OctaneTaskController
{
    private OctaneTaskStatusService $taskStatusService;

    public function __construct()
    {
        $this->taskStatusService = new OctaneTaskStatusService();
    }

    /**
     * Get all tasks status
     */
    public function getAllStatus(): JsonResponse
    {
        try {
            $status = $this->taskStatusService->getAllTasksStatus();

            return response()->json([
                'success' => true,
                'data' => $status,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get specific task detail
     */
    public function getTaskDetail(string $taskName): JsonResponse
    {
        try {
            $detail = $this->taskStatusService->getTaskDetail($taskName);

            if (!$detail) {
                return response()->json([
                    'success' => false,
                    'error' => 'Task not found',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $detail,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get basic task objects
     */
    public function getBasicObjects(): JsonResponse
    {
        try {
            $tasks = $this->taskStatusService->getBasicTaskObjects();

            return response()->json([
                'success' => true,
                'data' => $tasks,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verify initialization
     */
    public function verifyInitialization(): JsonResponse
    {
        try {
            $verification = $this->taskStatusService->verifyInitialization();

            return response()->json([
                'success' => true,
                'data' => $verification,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
