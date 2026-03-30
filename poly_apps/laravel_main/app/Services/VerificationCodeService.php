<?php

namespace App\Services;

use App\Services\SMS\SmsServiceInterface;
use App\Services\SMS\Providers\TencentSmsProvider;
use App\Services\SMS\Providers\LogSmsProvider;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Database\Eloquent\Model;

class VerificationCodeService
{
    protected $smsProvider;
    protected $connection;
    protected $tableName;
    protected $codeExpiryMinutes;
    protected $codeLength;
    protected $maxDailySends;
    protected $rateLimitSeconds;

    public function __construct(string $connection = AppKeys::AWYV0, string $tableName = 'awy_v0_verification_codes')
    {
        $this->connection = $connection;
        $this->tableName = $tableName;
        $this->codeExpiryMinutes = config('sms.code_expiry_minutes', 30);
        $this->codeLength = config('sms.code_length', 6);
        $this->maxDailySends = config('sms.max_daily_sends_per_phone', 10);
        $this->rateLimitSeconds = config('sms.rate_limit_seconds', 60);

        $this->initializeSmsProvider();
    }

    public function setConnection(string $connection): self
    {
        $this->connection = $connection;
        return $this;
    }

    public function setTableName(string $tableName): self
    {
        $this->tableName = $tableName;
        return $this;
    }

    public function setCodeExpiry(int $minutes): self
    {
        $this->codeExpiryMinutes = $minutes;
        return $this;
    }

    protected function initializeSmsProvider(): void
    {
        $driver = config('sms.default', 'log');
        $config = config("sms.drivers.{$driver}", []);

        switch ($driver) {
            case 'tencent':
                $this->smsProvider = new TencentSmsProvider($config);
                break;

            case 'log':
            default:
                $this->smsProvider = new LogSmsProvider($config);
                break;
        }
    }

