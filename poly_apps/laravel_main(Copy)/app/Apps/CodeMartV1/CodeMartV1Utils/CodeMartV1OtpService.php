<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PhoneVerificationModel;
use Illuminate\Support\Str;

class CodeMartV1OtpService
{
    private const OTP_LENGTH = 6;
    private const OTP_EXPIRY_MINUTES = 10;
    private const MAX_ATTEMPTS = 5;

    public function generateOtp(): string
    {
        return str_pad(random_int(0, 999999), self::OTP_LENGTH, '0', STR_PAD_LEFT);
    }

    public function sendOtpSms(string $phone, string $otp): bool
    {
        try {
            // TODO: Integrate with SMS provider (Aliyun, Tencent, etc.)
            // For now, log the OTP for testing
            \Log::info("OTP sent to {$phone}: {$otp}");
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    public function createOtpRecord(int $userId, string $phone): array
    {
        $otp = $this->generateOtp();

        $phoneVerification = CodeMartV1PhoneVerificationModel::updateOrCreate(
            ['user_id' => $userId],
            [
                'phone' => $phone,
                'otp_code' => $otp,
                'otp_attempts' => 0,
                'otp_expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
                'verified_at' => null,
            ]
        );

        $this->sendOtpSms($phone, $otp);

        return [
            'phone' => $phone,
            'expires_in_seconds' => self::OTP_EXPIRY_MINUTES * 60,
        ];
    }

    public function verifyOtp(int $userId, string $otpCode): bool
    {
        $phoneVerification = CodeMartV1PhoneVerificationModel::where('user_id', $userId)
            ->first();

        if (!$phoneVerification) {
            return false;
        }

        if ($phoneVerification->verified_at !== null) {
            return false;
        }

        if ($phoneVerification->otp_attempts >= self::MAX_ATTEMPTS) {
            return false;
        }

        if (now()->isAfter($phoneVerification->otp_expires_at)) {
            return false;
        }

        if ($phoneVerification->otp_code !== $otpCode) {
            $phoneVerification->increment('otp_attempts');
            return false;
        }

        $phoneVerification->update([
            'verified_at' => now(),
            'otp_attempts' => 0,
        ]);

        return true;
    }

    public function resendOtp(int $userId): array|bool
    {
        $phoneVerification = CodeMartV1PhoneVerificationModel::where('user_id', $userId)
            ->first();

        if (!$phoneVerification) {
            return false;
        }

        if ($phoneVerification->verified_at !== null) {
            return false;
        }

        return $this->createOtpRecord($userId, $phoneVerification->phone);
    }

    public function isPhoneVerified(int $userId): bool
    {
        $phoneVerification = CodeMartV1PhoneVerificationModel::where('user_id', $userId)
            ->where('verified_at', '!=', null)
            ->first();

        return $phoneVerification !== null;
    }
}
