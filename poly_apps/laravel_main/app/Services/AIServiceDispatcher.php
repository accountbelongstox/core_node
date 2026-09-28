<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use App\Utils\SecretStore;

class AIServiceDispatcher
{
    const PROVIDER_GEMINI = 'gemini';
    const PROVIDER_OPENROUTER = 'openrouter';
    const PROVIDER_DEEPSEEK = 'deepseek';
    const PROVIDER_AUTO = 'auto';

    private $defaultProvider;
    private $openRouterClient;
    private $geminiClient;

    public function __construct(?string $defaultProvider = null)
    {
        $this->defaultProvider = $defaultProvider ?? self::PROVIDER_AUTO;
        $this->openRouterClient = new OpenRouterClient();
        $this->geminiClient = new GeminiClient();
    }

    public function chat(
        string $prompt,
        ?string $provider = null,
        ?string $model = null,
        ?string $systemPrompt = null,
        array $extra = [],
        int $timeout = 300
    ): array {
        $provider = $provider ?? $this->defaultProvider;

        if ($provider === self::PROVIDER_AUTO) {
            $provider = $this->selectBestProvider($prompt, $model);
        }

        Log::info('[AIServiceDispatcher] Dispatching request', [
            'provider' => $provider,
            'model' => $model,
            'prompt_length' => strlen($prompt),
        ]);

        try {
            switch ($provider) {
                case self::PROVIDER_GEMINI:
                    return $this->chatWithGemini($prompt, $model, $systemPrompt, $timeout);

                case self::PROVIDER_OPENROUTER:
                    return $this->chatWithOpenRouter($prompt, $model, $systemPrompt, $extra, $timeout);

                case self::PROVIDER_DEEPSEEK:
                    return $this->chatWithDeepSeek($prompt, $model, $systemPrompt, $extra, $timeout);

                default:
                    return [
                        'success' => false,
                        'error' => 'Unknown provider: ' . $provider,
                    ];
            }
        } catch (\Exception $e) {
            Log::error('[AIServiceDispatcher] Exception', [
                'provider' => $provider,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function chatWithGemini(
        string $prompt,
        ?string $model,
        ?string $systemPrompt,
        int $timeout
    ): array {
        $contents = [];

        if ($systemPrompt) {
            $contents[] = [
                'role' => 'user',
                'parts' => [
                    ['text' => "System instruction: {$systemPrompt}\n\nUser: {$prompt}"],
                ],
            ];
        } else {
            $contents[] = [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                ],
            ];
        }

        $response = $this->geminiClient->generateContent($contents, $model, [], $timeout);

        if (isset($response['error'])) {
            return [
                'success' => false,
                'error' => $response['error'],
                'provider' => self::PROVIDER_GEMINI,
            ];
        }

        $content = $this->geminiClient->extractTextFromResponse($response);

        return [
            'success' => true,
            'content' => $content,
            'provider' => self::PROVIDER_GEMINI,
            'model' => $model ?? GeminiClient::MODELS['gemini-2.5-flash'],
            'raw_response' => $response,
        ];
    }

    private function chatWithOpenRouter(
        string $prompt,
        ?string $model,
        ?string $systemPrompt,
        array $extra,
        int $timeout
    ): array {
        $content = $this->openRouterClient->chat(
            $prompt,
            $model,
            $systemPrompt,
            $extra,
            $timeout
        );

        if (str_starts_with($content, 'Error: ')) {
            return [
                'success' => false,
                'error' => substr($content, 7),
                'provider' => self::PROVIDER_OPENROUTER,
            ];
        }

        return [
            'success' => true,
            'content' => $content,
            'provider' => self::PROVIDER_OPENROUTER,
            'model' => $model,
        ];
    }

    private function chatWithDeepSeek(
        string $prompt,
        ?string $model,
        ?string $systemPrompt,
        array $extra,
        int $timeout
    ): array {
        $apiKey = config('deepseek.api_key');

        if (!$apiKey) {
            $apiKey = SecretStore::get('DEEPSEEK_API_KEY');
        }

        if (!$apiKey) {
            return [
                'success' => false,
                'error' => 'DeepSeek API key not configured',
                'provider' => self::PROVIDER_DEEPSEEK,
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
        ];

        if (!empty($extra)) {
            $payload = array_merge($payload, $extra);
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])
            ->timeout($timeout)
            ->post('https://api.deepseek.com/v1/chat/completions', $payload);

            if (!$response->successful()) {
                return [
                    'success' => false,
                    'error' => 'DeepSeek API error: ' . $response->body(),
                    'provider' => self::PROVIDER_DEEPSEEK,
                ];
            }

            $result = $response->json();
            $content = $result['choices'][0]['message']['content'] ?? '';

            return [
                'success' => true,
                'content' => $content,
                'provider' => self::PROVIDER_DEEPSEEK,
                'model' => $result['model'] ?? $model,
                'raw_response' => $result,
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'DeepSeek request failed: ' . $e->getMessage(),
                'provider' => self::PROVIDER_DEEPSEEK,
            ];
        }
    }

    private function selectBestProvider(string $prompt, ?string $model): string
    {
        if ($model) {
            if (str_contains($model, 'gemini')) {
                return self::PROVIDER_GEMINI;
            }
            if (str_contains($model, 'deepseek')) {
                return self::PROVIDER_DEEPSEEK;
            }
        }

        $promptLength = strlen($prompt);

        if ($promptLength > 50000) {
            return self::PROVIDER_GEMINI;
        }

        return self::PROVIDER_OPENROUTER;
    }

    public function summarizeText(
        string $text,
        ?string $provider = null,
        ?string $model = null
    ): array {
        $prompt = "Please summarize the following text concisely:\n\n" . $text;

        return $this->chat($prompt, $provider, $model);
    }

    public function analyzeImage(
        string $imagePath,
        string $prompt = "Describe this image in detail and extract any text from it.",
        ?string $provider = null
    ): array {
        $provider = $provider ?? self::PROVIDER_GEMINI;

        if ($provider !== self::PROVIDER_GEMINI) {
            return [
                'success' => false,
                'error' => 'Image analysis is only supported with Gemini provider',
            ];
        }

        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => 'Image file not found: ' . $imagePath,
            ];
        }

        $result = $this->geminiClient->analyzeImage($imagePath, $prompt, null, 120);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'],
                'provider' => self::PROVIDER_GEMINI,
            ];
        }

        return [
            'success' => true,
            'content' => $result['text'] ?? '',
            'provider' => self::PROVIDER_GEMINI,
            'raw_response' => $result['raw'] ?? null,
        ];
    }

    public function synthesizeSpeech(
        string $script,
        array $speechConfig = [],
        ?string $model = null,
        int $timeout = 120
    ): array {
        if (!$this->geminiClient->hasApiKey()) {
            return [
                'success' => false,
                'error' => 'No Gemini API key configured',
            ];
        }

        $parts = [
            [
                'text' => $script,
            ],
        ];

        $result = $this->geminiClient->generateAudio($parts, $speechConfig, $model, $timeout);

        if (!$result['success']) {
            return [
                'success' => false,
                'error' => $result['error'] ?? 'Gemini audio generation failed',
            ];
        }

        return [
            'success' => true,
            'audio_base64' => $result['audio_base64'],
            'audio_binary' => $result['audio_binary'],
            'provider' => self::PROVIDER_GEMINI,
            'model' => $model ?? GeminiClient::TTS_MODEL,
            'raw_response' => $result['raw'],
        ];
    }

    public function organizeText(
        string $text,
        ?string $provider = null,
        ?string $model = null
    ): array {
        $prompt = "Please organize and structure the following text in a clear, readable format:\n\n" . $text;

        return $this->chat($prompt, $provider, $model);
    }

    public function getAvailableProviders(): array
    {
        return [
            self::PROVIDER_AUTO,
            self::PROVIDER_GEMINI,
            self::PROVIDER_OPENROUTER,
            self::PROVIDER_DEEPSEEK,
        ];
    }

    public function getProviderStatus(): array
    {
        $status = [];

        $status[self::PROVIDER_GEMINI] = [
            'available' => $this->checkGeminiAvailable(),
            'name' => 'Google Gemini',
        ];

        $status[self::PROVIDER_OPENROUTER] = [
            'available' => $this->checkOpenRouterAvailable(),
            'name' => 'OpenRouter',
        ];

        $status[self::PROVIDER_DEEPSEEK] = [
            'available' => $this->checkDeepSeekAvailable(),
            'name' => 'DeepSeek',
        ];

        return $status;
    }

    private function checkGeminiAvailable(): bool
    {
        return $this->geminiClient->hasApiKey();
    }

    private function checkOpenRouterAvailable(): bool
    {
        $apiKey = SecretStore::get('OPENROUTER_API_KEY_1');
        return !empty($apiKey);
    }

    private function checkDeepSeekAvailable(): bool
    {
        $apiKey = config('deepseek.api_key');
        if (!$apiKey) {
            $apiKey = SecretStore::get('DEEPSEEK_API_KEY');
        }
        return !empty($apiKey);
    }
}
