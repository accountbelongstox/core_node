<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1EstimateService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1PublicHomeService;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CodeMartV1PublicHomeCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly CodeMartV1PublicHomeService $publicHomeService,
        private readonly CodeMartV1EstimateService $estimateService,
    ) {
    }

    public function getHome(Request $request): JsonResponse
    {
        return $this->success($this->publicHomeService->getHome(CodeMartV1PublicHomeService::resolveLocale($request)));
    }

    /**
     * Redacted public showcase: open marketplace work and completed projects,
     * without client identity.
     */
    public function showcase(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->query('page', 1));
        $pageSize = min(
            CodeMartV1Constants::MAX_PAGE_SIZE,
            max(1, (int) $request->query('page_size', CodeMartV1Constants::DEFAULT_PAGE_SIZE))
        );

        return $this->success($this->publicHomeService->showcase($page, $pageSize));
    }

    public function contact(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'email' => 'required|email|max:255',
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string|min:5|max:5000',
        ]);

        if ($validator->fails()) {
            return $this->errorWithCode(
                CodeMartV1Constants::ERROR_VALIDATION_FAILED,
                'Validation failed',
                422,
                $validator->errors()
            );
        }

        return $this->success(
            $this->publicHomeService->submitContactMessage($validator->validated()),
            'Message received',
            201
        );
    }

    /**
     * Public server-calculated project estimate. No bearer token; policy and
     * rates are server-owned, so the browser never derives pricing locally.
     */
    public function estimate(Request $request): JsonResponse
    {
        $options = $this->estimateService->defaults();
        $validator = Validator::make($request->all(), [
            'complexity' => ['required', Rule::in($options['complexities'])],
            'platforms' => 'nullable|integer|min:' . CodeMartV1EstimateService::MIN_PLATFORMS . '|max:' . CodeMartV1EstimateService::MAX_PLATFORMS,
            'features' => 'nullable|integer|min:' . CodeMartV1EstimateService::MIN_FEATURES . '|max:' . CodeMartV1EstimateService::MAX_FEATURES,
            'budget_type' => ['nullable', Rule::in($options['budget_types'])],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        return $this->success($this->estimateService->estimate([
            'complexity' => (string) $request->input('complexity'),
            'platforms' => (int) $request->input('platforms', CodeMartV1EstimateService::DEFAULT_PLATFORMS),
            'features' => (int) $request->input('features', CodeMartV1EstimateService::DEFAULT_FEATURES),
            'budget_type' => (string) $request->input('budget_type', CodeMartV1Constants::BUDGET_TYPE_FIXED),
        ]));
    }

    public function estimateOptions(): JsonResponse
    {
        return $this->success($this->estimateService->defaults());
    }
}
