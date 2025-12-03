<?php

namespace App\Services\SMS\Providers;

use App\Services\SMS\SmsServiceInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TencentSmsProvider implements SmsServiceInterface
{
    protected $config;
    protected $secretId;
    protected $secretKey;
    protected $sdkAppId;
    protected $signName;
    protected $templateId;
    protected $region;
    protected $endpoint;

    public function __construct(array $config)
    {
        $this->config = $config;
        $this->secretId = $config['secret_id'] ?? '';
        $this->secretKey = $config['secret_key'] ?? '';
        $this->sdkAppId = $config['sdk_app_id'] ?? '';
        $this->signName = $config['sign_name'] ?? '';
        $this->templateId = $config['template_id'] ?? '';
        $this->region = $config['region'] ?? 'ap-guangzhou';
        $this->endpoint = $config['endpoint'] ?? 'sms.tencentcloudapi.com';
    }

    public function sendVerificationCode(string $phone, string $code): array
    {
        if (!$this->isConfigured()) {
            Log::warning('[TencentSMS] Configuration incomplete', [
                'has_secret_id' => !empty($this->secretId),
                'has_secret_key' => !empty($this->secretKey),
                'has_sdk_app_id' => !empty($this->sdkAppId),
                'has_template_id' => !empty($this->templateId),
            ]);

            return [
                'success' => false,
                'error' => 'SMS service not configured',
                'provider' => 'tencent',
            ];
        }

        try {
            $phone = $this->formatPhone($phone);

            $params = [
                'PhoneNumberSet' => [$phone],
                'TemplateID' => $this->templateId,
                'SmsSdkAppid' => $this->sdkAppId,
                'Sign' => $this->signName,
                'TemplateParamSet' => [$code],
            ];

            $result = $this->request('SendSms', $params);

            if (isset($result['Response']['SendStatusSet'][0])) {
                $status = $result['Response']['SendStatusSet'][0];

                if ($status['Code'] === 'Ok') {
                    return [
                        'success' => true,
                        'provider' => 'tencent',
                        'message_id' => $status['SerialNo'] ?? null,
                        'fee' => $status['Fee'] ?? 0,
                    ];
                } else {
                    return [
                        'success' => false,
                        'error' => $status['Message'] ?? 'SMS send failed',
                        'code' => $status['Code'] ?? 'UNKNOWN_ERROR',
                        'provider' => 'tencent',
                    ];
                }
            }

            return [
                'success' => false,
                'error' => $result['Response']['Error']['Message'] ?? 'Unknown error',
                'provider' => 'tencent',
            ];

        } catch (\Exception $e) {
            Log::error('[TencentSMS] Send verification code failed', [
                'phone' => $phone,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'provider' => 'tencent',
            ];
        }
    }

    public function sendMessage(string $phone, string $message, array $params = []): array
    {
        return $this->sendVerificationCode($phone, $message);
    }

    public function getProviderName(): string
    {
        return 'tencent';
    }

    protected function isConfigured(): bool
    {
        return !empty($this->secretId) &&
               !empty($this->secretKey) &&
               !empty($this->sdkAppId) &&
               !empty($this->templateId);
    }

    protected function formatPhone(string $phone): string
    {
        if (strpos($phone, '+') === 0) {
            return $phone;
        }

        if (strpos($phone, '86') === 0) {
            return '+' . $phone;
        }

        if (strlen($phone) === 11 && preg_match('/^1[3-9]\d{9}$/', $phone)) {
            return '+86' . $phone;
        }

        return '+86' . $phone;
    }

    protected function request(string $action, array $params): array
    {
        $timestamp = time();
        $service = 'sms';
        $version = '2019-07-11';

        $payload = json_encode($params, JSON_UNESCAPED_UNICODE);

        $canonicalHeaders = "content-type:application/json; charset=utf-8\n" .
                           "host:{$this->endpoint}\n";
        $signedHeaders = "content-type;host";

        $hashedRequestPayload = hash('sha256', $payload);

        $canonicalRequest = "POST\n/\n\n{$canonicalHeaders}\n{$signedHeaders}\n{$hashedRequestPayload}";

        $date = gmdate('Y-m-d', $timestamp);
        $credentialScope = "{$date}/{$service}/tc3_request";

        $hashedCanonicalRequest = hash('sha256', $canonicalRequest);

        $stringToSign = "TC3-HMAC-SHA256\n{$timestamp}\n{$credentialScope}\n{$hashedCanonicalRequest}";

        $secretDate = hash_hmac('sha256', $date, 'TC3' . $this->secretKey, true);
        $secretService = hash_hmac('sha256', $service, $secretDate, true);
        $secretSigning = hash_hmac('sha256', 'tc3_request', $secretService, true);

        $signature = hash_hmac('sha256', $stringToSign, $secretSigning);

        $authorization = "TC3-HMAC-SHA256 " .
                        "Credential={$this->secretId}/{$credentialScope}, " .
                        "SignedHeaders={$signedHeaders}, " .
                        "Signature={$signature}";

        $headers = [
            'Authorization' => $authorization,
            'Content-Type' => 'application/json; charset=utf-8',
            'Host' => $this->endpoint,
            'X-TC-Action' => $action,
            'X-TC-Timestamp' => $timestamp,
            'X-TC-Version' => $version,
            'X-TC-Region' => $this->region,
        ];

        $response = Http::withHeaders($headers)
            ->timeout(10)
            ->post("https://{$this->endpoint}", $payload);

        if (!$response->successful()) {
            throw new \Exception('HTTP request failed: ' . $response->status());
        }

        return $response->json();
    }
}
