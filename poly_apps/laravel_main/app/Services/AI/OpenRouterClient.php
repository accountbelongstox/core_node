<?php

namespace App\Services\AI;

use App\Helpers\GlobalSecretReader;
use App\Services\AI\UnifiedRateLimiter;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * OpenRouter AI Client
 *
 * Rate limits: 20 requests/minute, 1000 requests/day
 * Supports: Text generation only
 * Priority: Primary text provider
 */
class OpenRouterClient
{
    private const BASE_URL = 'https://openrouter.ai/api/v1';

    private const RATE_LIMITS = [
        'rpm' => 20,
        'rpd' => 1000,
    ];

    private ?string $apiKey = null;
    private UnifiedRateLimiter $rateLimiter;
    private string $keyIdentifier;

    public function __construct(?string $apiKey = null)
    {
        $this->rateLimiter = new UnifiedRateLimiter();

        $this->apiKey = $apiKey ?? GlobalSecretReader::getSecretContent('OPENROUTER_API_KEY');

        if (!$this->apiKey) {
            Log::warning('[OpenRouterClient] No API key configured');
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
                'error' => 'OpenRouter API key not configured',
            ];
        }

        $rateLimitResult = $this->rateLimiter->acquire(
            'openrouter',
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
                'Authorization' => 'Bearer ' . $this->apiKey,
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
                ];
            } else {
                $errorBody = $response->json();
                $error = $errorBody['error']['message'] ?? $response->body();

                Log::error('[OpenRouterClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                ]);

                return [
                    'success' => false,
                    'error' => $error,
                ];
            }
        } catch (\Throwable $e) {
            Log::error('[OpenRouterClient] Exception: ' . $e->getMessage(), [
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

    /**
     * Get current usage statistics
     */
    public function getUsageStats(): array
    {
        return $this->rateLimiter->getUsage('openrouter', $this->keyIdentifier);
    }
}
