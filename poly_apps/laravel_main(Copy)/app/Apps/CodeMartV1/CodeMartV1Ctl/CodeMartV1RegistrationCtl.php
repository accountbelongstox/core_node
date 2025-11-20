<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
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
use Illuminate\Support\Facades\DB;

class CodeMartV1RegistrationCtl extends Controller
{
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
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

            $user = CodeMartV1UserModel::create([
                'username' => $request->username,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'name' => $request->real_name,
                'rolename' => $request->role_type,
                'rolelevel' => 0,
            ]);

            CodeMartV1UserRoleModel::create([
                'user_id' => $user->id,
                'role_type' => $request->role_type,
                'role_status' => 'pending',
            ]);

            $emailToken = $this->emailService->createEmailVerification($request->email);
            $this->emailService->sendVerificationEmail($request->email, $emailToken);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Registration successful. Please verify your email.',
                'data' => [
                    'user_id' => $user->id,
                    'username' => $user->username,
                    'email' => $user->email,
                    'role_type' => $request->role_type,
                    'next_step' => 'email_verification',
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Registration failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function verifyEmail(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if (!$this->emailService->verifyToken($request->email, $request->token)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired verification token',
            ], 422);
        }

        $user = CodeMartV1UserModel::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $user->update(['email_verified_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully',
            'data' => [
                'user_id' => $user->id,
                'next_step' => 'phone_verification',
            ],
        ], 200);
    }

    public function requestPhoneVerification(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'phone' => 'required|string|regex:/^[0-9]{10,15}$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $otpData = $this->otpService->createOtpRecord($user->id, $request->phone);

        return response()->json([
            'success' => true,
            'message' => 'OTP sent to your phone',
            'data' => $otpData,
        ], 200);
    }

    public function verifyPhoneOtp(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'otp_code' => 'required|string|regex:/^[0-9]{6}$/',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        if (!$this->otpService->verifyOtp($user->id, $request->otp_code)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired OTP code',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Phone number verified successfully',
            'data' => [
                'user_id' => $user->id,
                'next_step' => 'kyc_verification',
            ],
        ], 200);
    }

    public function uploadKycDocuments(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

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
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            DB::beginTransaction();

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
                throw new \Exception('File upload failed');
            }

            $kycVerification = CodeMartV1KycVerificationModel::create([
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

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'KYC documents uploaded. Awaiting manual verification.',
                'data' => [
                    'kyc_id' => $kycVerification->id,
                    'verification_status' => 'pending',
                    'next_step' => 'deposit_payment',
                ],
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Upload failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function getRegistrationStatus(Request $request): JsonResponse
    {
        $user = auth()->guard('sanctum')->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized',
            ], 401);
        }

        $userModel = CodeMartV1UserModel::with([
            'userRoles',
            'phoneVerifications',
            'kycVerification',
        ])->find($user->id);

        if (!$userModel) {
            return response()->json([
                'success' => false,
                'message' => 'User not found',
            ], 404);
        }

        $emailVerified = $userModel->email_verified_at !== null;
        $phoneVerified = $userModel->phoneVerifications()
            ->where('verified_at', '!=', null)
            ->exists();

        $kycStatus = $userModel->kycVerification?->verification_status ?? 'not_started';
        $userRoles = $userModel->userRoles()
            ->pluck('role_status', 'role_type')
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $userModel->id,
                'username' => $userModel->username,
                'email' => $userModel->email,
                'email_verified' => $emailVerified,
                'phone_verified' => $phoneVerified,
                'kyc_status' => $kycStatus,
                'roles' => $userRoles,
                'registration_complete' => $this->isRegistrationComplete($userModel),
            ],
        ], 200);
    }

    private function isRegistrationComplete(CodeMartV1UserModel $user): bool
    {
        $emailVerified = $user->email_verified_at !== null;
        $phoneVerified = $user->phoneVerifications()
            ->where('verified_at', '!=', null)
            ->exists();
        $kycApproved = $user->kycVerification?->isApproved() ?? false;

        return $emailVerified && $phoneVerified && $kycApproved;
    }
}
