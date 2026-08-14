<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PhoneVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1KycVerificationModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1EmailService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1OtpService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

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
            'password' => 'required|string|min:8|confirmed',
            'role_type' => 'required|in:developer,client',
            'real_name' => 'required|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        CodeMartV1UserModel::beginModelTransaction();

        $user = CodeMartV1UserModel::createRecord([
            'username' => $request->username,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'name' => $request->real_name,
            'rolename' => $request->role_type,
            'rolelevel' => 0,
        ]);

        CodeMartV1UserRoleModel::createRecord([
            'user_id' => $user->id,
            'role_type' => $request->role_type,
            'role_status' => 'pending',
        ]);

        $emailToken = $this->emailService->createEmailVerification($request->email);
        $this->emailService->sendVerificationEmail($request->email, $emailToken);

        CodeMartV1UserModel::commitModelTransaction();

        return $this->success([
            'user_id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'role_type' => $request->role_type,
            'next_step' => 'email_verification',
        ], 'Registration successful. Please verify your email.', 201);
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        if (!$this->emailService->verifyToken($request->email, $request->token)) {
            return $this->error('Invalid or expired verification token', 422);
        }

        $user = CodeMartV1UserModel::findByEmail((string) $request->email);

        if (!$user) {
            return $this->notFound('User not found');
        }

        $user->updateRecord(['email_verified_at' => now()]);

        return $this->success([
            'user_id' => $user->id,
            'next_step' => 'phone_verification',
        ], 'Email verified successfully');
    }

    public function requestPhoneVerification(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^[0-9]{10,15}$/',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $otpData = $this->otpService->createOtpRecord($user->id, $request->phone);

        return $this->success($otpData, 'OTP sent to your phone');
    }

    public function verifyPhoneOtp(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'otp_code' => 'required|string|regex:/^[0-9]{6}$/',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        if (!$this->otpService->verifyOtp($user->id, $request->otp_code)) {
            return $this->error('Invalid or expired OTP code', 422);
        }

        return $this->success([
            'user_id' => $user->id,
            'next_step' => 'kyc_verification',
        ], 'Phone number verified successfully');
    }

    public function uploadKycDocuments(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'identity_type' => 'required|in:ID_CARD,PASSPORT,DRIVING_LICENSE',
            'identity_number' => 'required|string|unique:codemart_kyc_verifications',
            'real_name' => 'required|string|max:100',
            'date_of_birth' => 'required|date|before:today',
            'id_front_image' => 'required|file|image',
            'id_back_image' => 'required_if:identity_type,ID_CARD|file|image',
            'selfie_image' => 'required|file|image',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        CodeMartV1UserModel::beginModelTransaction();

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
            CodeMartV1UserModel::rollBackModelTransaction();
            return $this->error('File upload failed', 500);
        }

        $kycVerification = CodeMartV1KycVerificationModel::createRecord([
            'user_id' => $user->id,
            'identity_type' => $request->identity_type,
            'identity_number' => $request->identity_number,
            'real_name' => $request->real_name,
            'date_of_birth' => $request->date_of_birth,
            'id_front_image_path' => $idFrontPath,
            'id_back_image_path' => $idBackPath,
            'selfie_image_path' => $selfiePath,
            'verification_status' => 'pending',
        ]);

        CodeMartV1UserModel::commitModelTransaction();

        return $this->success([
            'kyc_id' => $kycVerification->id,
            'verification_status' => 'pending',
            'next_step' => 'deposit_payment',
        ], 'KYC documents uploaded. Awaiting manual verification.', 201);
    }

    public function getRegistrationStatus(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userModel = CodeMartV1UserModel::findRegistration((int) $user->id);

        if (!$userModel) {
            return $this->notFound('User not found');
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
