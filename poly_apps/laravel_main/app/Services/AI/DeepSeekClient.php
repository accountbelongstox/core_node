<?php

namespace App\Services\AI;

use App\Helpers\GlobalSecretReader;
use App\Services\AI\UnifiedRateLimiter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * DeepSeek AI Client
 *
 * Rate limits: None (paid service)
 * Supports: Text generation only
 * Priority: Fallback text provider
 */
class DeepSeekClient
{
    private const BASE_URL = 'https://api.deepseek.com';

    private const RATE_LIMITS = [
        'rpm' => 1000,
        'rpd' => 100000,
    ];

    private ?string $apiKey = null;
    private UnifiedRateLimiter $rateLimiter;
    private string $keyIdentifier;

    public function __construct(?string $apiKey = null)
    {
        $this->rateLimiter = new UnifiedRateLimiter();

        $this->apiKey = $apiKey ?? GlobalSecretReader::getSecretContent('DEEPSEEK_API_KEY');

        if (!$this->apiKey) {
            Log::warning('[DeepSeekClient] No API key configured');
        }

        $this->keyIdentifier = $this->apiKey ? substr(md5($this->apiKey), 0, 10) : 'none';
    }

    /**
     * Check if client has API key configured
     */
    public function hasApiKey(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Generate text completion
     */
    public function chat(
        string $prompt,
        ?string $model = null,
        ?string $systemPrompt = null,
        array $options = [],
        ?string $keyword = null
    ): array {
        if (!$this->hasApiKey()) {
            return [
                'success' => false,
                'error' => 'DeepSeek API key not configured',
            ];
        }

        $rateLimitResult = $this->rateLimiter->acquire(
            'deepseek',
            $this->keyIdentifier,
            self::RATE_LIMITS,
            1,
            0,
            $keyword
        );

        if (!$rateLimitResult['allowed']) {
            return [
                'success' => false,
                'error' => 'Rate limit exceeded',
                'rate_limited' => true,
                'retry_after' => $rateLimitResult['retry_after'] ?? 60,
                'reason' => $rateLimitResult['reason'] ?? 'unknown',
            ];
        }

        $messages = [];

        if ($systemPrompt) {
            $messages[] = [
                'role' => 'system',
                'content' => $systemPrompt,
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $prompt,
        ];

        $payload = [
            'model' => $model ?? 'deepseek-chat',
            'messages' => $messages,
            'stream' => false,
        ];

        if (isset($options['temperature'])) {
            $payload['temperature'] = $options['temperature'];
        }

        if (isset($options['max_tokens'])) {
            $payload['max_tokens'] = $options['max_tokens'];
        }

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])
                ->timeout($options['timeout'] ?? 60)
                ->post(self::BASE_URL . '/v1/chat/completions', $payload);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success' => true,
                    'text' => $data['choices'][0]['message']['content'] ?? '',
                    'model' => $data['model'] ?? $model,
                    'usage' => $data['usage'] ?? null,
                    'raw' => $data,
                ];
            } else {
                $errorBody = $response->json();
                $error = $errorBody['error']['message'] ?? $response->body();

                Log::error('[DeepSeekClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                ]);

                return [
                    'success' => false,
                    'error' => $error,
                ];
            }
        } catch (\Throwable $e) {
            Log::error('[DeepSeekClient] Exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Get available models
     */
    public function getModels(): array
    {
        return [
            [
                'id' => 'deepseek-chat',
                'name' => 'DeepSeek Chat',
                'provider' => 'deepseek',
                'type' => 'text',
            ],
            [
                'id' => 'deepseek-coder',
                'name' => 'DeepSeek Coder',
                'provider' => 'deepseek',
                'type' => 'text',
            ],
        ];
    }

    /**
     * Get current usage statistics
     */
    public function getUsageStats(): array
    {
        return $this->rateLimiter->getUsage('deepseek', $this->keyIdentifier);
    }
}
