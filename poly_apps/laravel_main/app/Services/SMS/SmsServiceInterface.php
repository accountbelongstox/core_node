<?php

namespace App\Services\SMS;

interface SmsServiceInterface
{
    public function sendVerificationCode(string $phone, string $code): array;

    public function sendMessage(string $phone, string $message, array $params = []): array;

    public function getProviderName(): string;
}
