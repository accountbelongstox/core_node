<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Services;

use App\Support\CoreNodeSecrets;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1RechargeModel;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

/**
 * Payment gateway integration for PddToolV1 recharges.
 *
 * Reads merchant credentials from CoreNodeSecrets (never .env / hardcode). When
 * credentials are absent, a `sandbox` mode is used: create() returns a fake
 * pay_url and the recharge is marked sandbox so the polling status endpoint can
 * immediately settle it (for end-to-end testing without real certs).
 *
 * Secret keys (CoreNodeSecrets, gvar store):
 *   PDD_TOOL_V1_ALIPAY_APP_ID, PDD_TOOL_V1_ALIPAY_PRIVATE_KEY,
 *   PDD_TOOL_V1_ALIPAY_PUBLIC_KEY,
 *   PDD_TOOL_V1_WECHAT_MCH_ID, PDD_TOOL_V1_WECHAT_APP_ID,
 *   PDD_TOOL_V1_WECHAT_API_V3_KEY, PDD_TOOL_V1_WECHAT_CERT_SERIAL,
 *   PDD_TOOL_V1_WECHAT_PRIVATE_KEY
 */
class PddToolV1PaymentService
{
    public const METHOD_ALIPAY = 'alipay';
    public const METHOD_WECHAT = 'wechat';

    private const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';
    private const WECHAT_NATIVE_URL = 'https://api.mch.weixin.qq.com/v3/pay/transactions/native';

    /**
     * Generate a unique out_trade_no.
     */
    public static function newOutTradeNo(): string
    {
        return 'PDD' . now()->format('YmdHis') . strtoupper(Str::random(8));
    }

    /**
     * Whether Alipay merchant credentials are fully configured.
     */
    public static function alipayConfigured(): bool
    {
        return CoreNodeSecrets::get('PDD_TOOL_V1_ALIPAY_APP_ID') !== null
            && CoreNodeSecrets::get('PDD_TOOL_V1_ALIPAY_PRIVATE_KEY') !== null;
    }

    /**
     * Whether WeChat Pay v3 merchant credentials are fully configured.
     */
    public static function wechatConfigured(): bool
    {
        return CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_MCH_ID') !== null
            && CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_API_V3_KEY') !== null
            && CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_PRIVATE_KEY') !== null;
    }

    /**
     * Create a payment for an already-persisted recharge row.
     *
     * Returns ['pay_url' => str|null, 'qr_code' => str|null, 'sandbox' => bool].
     * In sandbox mode (creds absent), returns a fake pay_url and flags sandbox.
     */
    public function create(PddToolV1RechargeModel $recharge): array
    {
        $method = (string) $recharge->method;
        $configured = $method === self::METHOD_WECHAT ? self::wechatConfigured() : self::alipayConfigured();

        if (!$configured) {
            // Sandbox: no merchant certs configured. Produce a fake, settle-able
            // payment so the recharge flow can be exercised end-to-end.
            $fakeUrl = url('/recharge/sandbox/' . $recharge->out_trade_no);
            return [
                'pay_url' => $fakeUrl,
                'qr_code' => $fakeUrl,
                'sandbox' => true,
            ];
        }

        return $method === self::METHOD_WECHAT
            ? $this->createWechat($recharge)
            : $this->createAlipay($recharge);
    }

    /**
     * Create an Alipay payment (alipay.trade.page.pay for PC redirect).
     */
    private function createAlipay(PddToolV1RechargeModel $recharge): array
    {
        $appId = CoreNodeSecrets::get('PDD_TOOL_V1_ALIPAY_APP_ID');
        $privateKey = CoreNodeSecrets::get('PDD_TOOL_V1_ALIPAY_PRIVATE_KEY');

        $bizContent = [
            'out_trade_no' => $recharge->out_trade_no,
            'product_code' => 'FAST_INSTANT_TRADE_PAY',
            'total_amount' => number_format((float) $recharge->amount, 2, '.', ''),
            'subject' => 'PddTool ' . ($recharge->package_name ?? 'recharge'),
        ];

        $params = [
            'app_id' => $appId,
            'method' => 'alipay.trade.page.pay',
            'format' => 'JSON',
            'charset' => 'utf-8',
            'sign_type' => 'RSA2',
            'timestamp' => now()->format('Y-m-d H:i:s'),
            'version' => '1.0',
            'notify_url' => url('/pay/alipay/notify'),
            'biz_content' => json_encode($bizContent, JSON_UNESCAPED_UNICODE),
        ];

        // TODO real cert: RSA2-sign $params with $privateKey and build the gateway
        // redirect URL. Requires the merchant private key (PDD_TOOL_V1_ALIPAY_PRIVATE_KEY).
        $sign = $this->rsaSign($this->buildSignString($params), $privateKey, OPENSSL_ALGO_SHA256);
        $params['sign'] = $sign;

        $payUrl = self::ALIPAY_GATEWAY . '?' . http_build_query($params);

        return [
            'pay_url' => $payUrl,
            'qr_code' => null,
            'sandbox' => false,
        ];
    }

