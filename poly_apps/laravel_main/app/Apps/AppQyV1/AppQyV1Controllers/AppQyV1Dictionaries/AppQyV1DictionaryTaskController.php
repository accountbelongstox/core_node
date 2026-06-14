<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;
use App\Traits\ApiResponse;

class AppQyV1DictionaryTaskController extends BaseController
{
    use ApiResponse;

    private $taskService;

    public function __construct(AppQyV1TranslationTaskService $taskService)
    {
        $this->taskService = $taskService;
    }

    /**
     * Create dictionary explanation task
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createExplanationTask(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'language' => 'nullable|string|in:english,spanish,french,german,chinese',
            'limit' => 'nullable|integer|min:1|max:500',
            'is_demo_mode' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $language = 'english';
        if ($request->has('language')) {
            $language = $request->input('language');
        }

        $limit = 50;
        if ($request->has('limit')) {
            $limit = $request->input('limit');
        }

        $isDemoMode = false;
        if ($request->has('is_demo_mode')) {
            $isDemoMode = $request->input('is_demo_mode');
        }

        $result = $this->taskService->createDictionaryExplanationTask(
            $language,
            $limit,
            $isDemoMode
        );

        if ($result['status'] === 'no_words_needed') {
            return $this->success($result, $result['message']);
        }

        return $this->success($result, 'Dictionary explanation task created');
    }

    /**
     * Get untranslated words count
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUntranslatedWordsCount(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'limit' => 'nullable|integer|min:1|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed: ' . $validator->errors()->first(), 422);
        }

        $limit = 100;
        if ($request->has('limit')) {
            $limit = $request->input('limit');
        }

        $words = $this->taskService->getUntranslatedWords($limit);

        $data = [
            'count' => count($words),
            'limit' => $limit,
            'words' => $words
        ];

        return $this->success($data, 'Untranslated words retrieved');
    }
}
