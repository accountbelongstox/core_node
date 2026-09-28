<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Dictionaries;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Validator;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TranslationTaskService;
use App\Traits\ApiResponse;

class AppQyV1DictionaryTaskController extends Controller
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
            return $this->error(__('app_qy_v1.messages.validation_failed') . $validator->errors()->first(), 422);
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

        return $this->success($result, __('app_qy_v1.messages.dictionary_explanation_task_created'));
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
            return $this->error(__('app_qy_v1.messages.validation_failed') . $validator->errors()->first(), 422);
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

        return $this->success($data, __('app_qy_v1.messages.untranslated_words_retrieved'));
    }
}
