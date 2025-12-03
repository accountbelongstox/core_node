<?php

namespace App\Services\SMS\Providers;

use App\Services\SMS\SmsServiceInterface;
use Illuminate\Support\Facades\Log;

class LogSmsProvider implements SmsServiceInterface
{
    protected $config;

    public function __construct(array $config = [])
    {
        $this->config = $config;
    }

    public function sendVerificationCode(string $phone, string $code): array
    {
        Log::info('[LogSMS] Verification code sent', [
            'phone' => $phone,
            'code' => $code,
            'timestamp' => now()->toDateTimeString(),
        ]);

        echo "\n===========================================\n";
        echo "SMS VERIFICATION CODE (Development Mode)\n";
        echo "===========================================\n";
        echo "Phone: {$phone}\n";
        echo "Code: {$code}\n";
        echo "Time: " . now()->toDateTimeString() . "\n";
        echo "===========================================\n\n";

        return [
            'success' => true,
            'provider' => 'log',
            'message_id' => 'log_' . uniqid(),
            'phone' => $phone,
            'code' => $code,
        ];
    }

    public function sendMessage(string $phone, string $message, array $params = []): array
    {
        Log::info('[LogSMS] Message sent', [
            'phone' => $phone,
            'message' => $message,
            'params' => $params,
            'timestamp' => now()->toDateTimeString(),
        ]);

        return [
            'success' => true,
            'provider' => 'log',
            'message_id' => 'log_' . uniqid(),
        ];
    }

    public function getProviderName(): string
    {
        return 'log';
    }
}
