<?php

namespace App\Http\Controllers;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1DailySentenceService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Daily short-sentence center — read API for the wordnew daily-reading view.
 * Serves pycore-assisted prompt translations (English + variants + audio).
 *
 * @deprecated Prefer /api/app_qy_v1/ai_tools/article/list?type=short and
 *             /api/app_qy_v1/ai_tools/article/recommend?type=short. This
 *             controller remains as a thin wrapper over the same service.
 */
class AppQyV1DailySentenceController extends Controller
{
    use ApiResponse;

    private const DEPRECATED_NOTICE = 'Deprecated: use GET /api/app_qy_v1/ai_tools/article/list?type=short (and /recommend?type=short).';

    public function list(Request $request): JsonResponse
    {
        $limit = (int) $request->query('limit', $request->query('pageSize', 50));
        $page = (int) $request->query('page', 0);
        $offset = $page > 0 ? ($page - 1) * max(1, $limit) : (int) $request->query('offset', 0);
        $data = (new AppQyV1DailySentenceService())->list($limit, $offset);
        $data['deprecated_notice'] = self::DEPRECATED_NOTICE;
        return $this->success($data, 'Daily sentences');
    }

    public function recommend(): JsonResponse
    {
        $item = (new AppQyV1DailySentenceService())->recommend();
        return $this->success([
            'item' => $item,
            'deprecated_notice' => self::DEPRECATED_NOTICE,
        ], 'Daily sentence recommendation');
    }

    /** Stream the stored TTS audio for a daily sentence. */
    public function audio(string $id)
    {
        $path = (new AppQyV1DailySentenceService())->audioFile($id);
        if (!is_file($path)) {
            return $this->notFound('Audio not found');
        }
        return response()->file($path, [
            'Content-Type' => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