    public function sendCode(string $phone): array
    {
        $phone = $this->normalizePhone($phone);

        if (!$this->isValidPhone($phone)) {
            return [
                'success' => false,
                'error' => 'Invalid phone number format',
                'error_code' => 'INVALID_PHONE',
            ];
        }

        $rateLimitCheck = $this->checkRateLimit($phone);
        if (!$rateLimitCheck['allowed']) {
            return [
                'success' => false,
                'error' => 'Rate limit exceeded. Please try again later.',
                'error_code' => 'RATE_LIMIT_EXCEEDED',
                'retry_after' => $rateLimitCheck['retry_after'],
            ];
        }

        $dailyLimitCheck = $this->checkDailyLimit($phone);
        if (!$dailyLimitCheck['allowed']) {
            return [
                'success' => false,
                'error' => 'Daily SMS limit exceeded',
                'error_code' => 'DAILY_LIMIT_EXCEEDED',
                'max_sends' => $this->maxDailySends,
            ];
        }

        $code = $this->generateCode();

        $expiresAt = now()->addMinutes($this->codeExpiryMinutes);

        try {
            // Use model connection for query builder (Laravel best practice)
            $dbConnection = $this->getDbConnection();
            $dbConnection->table($this->tableName)->insert([
                'phone' => $phone,
                'code' => $code,
                'expires_at' => $expiresAt,
                'used' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $smsResult = $this->smsProvider->sendVerificationCode($phone, $code);

            if ($smsResult['success']) {
                $this->setRateLimit($phone);

                return [
                    'success' => true,
                    'message' => 'Verification code sent successfully',
                    'expires_in' => $this->codeExpiryMinutes * 60,
                    'phone' => $this->maskPhone($phone),
                    'provider' => $smsResult['provider'] ?? 'unknown',
                ];
            } else {
                // Use model connection for query builder (Laravel best practice)
                $dbConnection = $this->getDbConnection();
                $dbConnection
                    ->table($this->tableName)
                    ->where('phone', $phone)
                    ->where('code', $code)
                    ->delete();

                Log::error('[VerificationCodeService] SMS send failed', [
                    'phone' => $phone,
                    'error' => $smsResult['error'] ?? 'Unknown error',
                ]);

                return [
                    'success' => false,
                    'error' => $smsResult['error'] ?? 'Failed to send SMS',
                    'error_code' => 'SMS_SEND_FAILED',
                ];
            }

        } catch (\Exception $e) {
            Log::error('[VerificationCodeService] Send code exception', [
                'phone' => $phone,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => 'System error occurred',
                'error_code' => 'SYSTEM_ERROR',
            ];
        }
    }

    public function verifyCode(string $phone, string $code): array
    {
        $phone = $this->normalizePhone($phone);

        if (!$this->isValidPhone($phone)) {
            return [
                'success' => false,
                'error' => 'Invalid phone number',
                'error_code' => 'INVALID_PHONE',
            ];
        }

        // Use model connection for query builder (Laravel best practice)
        $dbConnection = $this->getDbConnection();
        
        $record = $dbConnection
            ->table($this->tableName)
            ->where('phone', $phone)
            ->where('code', $code)
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$record) {
            Log::warning('[VerificationCodeService] Invalid or expired code', [
                'phone' => $phone,
                'code' => $code,
            ]);

            return [
                'success' => false,
                'error' => 'Invalid or expired verification code',
                'error_code' => 'INVALID_CODE',
            ];
        }

        $dbConnection
            ->table($this->tableName)
            ->where('id', $record->id)
            ->update([
                'used' => true,
                'updated_at' => now(),
            ]);

        $dbConnection
            ->table($this->tableName)
            ->where('phone', $phone)
            ->where('id', '!=', $record->id)
            ->where('used', false)
            ->update([
                'used' => true,
                'updated_at' => now(),
            ]);

        return [
            'success' => true,
            'message' => 'Verification code is valid',
            'phone' => $phone,
        ];
    }

    public function cleanupExpiredCodes(): int
    {
        try {
            // Use model connection for query builder (Laravel best practice)
            $dbConnection = $this->getDbConnection();
            $deleted = $dbConnection
                ->table($this->tableName)
                ->where('expires_at', '<', now()->subDays(7))
                ->delete();

            Log::info('[VerificationCodeService] Cleaned up expired codes', [
                'deleted_count' => $deleted,
            ]);

            return $deleted;
        } catch (\Exception $e) {
            Log::error('[VerificationCodeService] Cleanup failed', [
                'error' => $e->getMessage(),
            ]);

            return 0;
        }
    }

    protected function generateCode(): string
    {
        return str_pad((string) random_int(0, pow(10, $this->codeLength) - 1), $this->codeLength, '0', STR_PAD_LEFT);
    }

    protected function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/[^0-9+]/', '', $phone);

        if (strpos($phone, '+') !== 0) {
            if (strpos($phone, '86') === 0) {
                $phone = '+' . $phone;
            } elseif (strlen($phone) === 11 && preg_match('/^1[3-9]\d{9}$/', $phone)) {
                $phone = '+86' . $phone;
            }
        }

        return $phone;
    }

    protected function isValidPhone(string $phone): bool
    {
        if (strpos($phone, '+86') === 0) {
            $number = substr($phone, 3);
            return preg_match('/^1[3-9]\d{9}$/', $number) === 1;
        }

        return preg_match('/^\+\d{10,15}$/', $phone) === 1;
    }

    protected function maskPhone(string $phone): string
    {
        if (strpos($phone, '+86') === 0) {
            $number = substr($phone, 3);
            return '+86' . substr($number, 0, 3) . '****' . substr($number, -4);
        }

        if (strlen($phone) > 8) {
            return substr($phone, 0, 4) . '****' . substr($phone, -4);
        }

        return $phone;
    }

    protected function checkRateLimit(string $phone): array
    {
        $cacheKey = "sms_rate_limit:{$phone}";
        $lastSent = Cache::get($cacheKey);

        if ($lastSent) {
            $elapsedSeconds = now()->diffInSeconds($lastSent);

            if ($elapsedSeconds < $this->rateLimitSeconds) {
                return [
                    'allowed' => false,
                    'retry_after' => $this->rateLimitSeconds - $elapsedSeconds,
                ];
            }
        }

        return ['allowed' => true];
    }

    protected function setRateLimit(string $phone): void
    {
        $cacheKey = "sms_rate_limit:{$phone}";
        Cache::put($cacheKey, now(), $this->rateLimitSeconds);
    }

    /**
     * Get database connection using model (Laravel best practice)
     * Creates a temporary model instance to get the connection
     */
    protected function getDbConnection()
    {
        $model = new class extends Model {
            // Temporary model for getting connection
        };
        $model->setConnection($this->connection);
        return $model->getConnection();
    }

    protected function checkDailyLimit(string $phone): array
    {
        // Use model connection for query builder (Laravel best practice)
        $dbConnection = $this->getDbConnection();
        $count = $dbConnection
            ->table($this->tableName)
            ->where('phone', $phone)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();

        if ($count >= $this->maxDailySends) {
            return [
                'allowed' => false,
                'sent_count' => $count,
            ];
        }

        return [
            'allowed' => true,
            'sent_count' => $count,
        ];
    }

    public function getSmsProvider(): SmsServiceInterface
    {
        return $this->smsProvider;
    }
}
