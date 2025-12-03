<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * DeepSeek AI Client
 *
 * Supports multiple API keys with automatic rotation and rate limiting.
 * Keys are auto-discovered: DEEPSEEK_API_KEY, DEEPSEEK_API_KEY_1, DEEPSEEK_API_KEY_2, ...
 *
 * Rate limits (per key): 1000 requests/minute, 100000 requests/day (paid service, virtually unlimited)
 * Effective limits scale with number of keys
 *
 * Supports: Text generation only
 * Priority: Fallback text provider
 */
class DeepSeekClient extends MultiKeyAIClientBase
{
    private const BASE_URL = 'https://api.deepseek.com';

    private const BASE_RATE_LIMITS = [
        'rpm' => 1000,
        'rpd' => 100000,
    ];

    public function __construct(?string $apiKey = null)
    {
        parent::__construct(
            'DEEPSEEK_API_KEY',
            self::BASE_RATE_LIMITS,
            'deepseek',
            $apiKey
        );
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

        // Acquire an available API key
        $keyResult = $this->acquireApiKey(1, 0, $keyword);

        if (!$keyResult['success']) {
            return [
                'success' => false,
                'error' => 'Rate limit exceeded',
                'rate_limited' => true,
                'retry_after' => $keyResult['retry_after'] ?? 60,
                'reason' => $keyResult['reason'] ?? 'unknown',
            ];
        }

        $apiKey = $keyResult['key'];

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
                'Authorization' => 'Bearer ' . $apiKey,
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
                    'provider' => 'deepseek',
                    'key_identifier' => $keyResult['identifier'],
                ];
            } else {
                $errorBody = $response->json();
                $error = $errorBody['error']['message'] ?? $response->body();

                Log::error('[DeepSeekClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'key_identifier' => $keyResult['identifier'],
                ]);

                return [
                    'success' => false,
                    'error' => $error,
                    'provider' => 'deepseek',
                ];
            }
        } catch (\Throwable $e) {
            Log::error('[DeepSeekClient] Exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'key_identifier' => $keyResult['identifier'],
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'provider' => 'deepseek',
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
}
