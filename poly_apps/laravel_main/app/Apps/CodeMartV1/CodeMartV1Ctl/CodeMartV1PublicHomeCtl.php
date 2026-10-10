<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1Pagination;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1EstimateService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService;
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
        [$page, $pageSize] = CodeMartV1Pagination::params($request);

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
                __('codemart.messages.validation_failed'),
                422,
                $validator->errors()
            );
        }

        return $this->success(
            $this->publicHomeService->submitContactMessage($validator->validated()),
            __('codemart.messages.message_received'),
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
        $limits = $this->estimateService->limits();
        $validator = Validator::make($request->all(), [
            'complexity' => ['required', Rule::in($options['complexities'])],
            'platforms' => 'nullable|integer|min:' . $limits['platforms']['min'] . '|max:' . $limits['platforms']['max'],
            'features' => 'nullable|integer|min:' . $limits['features']['min'] . '|max:' . $limits['features']['max'],
            'budget_type' => ['nullable', Rule::in($options['budget_types'])],
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        return $this->success($this->estimateService->estimate([
            'complexity' => (string) $request->input('complexity'),
            'platforms' => (int) $request->input('platforms', $limits['platforms']['default']),
            'features' => (int) $request->input('features', $limits['features']['default']),
            'budget_type' => (string) $request->input('budget_type', CodeMartV1Constants::BUDGET_TYPE_FIXED),
        ]));
    }

    /** Policy numbers the signed-out pages need (registration, estimate). */
    public function policy(): JsonResponse
    {
        return $this->success(CodeMartV1PolicyService::publicPolicy());
    }

    public function estimateOptions(): JsonResponse
    {
        return $this->success($this->estimateService->defaults());
    }

    /**
     * Operator-published mobile-app packages. Empty list means nothing is
     * published yet, so the browser renders a plain notice instead of
     * probing artifact URLs and logging failed requests.
     */
    public function appDownloads(): JsonResponse
    {
        return $this->success($this->publicHomeService->appDownloads());
    }
}
