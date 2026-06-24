<?php

namespace App\Http\Controllers;

use App\Services\DeveloperHistory\DeveloperHistoryService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Developer AI-tool History Controller (read-only, localhost-only).
 *
 * Serves the extracted Claude/Codex/Gemini/Cursor prompt + session history that
 * DeveloperHistoryService stores under the mapped laravel_db data dir.
 */
class DevHistoryController extends Controller
{
    use ApiResponse;

    public function index(): JsonResponse
    {
        $service = new DeveloperHistoryService();
        return $this->success($service->readIndex(), 'Developer history index');
    }

    public function prompts(Request $request): JsonResponse
    {
        $service = new DeveloperHistoryService();
        $tool = $request->query('tool');
        $user = $request->query('user');
        $limit = (int) $request->query('limit', 500);
        $offset = (int) $request->query('offset', 0);
        $data = $service->readPrompts(
            is_string($tool) ? $tool : null,
            is_string($user) ? $user : null,
            $limit,
            $offset
        );
        return $this->success($data, 'Developer prompt history');
    }

    public function session(string $id): JsonResponse
    {
        $service = new DeveloperHistoryService();
        $detail = $service->readSession($id);
        if ($detail === null) {
            return $this->notFound("Session '{$id}' not found");
        }
        return $this->success($detail, 'Session detail');
    }

    public function refresh(): JsonResponse
    {
        $service = new DeveloperHistoryService();
        $result = $service->extract(true);
        return $this->success($result, 'Developer history refreshed');
    }
}
