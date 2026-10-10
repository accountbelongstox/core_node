<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PhoneVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1KycVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1RoleRequestService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1EmailService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1OtpService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use App\Http\Common\CommonAuthService;
use App\Models\User;
use App\Support\InstallationAccessCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CodeMartV1RegistrationCtl extends Controller
{
    use ApiResponse;

    private CodeMartV1EmailService $emailService;
    private CodeMartV1OtpService $otpService;
    private CodeMartV1FileUploadService $fileUploadService;

    public function __construct(
        CodeMartV1EmailService $emailService,
        CodeMartV1OtpService $otpService,
        CodeMartV1FileUploadService $fileUploadService
    ) {
        $this->emailService = $emailService;
        $this->otpService = $otpService;
        $this->fileUploadService = $fileUploadService;
    }

    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'username' => 'required|string|unique:users|min:3|max:50',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:' . CodeMartV1PolicyService::int('password_min_length') . '|confirmed',
            'role_type' => 'required|in:' . implode(',', CodeMartV1RoleRequestService::SELF_SERVICE_ROLES),
            'real_name' => 'required|string|max:100',
            'registration_code' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        // The start script (175) provisions the installation access (super)
        // code into the runtime store; registering with it elevates the new
        // account to platform administrator.
        $roleLevel = 0;
        $roleName = $request->role_type;
        $registrationCode = trim((string) $request->input('registration_code', ''));
        $isSuperAdmin = false;
        if ($registrationCode !== '') {
            $accessCode = trim((string) InstallationAccessCode::value());
            if ($accessCode === '' || !hash_equals($accessCode, $registrationCode)) {
                return $this->errorWithCode(
                    CodeMartV1Constants::ERROR_INVALID_REGISTRATION_CODE,
                    __('codemart.errors.invalid_registration_code'),
                    422
                );
            }
            $roleLevel = 100;
            $roleName = 'Super Administrator';
            $isSuperAdmin = true;
        }

        // A client has no deposit requirement, so the role activates
        // immediately; developer/architect roles stay pending until the
        // server-confirmed deposit activates them.
        $initialRoleStatus = CodeMartV1RoleRequestService::initialStatus((string) $request->role_type);

        $user = CodeMartV1UserModel::runInTransaction(function () use ($request, $roleName, $roleLevel, $initialRoleStatus) {
            $user = CodeMartV1UserModel::createRecord([
                'username' => $request->username,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'name' => $request->real_name,
                'rolename' => $roleName,
                'rolelevel' => $roleLevel,
            ]);

            CodeMartV1UserRoleModel::createRecord([
                'user_id' => $user->id,
                'role_type' => $request->role_type,
                'role_status' => $initialRoleStatus,
                'role_activated_at' => $initialRoleStatus === CodeMartV1Constants::ROLE_STATUS_ACTIVE ? now() : null,
            ]);

            $this->emailService->issueVerification((string) $request->email);

            return $user;
        });

        $globalUser = User::find($user->id);
        $session = $globalUser ? CommonAuthService::issueLoginToken($globalUser) : null;

        return $this->success([
            'user_id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role_type' => $request->role_type,
            'role_status' => $initialRoleStatus,
            'is_admin' => $isSuperAdmin,
            'token' => $session['token'] ?? null,
            'token_type' => $session['token_type'] ?? null,
            'next_step' => 'email_verification',
        ], __('codemart.messages.registration_successful_please_verify_your_email'), 201);
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        if (!$this->emailService->verifyToken($request->email, $request->token)) {
            return $this->codedError(CodeMartV1Constants::ERROR_INVALID_VERIFICATION_TOKEN, __('codemart.messages.invalid_or_expired_verification_token'), null, 422);
        }

        $user = CodeMartV1UserModel::findByEmail((string) $request->email);

        if (!$user) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        $user->markEmailVerified();

        return $this->success([
            'user_id' => $user->id,
            'next_step' => self::nextStepAfterEmail(),
        ], __('codemart.messages.email_verified_successfully'));
    }

    /**
     * Mail a new verification link to the signed-in user's address. The route
     * throttle (THROTTLE_EMAIL_RESEND) answers the standard 429 when exceeded.
     */
    public function resendVerificationEmail(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        if ($user->email_verified_at !== null) {
            return $this->success([
                'result' => CodeMartV1Constants::EMAIL_RESEND_ALREADY_VERIFIED,
                'next_step' => self::nextStepAfterEmail(),
            ], __('codemart.messages.email_already_verified'));
        }

        if (!$this->emailService->issueVerification((string) $user->email)) {
            return $this->codedError(CodeMartV1Constants::ERROR_MAIL_UNAVAILABLE, __('codemart.errors.mail_unavailable'), null, 503);
        }

        return $this->success([
            'result' => CodeMartV1Constants::EMAIL_RESEND_SENT,
            'email' => $user->email,
        ], __('codemart.messages.verification_email_sent'));
    }

    private static function nextStepAfterEmail(): string
    {
        return CodeMartV1OtpService::smsDeliveryAvailable() ? 'phone_verification' : 'kyc';
    }

    public function requestPhoneVerification(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^\+?[0-9]{10,15}$/',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        if (!CodeMartV1OtpService::smsDeliveryAvailable()) {
            return $this->codedError(CodeMartV1Constants::ERROR_SMS_UNAVAILABLE, __('codemart.errors.sms_unavailable'), null, 503);
        }
        $otpData = $this->otpService->createOtpRecord($user->id, $request->phone);
        if (!$otpData['delivered']) {
            return $this->codedError(CodeMartV1Constants::ERROR_SMS_UNAVAILABLE, __('codemart.errors.sms_unavailable'), null, 503);
        }

        return $this->success($otpData, __('codemart.messages.otp_sent_to_your_phone'));
    }

    public function verifyPhoneOtp(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'otp_code' => 'required|string|regex:/^[0-9]{6}$/',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        if (!$this->otpService->verifyOtp($user->id, $request->otp_code)) {
            return $this->codedError(CodeMartV1Constants::ERROR_INVALID_OTP_CODE, __('codemart.messages.invalid_or_expired_otp_code'), null, 422);
        }

        return $this->success([
            'user_id' => $user->id,
            'next_step' => 'kyc_verification',
        ], __('codemart.messages.phone_number_verified_successfully'));
    }

    public function uploadKycDocuments(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'identity_type' => 'required|in:' . implode(',', CodeMartV1Constants::IDENTITY_TYPES),
            'identity_number' => [
                'required',
                'string',
                // The same person re-uploading after a rejection keeps their
                // document number; only other users' numbers conflict.
                Rule::unique('codemartv1.codemart_v1_kyc_verifications', 'identity_number')
                    ->where(fn ($query) => $query->where('user_id', '!=', $user->id)),
            ],
            'real_name' => 'required|string|max:100',
            'date_of_birth' => 'required|date|before:today',
            'id_front_image' => 'required|file|image',
            'id_back_image' => 'required_if:identity_type,' . CodeMartV1Constants::IDENTITY_TYPE_ID_CARD . '|file|image',
            'selfie_image' => 'required|file|image',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $idFrontPath = $this->fileUploadService->uploadKycImage(
            $request->file('id_front_image'),
            'id_front'
        );

        $idBackPath = null;
        if ($request->hasFile('id_back_image')) {
            $idBackPath = $this->fileUploadService->uploadKycImage(
                $request->file('id_back_image'),
                'id_back'
            );
        }

        $selfiePath = $this->fileUploadService->uploadKycImage(
            $request->file('selfie_image'),
            'selfie'
        );

        if (!$idFrontPath || !$selfiePath) {
            return $this->codedError(CodeMartV1Constants::ERROR_FILE_UPLOAD_FAILED, __('codemart.messages.file_upload_failed'), null, 500);
        }

        // Re-upload after a rejection updates the user's existing record in
        // place (the identity number has a global unique constraint, so a
        // second row with the same number cannot exist).
        $existing = CodeMartV1KycVerificationModel::query()
            ->where('user_id', $user->id)
            ->where('identity_number', (string) $request->identity_number)
            ->first();
        if ($existing && in_array($existing->verification_status, [
            CodeMartV1Constants::KYC_STATUS_PENDING,
            CodeMartV1Constants::KYC_STATUS_APPROVED,
        ], true)) {
            return $this->errorWithCode(
                'kyc_already_submitted',
                __('codemart.messages.kyc_already_submitted'),
                409
            );
        }

        $kycVerification = CodeMartV1UserModel::runInTransaction(function () use ($request, $user, $idFrontPath, $idBackPath, $selfiePath, $existing) {
            $attributes = [
                'user_id' => $user->id,
                'identity_type' => $request->identity_type,
                'identity_number' => $request->identity_number,
                'real_name' => $request->real_name,
                'date_of_birth' => $request->date_of_birth,
                'id_front_image_path' => $idFrontPath,
                'id_back_image_path' => $idBackPath,
                'selfie_image_path' => $selfiePath,
                'verification_status' => CodeMartV1Constants::KYC_STATUS_PENDING,
                'verification_notes' => null,
                'verified_at' => null,
                'verified_by' => null,
            ];
            if ($existing) {
                $existing->updateRecord($attributes);
                return $existing->refresh();
            }
            return CodeMartV1KycVerificationModel::createRecord($attributes);
        });

        CodeMartV1DomainEventService::emit(
            (int) $user->id,
            CodeMartV1Constants::RESOURCE_KYC,
            (int) $kycVerification->id,
            'kyc_submitted',
            $existing ? (string) $existing->getOriginal('verification_status') : CodeMartV1Constants::KYC_STATUS_NOT_STARTED,
            CodeMartV1Constants::KYC_STATUS_PENDING
        );

        return $this->success([
            'kyc_id' => $kycVerification->id,
            'verification_status' => CodeMartV1Constants::KYC_STATUS_PENDING,
            'next_step' => 'deposit_payment',
        ], __('codemart.messages.kyc_documents_uploaded_awaiting_manual_verification'), 201);
    }

    public function getRegistrationStatus(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);

        if (!$userModel) {
            return $this->notFound(__('codemart.messages.user_not_found'));
        }

        $emailVerified = $userModel->email_verified_at !== null;
        $phoneVerified = $userModel->hasVerifiedPhone();

        $kycStatus = $userModel->kycVerification?->verification_status ?? 'not_started';
        $userRoles = $userModel->roleStatusMap();

        return $this->success([
            'user_id' => $userModel->id,
            'username' => $userModel->username,
            'email' => $userModel->email,
            'email_verified' => $emailVerified,
            'phone_verified' => $phoneVerified,
            'kyc_status' => $kycStatus,
            'roles' => $userRoles,
            'registration_complete' => $userModel->isRegistrationComplete(),
        ]);
    }
}
