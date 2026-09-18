<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

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
        $search = trim((string) $request->query('search', ''));

        return $this->success($this->adminService->usersPage($search, $page, $pageSize));
    }

    public function setRoleStatus(Request $request, int $userId, string $roleType): JsonResponse
    {
        $admin = $this->requireAdmin($request);
        if (!$admin) {
            return $this->forbidden();
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:pending,active,suspended,rejected',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $result = $this->adminService->setRoleStatus(
            $userId,
            $roleType,
            (string) $request->input('status'),
            (int) $admin->id
        );

        if ($result === null) {
            return $this->notFound('Role assignment not found');
        }

        return $this->success($result, 'Role status updated');
    }

    public function kycList(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);
        $status = trim((string) $request->query('status', CodeMartV1Constants::KYC_STATUS_PENDING));

        return $this->success($this->adminService->kycPage($status, $page, $pageSize));
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

        $result = $this->adminService->reviewKyc(
            $kycId,
            $approved,
            $request->input('notes'),
            (int) $admin->id
        );

        if ($result === null) {
            return $this->notFound('KYC submission not found');
        }

        return $this->success($result, $approved ? 'KYC approved' : 'KYC rejected');
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

        $result = $this->adminService->confirmDeposit($depositId, (int) $admin->id);
        if ($result === null) {
            return $this->notFound('Deposit not found');
        }

        return $this->success($result, 'Deposit confirmed');
    }

    public function projects(Request $request): JsonResponse
    {
        if (!$this->requireAdmin($request)) {
            return $this->forbidden();
        }

        [$page, $pageSize] = $this->pageParams($request);
        $status = trim((string) $request->query('status', ''));

        return $this->success($this->adminService->projectsPage($status, $page, $pageSize));
    }
}
