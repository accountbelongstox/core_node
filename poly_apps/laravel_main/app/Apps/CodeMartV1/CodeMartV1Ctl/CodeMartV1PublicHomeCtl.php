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

class CodeMartV1PublicHomeCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly CodeMartV1PublicHomeService $publicHomeService,
        private readonly CodeMartV1EstimateService $estimateService,
    ) {
    }

    public function getHome(): JsonResponse
    {
        return $this->success($this->publicHomeService->getHome());
    }

    /**
     * Public server-calculated project estimate. No bearer token; policy and
     * rates are server-owned, so the browser never derives pricing locally.
     */
    public function estimate(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'complexity' => 'required|in:simple,medium,complex,very_complex',
            'platforms' => 'nullable|integer|min:1|max:6',
            'features' => 'nullable|integer|min:1|max:50',
            'budget_type' => 'nullable|in:fixed,hourly',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        return $this->success($this->estimateService->estimate([
            'complexity' => (string) $request->input('complexity'),
            'platforms' => (int) $request->input('platforms', 1),
            'features' => (int) $request->input('features', 5),
            'budget_type' => (string) $request->input('budget_type', CodeMartV1Constants::BUDGET_TYPE_FIXED),
        ]));
    }

    public function estimateOptions(): JsonResponse
    {
        return $this->success($this->estimateService->defaults());
    }
}
