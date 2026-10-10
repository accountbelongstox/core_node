<?php

namespace App\Apps\CodeMartV1\CodeMartV1Controllers;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ClientProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperProfileModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AccountService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1AdminService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1RoleRequestService;
use App\Helpers\AuthHelper;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CodeMartV1ProfileCtl extends Controller
{
    use ApiResponse;

    public function show(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);
        if (!$userModel) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        return $this->success($this->serializeProfile($userModel));
    }

    public function update(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:100',
            'nickname' => 'nullable|string|max:100',
            'developer.company_name' => 'nullable|string|max:255',
            'developer.bio' => 'nullable|string|max:5000',
            'developer.skills' => 'nullable|array',
            'developer.skills.*' => 'string|max:100',
            'client.company_name' => 'nullable|string|max:255',
            'client.industry' => 'nullable|string|max:100',
            'client.contact_person' => 'nullable|string|max:100',
            'client.contact_phone' => 'nullable|string|max:30',
            'client.company_website' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);
        if (!$userModel) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        $userAttributes = [];
        foreach (['name', 'nickname'] as $field) {
            if ($request->has($field)) {
                $userAttributes[$field] = $request->input($field);
            }
        }
        if ($userAttributes !== []) {
            $userModel->updateRecord($userAttributes);
        }

        if ($request->has('developer')) {
            $developerInput = (array) $request->input('developer', []);
            CodeMartV1DeveloperProfileModel::updateOrCreate(
                ['user_id' => $userModel->id],
                array_filter([
                    'company_name' => $developerInput['company_name'] ?? null,
                    'bio' => $developerInput['bio'] ?? null,
                    'skills' => $developerInput['skills'] ?? null,
                    'profile_completed_at' => now(),
                ], static fn ($value): bool => $value !== null)
            );
        }

        if ($request->has('client')) {
            $clientInput = (array) $request->input('client', []);
            CodeMartV1ClientProfileModel::updateOrCreate(
                ['user_id' => $userModel->id],
                array_merge(
                    ['company_name' => $clientInput['company_name'] ?? ''],
                    array_filter([
                        'industry' => $clientInput['industry'] ?? null,
                        'contact_person' => $clientInput['contact_person'] ?? null,
                        'contact_phone' => $clientInput['contact_phone'] ?? null,
                        'company_website' => $clientInput['company_website'] ?? null,
                        'profile_completed_at' => now(),
                    ], static fn ($value): bool => $value !== null)
                )
            );
        }

        return $this->success(
            $this->serializeProfile(CodeMartV1UserModel::findRegistration((int) $user->id)),
            __('codemart.messages.profile_updated')
        );
    }

    public function uploadAvatar(Request $request, CodeMartV1AccountService $accountService): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), ['avatar' => 'required|file']);
        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);
        if (!$userModel) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        $result = $accountService->updateAvatar($userModel, $request->file('avatar'));
        if (CodeMartV1AdminService::isFailure($result)) {
            return $this->errorWithCode($result['error_code'], $result['message'], $result['http_status']);
        }

        return $this->success($result, __('codemart.messages.avatar_updated'));
    }

    public function requestEmailChange(Request $request, CodeMartV1AccountService $accountService): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'new_email' => 'required|email|max:255',
            'password' => 'required|string',
        ]);
        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);
        if (!$userModel) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        $result = $accountService->requestEmailChange($userModel, (string) $request->input('new_email'), (string) $request->input('password'));
        if (CodeMartV1AdminService::isFailure($result)) {
            return $this->errorWithCode($result['error_code'], $result['message'], $result['http_status']);
        }

        return $this->success($result, __('codemart.messages.email_change_requested'));
    }

    public function confirmEmailChange(Request $request, CodeMartV1AccountService $accountService): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), ['token' => 'required|string|max:255']);
        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);
        if (!$userModel) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        $result = $accountService->confirmEmailChange($userModel, (string) $request->input('token'));
        if (CodeMartV1AdminService::isFailure($result)) {
            return $this->errorWithCode($result['error_code'], $result['message'], $result['http_status']);
        }

        return $this->success($result, __('codemart.messages.email_changed'));
    }

    /**
     * Existing accounts request an additional self-service role with the same
     * activation policy as registration.
     */
    public function requestRole(Request $request, CodeMartV1RoleRequestService $roleRequestService): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) {
            return $this->unauthorized();
        }

        $validator = Validator::make($request->all(), [
            'role_type' => ['required', Rule::in(CodeMartV1RoleRequestService::SELF_SERVICE_ROLES)],
        ]);
        if ($validator->fails()) {
            return $this->errorWithCode(
                CodeMartV1Constants::ERROR_INVALID_ROLE_TYPE,
                __('codemart.messages.validation_failed'),
                422,
                $validator->errors()
            );
        }

        $result = $roleRequestService->request((int) $user->id, (string) $request->input('role_type'));
        if (CodeMartV1AdminService::isFailure($result)) {
            return $this->errorWithCode($result['error_code'], $result['message'], $result['http_status']);
        }

        return $this->success($result, __('codemart.messages.role_requested'), 201);
    }

    private function serializeProfile(CodeMartV1UserModel $userModel): array
    {
        $developerProfile = $userModel->developerProfile;
        $clientProfile = $userModel->clientProfile;

        return [
            'user' => [
                'id' => $userModel->id,
                'username' => $userModel->username,
                'email' => $userModel->email,
                'name' => $userModel->name,
                'nickname' => $userModel->nickname,
                'avatar_url' => CodeMartV1AccountService::avatarUrl($userModel->avatar),
            ],
            'roles' => $userModel->roleStatusMap(),
            'developer' => $developerProfile ? [
                'company_name' => $developerProfile->company_name,
                'bio' => $developerProfile->bio,
                'skills' => $developerProfile->skills,
                'completed_projects' => (int) $developerProfile->completed_projects,
                'average_rating' => (string) $developerProfile->average_rating,
            ] : null,
            'client' => $clientProfile ? [
                'company_name' => $clientProfile->company_name,
                'industry' => $clientProfile->industry,
                'contact_person' => $clientProfile->contact_person,
                'contact_phone' => $clientProfile->contact_phone,
                'company_website' => $clientProfile->company_website,
                'posted_projects' => (int) $clientProfile->posted_projects,
            ] : null,
        ];
    }
}
