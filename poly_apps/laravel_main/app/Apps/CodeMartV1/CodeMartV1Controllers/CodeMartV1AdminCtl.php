<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * CodeMart platform-administration endpoints. Authorization reuses the global
 * Laravel administrator policy (AuthHelper::requireAdmin); CodeMart role
 * membership is never an admin credential.
 */
class CodeMartV1AdminCtl extends Controller
{
    use ApiResponse;

    public function __construct(private readonly CodeMartV1AdminService $adminService)
    {
    }

    private function requireAdmin(Request $request)
    {
        return AuthHelper::requireAdmin($request);
    }

    private function pageParams(Request $request): array
    {
        $page = max(1, (int) $request->query('page', 1));
        $pageSize = min(
            CodeMartV1Constants::MAX_PAGE_SIZE,
            max(1, (int) $request->query('page_size', CodeMartV1Constants::DEFAULT_PAGE_SIZE))
        );

        return [$page, $pageSize];
    }

    private function listFilters(Request $request, array $keys): array
    {
        $filters = [];
        foreach ($keys as $key) {
            $filters[$key] = trim((string) $request->query($key, ''));
        }

        return $filters;
    }

    private function respond(array $result, string $message = 'Success'): JsonResponse
    {
        if (CodeMartV1AdminService::isFailure($result)) {
            return $this->errorWithCode($result['error_code'], $result['message'], $result['http_status']);
        }

        return $this->success($result, $message);
    }

    private function validationFailed($errors): JsonResponse
    {
        return $this->errorWithCode(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', 422, $errors);
    }

    public function overview(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        return $this->success($this->adminService->overview());
    }

    public function users(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);

        return $this->success($this->adminService->usersPage(
            $this->listFilters($request, ['search', 'role', 'status']),
            $page,
            $pageSize
        ));
    }

