<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OpenRouter AI Client
 *
 * Supports multiple API keys with automatic rotation and rate limiting.
 * Keys are auto-discovered: OPENROUTER_API_KEY, OPENROUTER_API_KEY_1, OPENROUTER_API_KEY_2, ...
 *
 * Rate limits (per key): 20 requests/minute, 1000 requests/day
 * Effective limits scale with number of keys (2 keys = 40 req/min, 2000 req/day)
 *
 * Supports: Text generation only
 * Priority: Primary text provider
 */
class OpenRouterClient extends MultiKeyAIClientBase
{
    private const BASE_URL = 'https://openrouter.ai/api/v1';

    private const BASE_RATE_LIMITS = [
        'rpm' => 20,
        'rpd' => 1000,
    ];

    public function __construct(?string $apiKey = null)
    {
        parent::__construct(
            'OPENROUTER_API_KEY',
            self::BASE_RATE_LIMITS,
            'openrouter',
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
                'error' => 'OpenRouter API key not configured',
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
            'model' => $model ?? 'meta-llama/llama-3.1-8b-instruct:free',
            'messages' => $messages,
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
                'HTTP-Referer' => config('app.url'),
                'X-Title' => config('app.name'),
            ])
                ->timeout($options['timeout'] ?? 60)
                ->post(self::BASE_URL . '/chat/completions', $payload);

            if ($response->successful()) {
                $data = $response->json();

                return [
                    'success' => true,
                    'text' => $data['choices'][0]['message']['content'] ?? '',
                    'model' => $data['model'] ?? $model,
                    'usage' => $data['usage'] ?? null,
                    'raw' => $data,
                    'provider' => 'openrouter',
                    'key_identifier' => $keyResult['identifier'],
                ];
            } else {
                $errorBody = $response->json();
                $error = $errorBody['error']['message'] ?? $response->body();

                Log::error('[OpenRouterClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'key_identifier' => $keyResult['identifier'],
                ]);

                return [
                    'success' => false,
                    'error' => $error,
                    'provider' => 'openrouter',
                ];
            }
        } catch (\Throwable $e) {
            Log::error('[OpenRouterClient] Exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'key_identifier' => $keyResult['identifier'],
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'provider' => 'openrouter',
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
                'id' => 'meta-llama/llama-3.1-8b-instruct:free',
                'name' => 'Llama 3.1 8B (Free)',
                'provider' => 'openrouter',
                'type' => 'text',
            ],
            [
                'id' => 'google/gemini-flash-1.5',
                'name' => 'Gemini Flash 1.5',
                'provider' => 'openrouter',
                'type' => 'text',
            ],
            [
                'id' => 'anthropic/claude-3-5-sonnet',
                'name' => 'Claude 3.5 Sonnet',
                'provider' => 'openrouter',
                'type' => 'text',
            ],
        ];
    }
}