    /**
     * Create a WeChat Pay v3 Native payment -> code_url (QR).
     */
    private function createWechat(PddToolV1RechargeModel $recharge): array
    {
        $mchId = CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_MCH_ID');
        $appId = CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_APP_ID');
        $serial = CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_CERT_SERIAL');
        $privateKey = CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_PRIVATE_KEY');

        $body = [
            'appid' => $appId,
            'mchid' => $mchId,
            'description' => 'PddTool ' . ($recharge->package_name ?? 'recharge'),
            'out_trade_no' => $recharge->out_trade_no,
            'notify_url' => url('/pay/wechat/notify'),
            'amount' => [
                'total' => (int) round(((float) $recharge->amount) * 100),
                'currency' => 'CNY',
            ],
        ];

        // TODO real cert: sign the v3 request (Authorization: WECHATPAY2-SHA256-RSA2048)
        // with the merchant private key + serial, POST to WECHAT_NATIVE_URL, read code_url.
        $codeUrl = $this->wechatNativeRequest($body, $mchId, $serial, $privateKey);

        return [
            'pay_url' => null,
            'qr_code' => $codeUrl,
            'sandbox' => false,
        ];
    }

    /**
     * Verify an Alipay async notify. Returns true when the signature is valid and
     * trade_status is success. Best-effort; logs and returns false on failure.
     */
    public function verifyAlipayNotify(array $payload): bool
    {
        $publicKey = CoreNodeSecrets::get('PDD_TOOL_V1_ALIPAY_PUBLIC_KEY');
        if (!$publicKey) {
            Log::warning('[PddToolV1Payment] alipay notify but no public key configured');
            return false;
        }

        $sign = $payload['sign'] ?? '';
        $signType = $payload['sign_type'] ?? 'RSA2';
        unset($payload['sign'], $payload['sign_type']);

        // TODO real cert: verify $sign over the alphabetically-sorted notify params
        // using the Alipay public key (PDD_TOOL_V1_ALIPAY_PUBLIC_KEY).
        $algo = $signType === 'RSA' ? OPENSSL_ALGO_SHA1 : OPENSSL_ALGO_SHA256;
        $verified = $this->rsaVerify($this->buildSignString($payload), $sign, $publicKey, $algo);

        $tradeStatus = $payload['trade_status'] ?? '';
        return $verified && in_array($tradeStatus, ['TRADE_SUCCESS', 'TRADE_FINISHED'], true);
    }

    /**
     * Verify a WeChat Pay v3 async notify. Returns the decrypted resource array on
     * success or null on failure. Best-effort; logs on failure.
     */
    public function verifyWechatNotify(array $payload, array $headers = []): ?array
    {
        $apiV3Key = CoreNodeSecrets::get('PDD_TOOL_V1_WECHAT_API_V3_KEY');
        if (!$apiV3Key) {
            Log::warning('[PddToolV1Payment] wechat notify but no api v3 key configured');
            return null;
        }

        $resource = $payload['resource'] ?? null;
        if (!is_array($resource)) {
            return null;
        }

        // TODO real cert: verify the platform-cert signature over the notify headers
        // + body, then AES-256-GCM decrypt $resource with the APIv3 key.
        $decrypted = $this->wechatDecryptResource($resource, $apiV3Key);
        if ($decrypted === null) {
            return null;
        }

        $tradeState = $decrypted['trade_state'] ?? '';
        return $tradeState === 'SUCCESS' ? $decrypted : null;
    }

    // ---- low-level crypto/HTTP helpers (single real-cert TODO sites) ----

    private function buildSignString(array $params): string
    {
        $params = array_filter($params, fn ($v) => $v !== '' && $v !== null);
        ksort($params);
        $pairs = [];
        foreach ($params as $k => $v) {
            $pairs[] = $k . '=' . $v;
        }
        return implode('&', $pairs);
    }

    private function rsaSign(string $data, ?string $privateKey, int $algo): string
    {
        if (!$privateKey) {
            return '';
        }
        $signature = '';
        $key = openssl_pkey_get_private($privateKey);
        if ($key === false) {
            return '';
        }
        openssl_sign($data, $signature, $key, $algo);
        return base64_encode($signature);
    }

    private function rsaVerify(string $data, string $sign, ?string $publicKey, int $algo): bool
    {
        if (!$publicKey || $sign === '') {
            return false;
        }
        $key = openssl_pkey_get_public($publicKey);
        if ($key === false) {
            return false;
        }
        return openssl_verify($data, base64_decode($sign), $key, $algo) === 1;
    }

    private function wechatNativeRequest(array $body, ?string $mchId, ?string $serial, ?string $privateKey): ?string
    {
        // TODO real cert: build the WECHATPAY2-SHA256-RSA2048 Authorization header
        // and POST $body to WECHAT_NATIVE_URL; parse code_url from the response.
        try {
            $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
            $ch = curl_init(self::WECHAT_NATIVE_URL);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $payload,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Accept: application/json',
                ],
                CURLOPT_TIMEOUT => 15,
            ]);
            $response = curl_exec($ch);
            curl_close($ch);
            $decoded = json_decode((string) $response, true);
            return $decoded['code_url'] ?? null;
        } catch (\Throwable $e) {
            Log::error('[PddToolV1Payment] wechat native request failed: ' . $e->getMessage());
            return null;
        }
    }

    private function wechatDecryptResource(array $resource, string $apiV3Key): ?array
    {
        try {
            $ciphertext = base64_decode($resource['ciphertext'] ?? '');
            $nonce = $resource['nonce'] ?? '';
            $associatedData = $resource['associated_data'] ?? '';

            $tagLength = 16;
            $tag = substr($ciphertext, -$tagLength);
            $data = substr($ciphertext, 0, -$tagLength);

            $plain = openssl_decrypt(
                $data,
                'aes-256-gcm',
                $apiV3Key,
                OPENSSL_RAW_DATA,
                $nonce,
                $tag,
                $associatedData
            );

            if ($plain === false) {
                return null;
            }
            return json_decode($plain, true);
        } catch (\Throwable $e) {
            Log::error('[PddToolV1Payment] wechat decrypt failed: ' . $e->getMessage());
            return null;
        }
    }
}
