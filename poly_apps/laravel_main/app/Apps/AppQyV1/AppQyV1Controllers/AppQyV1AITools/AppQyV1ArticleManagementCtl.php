<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1ArticleManagementService;
use App\Helpers\AuthHelper;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AppQyV1ArticleManagementCtl
{
    use ApiResponse;

    private AppQyV1ArticleManagementService $articleManagementService;

    public function __construct(AppQyV1ArticleManagementService $articleManagementService)
    {
        $this->articleManagementService = $articleManagementService;
    }

    public function index(Request $request): JsonResponse
    {
        $limit = 0;
        $offset = 0;
        $category = null;
        $data = [];

        $limit = (int) $request->input('limit', 50);
        $offset = (int) $request->input('offset', 0);
        $category = $request->filled('category') ? (string) $request->input('category') : null;
        $data = $this->articleManagementService->list($limit, $offset, $category);

        return $this->success($data, 'Articles loaded');
    }

    public function destroy(Request $request, string $articleId): JsonResponse
    {
        $user = null;
        $errorType = null;
        $result = null;

        $user = AuthHelper::requireAdmin($request);
        if ($user === null) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            return $errorType === 'unauthorized' ? $this->unauthorized() : $this->forbidden();
        }

        $result = $this->articleManagementService->delete($articleId);
        if ($result === null) {
            return $this->notFound('Article not found.');
        }

        return $this->success($result, 'Article deleted');
    }

    public function destroyMany(Request $request): JsonResponse
    {
        $user = null;
        $errorType = null;
        $validator = null;
        $articleIds = [];
        $deleted = [];

        $user = AuthHelper::requireAdmin($request);
        if ($user === null) {
            $errorType = AuthHelper::getAuthErrorType($request, true);
            return $errorType === 'unauthorized' ? $this->unauthorized() : $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'article_ids' => 'required|array|min:1|max:100',
            'article_ids.*' => 'required|string|max:255',
        ]);
        if ($validator->fails()) {
            return $this->validationError($validator->errors());
        }

        $articleIds = array_values(array_unique($request->input('article_ids')));
        foreach ($articleIds as $articleId) {
            $result = $this->articleManagementService->delete($articleId);
            if ($result !== null) {
                $deleted[] = $result;
            }
        }

        return $this->success([
            'deleted' => $deleted,
            'deleted_count' => count($deleted),
        ], 'Articles deleted');
    }
}
