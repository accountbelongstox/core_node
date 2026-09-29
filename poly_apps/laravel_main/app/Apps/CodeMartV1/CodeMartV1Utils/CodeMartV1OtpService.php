<?php
namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1PhoneVerificationModel;
use App\Support\RuntimeConfigurationStore;
use App\Utils\SecretStore;
use Illuminate\Support\Facades\Log;
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

    /**
     * Whether a supported SMS provider is configured (runtime key
     * CODEMART_SMS_PROVIDER naming one of CodeMartV1Constants::SMS_PROVIDERS).
     * Phone verification is required in onboarding only when this is true.
     */
    public static function smsDeliveryAvailable(): bool
    {
        $provider = strtolower(trim((string) RuntimeConfigurationStore::get(CodeMartV1Constants::SMS_PROVIDER_CONFIG_KEY, '')));

        return $provider !== '' && in_array($provider, CodeMartV1Constants::SMS_PROVIDERS, true);
    }

    /**
     * Sends through the configured provider. No provider implementation
     * exists yet, so delivery reports failure. The code is never logged.
     */
    public function sendOtpSms(string $phone, string $otp): bool
    {
        Log::warning('[CodeMartV1Otp] SMS delivery is not configured; OTP not sent', [
            'phone' => SecretStore::maskForDisplay($phone),
        ]);

        return false;
    }

    public function createOtpRecord(int $userId, string $phone): array
    {
        $otp = $this->generateOtp();

        $phoneVerification = CodeMartV1PhoneVerificationModel::storeOtp(
            $userId,
            [
                'phone' => $phone,
                'otp_code' => $otp,
                'otp_attempts' => 0,
                'otp_expires_at' => now()->addMinutes(self::OTP_EXPIRY_MINUTES),
                'verified_at' => null,
            ]
        );

        return [
            'phone' => $phone,
            'expires_in_seconds' => self::OTP_EXPIRY_MINUTES * 60,
            'delivered' => $this->sendOtpSms($phone, $otp),
        ];
    }

    public function verifyOtp(int $userId, string $otpCode): bool
    {
        $phoneVerification = CodeMartV1PhoneVerificationModel::forUser($userId);

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
            $phoneVerification->incrementRecord('otp_attempts');
            return false;
        }

        $phoneVerification->updateRecord([
            'verified_at' => now(),
            'otp_attempts' => 0,
        ]);

        return true;
    }

    public function resendOtp(int $userId): array|bool
    {
        $phoneVerification = CodeMartV1PhoneVerificationModel::forUser($userId);

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
        return CodeMartV1PhoneVerificationModel::isVerifiedForUser($userId);
    }
}
