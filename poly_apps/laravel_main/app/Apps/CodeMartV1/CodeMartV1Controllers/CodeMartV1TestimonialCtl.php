<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1TestimonialService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1PublicHomeService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1TestimonialCtl extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CodeMartV1TestimonialService $testimonialService)
    {
    }

    public function store(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $maxLength = CodeMartV1Constants::TESTIMONIAL_MAX_QUOTE_LENGTH;
        $validator = Validator::make($request->all(), [
            'quote' => 'required_without:quotes|nullable|string|min:10|max:' . $maxLength,
            'quotes' => 'required_without:quote|nullable|array',
            'quotes.*' => 'nullable|string|max:' . $maxLength,
            'project_id' => 'nullable|integer',
            'author_label' => 'nullable|string|max:100',
            'role_label' => 'nullable|string|max:100',
            'role_labels' => 'nullable|array',
            'role_labels.*' => 'nullable|string|max:100',
        ]);
        if ($validator->fails()) {
            return $this->errorWithCode(
                CodeMartV1Constants::ERROR_VALIDATION_FAILED,
                'Validation failed',
                422,
                $validator->errors()
            );
        }

        $result = $this->testimonialService->submit(
            (int) $user->id,
            $validator->validated(),
            CodeMartV1PublicHomeService::resolveLocale($request)
        );
        if (CodeMartV1AdminService::isFailure($result)) {
            return $this->errorWithCode($result['error_code'], $result['message'], $result['http_status']);
        }

        return $this->success($result, 'Testimonial submitted for moderation', 201);
    }
}
