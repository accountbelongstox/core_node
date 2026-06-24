<?php

namespace App\Http\Controllers;

use App\Services\DeveloperHistory\DeveloperHistoryService;
use App\Services\DeveloperHistory\DevHistoryAssistService;
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
        $q = $request->query('q');
        $lang = $request->query('lang');
        $limit = (int) $request->query('limit', $request->query('pageSize', 50));
        $page = (int) $request->query('page', 0);
        $offset = $page > 0
            ? ($page - 1) * max(1, $limit)
            : (int) $request->query('offset', 0);
        $data = $service->readPrompts(
            is_string($tool) ? $tool : null,
            is_string($user) ? $user : null,
            $limit,
            $offset,
            is_string($q) ? $q : null,
            is_string($lang) ? $lang : null
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

    /**
     * Edit + save one prompt's text. Persisted to files (overlay + prompts.json
     * + session detail), never a database.
     */
    public function updatePrompt(Request $request): JsonResponse
    {
        $id = (string) $request->input('id', '');
        $text = (string) $request->input('text', '');
        if ($id === '') {
            return $this->error('Missing prompt id', 422);
        }
        $service = new DeveloperHistoryService();
        $result = $service->updatePrompt($id, $text);
        if ($result === null) {
            return $this->error("Invalid prompt id '{$id}'", 422);
        }
        return $this->success($result, 'Prompt updated');
    }

    /** Assist distribution: counts + recent translation-assist tasks. */
    public function assist(): JsonResponse
    {
        $assist = new DevHistoryAssistService();
        return $this->success([
            'summary' => $assist->summary(),
            'recent' => $assist->recent(50),
        ], 'Assist distribution');
    }

    /** Manually trigger an assist scan (enqueue pending non-English prompts). */
    public function assistScan(): JsonResponse
    {
        $enqueued = (new DevHistoryAssistService())->scanAndEnqueue();
        return $this->success(['enqueued' => $enqueued], 'Assist scan complete');
    }
}