    public function userDetail(Request $request, int $userId): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        return $this->respond($this->adminService->userDetail($userId));
    }

    public function setRoleStatus(Request $request, int $userId, string $roleType): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,active,suspended,rejected',
            'reason' => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors());
        }

        return $this->respond($this->adminService->setRoleStatus(
            $userId,
            $roleType,
            (string) $request->input('status'),
            $request->input('reason'),
            (int) $admin->id
        ), 'Role status updated');
    }

    public function grantRole(Request $request, int $userId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'role_type' => ['required', Rule::in(CodeMartV1Constants::getAllRoles())],
            'status' => ['nullable', Rule::in([CodeMartV1Constants::ROLE_STATUS_PENDING, CodeMartV1Constants::ROLE_STATUS_ACTIVE])],
            'reason' => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors());
        }

        return $this->respond($this->adminService->grantRole(
            $userId,
            (string) $request->input('role_type'),
            (string) $request->input('status', CodeMartV1Constants::ROLE_STATUS_PENDING),
            $request->input('reason'),
            (int) $admin->id
        ), 'Role granted');
    }

    public function kycList(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);
        $filters = $this->listFilters($request, ['search', 'identity_type']);
        $filters['status'] = trim((string) $request->query('status', CodeMartV1Constants::KYC_STATUS_PENDING));

        return $this->success($this->adminService->kycPage($filters, $page, $pageSize));
    }

    public function kycApprove(Request $request, int $kycId): JsonResponse
    {
        return $this->reviewKyc($request, $kycId, true);
    }

    public function kycReject(Request $request, int $kycId): JsonResponse
    {
        return $this->reviewKyc($request, $kycId, false);
    }

    private function reviewKyc(Request $request, int $kycId, bool $approved): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string|max:2000',
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors());
        }

        return $this->respond($this->adminService->reviewKyc(
            $kycId,
            $approved,
            $request->input('notes'),
            (int) $admin->id
        ), $approved ? 'KYC approved' : 'KYC rejected');
    }

    /**
     * Streams a KYC document from private storage to administrators only.
     */
    public function kycFile(Request $request, int $kycId, string $type): Response
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        $location = $this->adminService->kycFile($kycId, $type);
        if (CodeMartV1AdminService::isFailure($location)) {
            return $this->errorWithCode($location['error_code'], $location['message'], $location['http_status']);
        }

        return Storage::disk($location['disk'])->response($location['path'], null, [
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function refunds(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);
        $status = trim((string) $request->query('status', ''));

        return $this->success($this->adminService->refundsPage($status, $page, $pageSize));
    }

    public function deposits(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);
        $status = trim((string) $request->query('status', ''));

        return $this->success($this->adminService->depositsPage($status, $page, $pageSize));
    }

    public function confirmDeposit(Request $request, int $depositId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        return $this->respond($this->adminService->confirmDeposit($depositId, (int) $admin->id), 'Deposit confirmed');
    }

    public function projects(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);

        return $this->success($this->adminService->projectsPage(
            $this->listFilters($request, ['search', 'status', 'client_id']),
            $page,
            $pageSize
        ));
    }

    public function setProjectStatus(Request $request, int $projectId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'to_status' => ['required', Rule::in(CodeMartV1Constants::ADMIN_PROJECT_TARGET_STATUSES)],
            'reason' => 'required|string|max:1000',
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors());
        }

        return $this->respond($this->adminService->setProjectStatus(
            $projectId,
            (string) $request->input('to_status'),
            (string) $request->input('reason'),
            (int) $admin->id
        ), 'Project status updated');
    }

    public function testimonials(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);

        return $this->success($this->adminService->testimonialsPage(
            $this->listFilters($request, ['search', 'status']),
            $page,
            $pageSize
        ));
    }

    public function approveTestimonial(Request $request, int $testimonialId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        return $this->respond(
            $this->adminService->moderateTestimonial($testimonialId, true, (int) $admin->id),
            'Testimonial approved'
        );
    }

    public function hideTestimonial(Request $request, int $testimonialId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        return $this->respond(
            $this->adminService->moderateTestimonial($testimonialId, false, (int) $admin->id),
            'Testimonial hidden'
        );
    }

    public function updateTestimonial(Request $request, int $testimonialId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'sort_order' => 'nullable|integer|min:0|max:100000',
            'quotes' => 'nullable|array',
            'quotes.*' => 'nullable|string|max:' . CodeMartV1Constants::TESTIMONIAL_MAX_QUOTE_LENGTH,
            'role_labels' => 'nullable|array',
            'role_labels.*' => 'nullable|string|max:100',
            'author_label' => 'nullable|string|max:100',
            'role_label' => 'nullable|string|max:100',
            'avatar_url' => 'nullable|string|max:255',
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors());
        }

        $attributes = array_filter(
            $validator->validated(),
            static fn ($value): bool => $value !== null
        );

        return $this->respond(
            $this->adminService->updateTestimonial($testimonialId, $attributes, (int) $admin->id),
            'Testimonial updated'
        );
    }

    public function reviewerApplications(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);

        return $this->success($this->adminService->reviewerApplicationsPage(
            $this->listFilters($request, ['search', 'status']),
            $page,
            $pageSize
        ));
    }

    public function revokeReviewer(Request $request, int $applicationId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'nullable|string|max:1000',
        ]);
        if ($validator->fails()) {
            return $this->validationFailed($validator->errors());
        }

        return $this->respond(
            $this->adminService->revokeReviewer($applicationId, $request->input('reason'), (int) $admin->id),
            'Reviewer revoked'
        );
    }

    public function policy(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        return $this->success($this->adminService->policy());
    }

    public function activity(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);

        return $this->success($this->adminService->activityPage(
            $this->listFilters($request, ['search', 'resource_type', 'resource_id', 'actor_id', 'action']),
            $page,
            $pageSize
        ));
    }

    public function contactMessages(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);

        return $this->success($this->adminService->contactMessagesPage(
            $this->listFilters($request, ['search', 'status']),
            $page,
            $pageSize
        ));
    }

    public function handleContactMessage(Request $request, int $messageId): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        return $this->respond(
            $this->adminService->handleContactMessage($messageId, (int) $admin->id),
            'Contact message handled'
        );
    }
}
