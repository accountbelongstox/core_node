<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Helpers\GlobalSecretReader;
use App\Services\AI\UnifiedRateLimiter;

class GeminiClient
{
    const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

    private const RATE_LIMITS = [
        'rpm' => 25,
        'tpm' => 250000,
        'rpd' => 100,
    ];

    const MODELS = [
        'gemini-2.5-flash' => 'gemini-2.5-flash',
        'gemini-2.0-flash-exp' => 'gemini-2.0-flash-exp',
        'gemini-1.5-flash' => 'gemini-1.5-flash',
        'gemini-1.5-pro' => 'gemini-1.5-pro',
    ];
    const TTS_MODEL = 'gemini-2.5-flash-preview-tts';

    private ?string $apiKey = null;
    private int $defaultImageTokens = 200;
    private array $keyPool = [];
    private ?string $primaryKey = null;
    private UnifiedRateLimiter $rateLimiter;

    public function __construct(?string $apiKey = null)
    {
        $this->rateLimiter = new UnifiedRateLimiter();

        $keys = $this->resolveApiKeys($apiKey);

        if (empty($keys)) {
            Log::warning('[GeminiClient] No API key provided. Set GOOGLE_API_KEY_1/2 in .secret_keys/.secret_ignore/');
            return;
        }

        foreach ($keys as $index => $keyValue) {
            $identifier = $this->buildKeyIdentifier($index, $keyValue);
            $this->keyPool[] = [
                'key' => $keyValue,
                'identifier' => $identifier,
            ];
        }

        $this->primaryKey = $this->keyPool[0]['key'] ?? null;
        $this->apiKey = $this->primaryKey;
    }

    public function hasApiKey(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Live availability probe for the AI status endpoint.
     *
     * Lists models via the Generative Language REST API. Returns the same shape
     * as OpenRouterClient::probe / pycore ai_probe (available / models / error /
     * latency_ms). Gemini model names come back as "models/gemini-..." ids.
     */
    public function probe(int $maxModels = 5, int $timeout = 20): array
    {
        $result = [
            'available' => false,
            'models' => [],
            'error' => $this->apiKey ? null : 'No API key configured',
            'latency_ms' => null,
        ];

        if (!$this->apiKey) {
            return $result;
        }

        $start = microtime(true);
        try {
            $response = Http::withHeaders($this->buildHeaders())
                ->timeout($timeout)
                ->get(self::BASE_URL . '/models');

            if ($response->successful()) {
                $models = $response->json()['models'] ?? [];
                $ids = [];
                foreach ($models as $model) {
                    $id = $model['name'] ?? ($model['displayName'] ?? null);
                    if ($id) {
                        $ids[] = $id;
                    }
                    if (count($ids) >= $maxModels) {
                        break;
                    }
                }
                $result['available'] = true;
                $result['models'] = $ids;
            } else {
                $body = $response->json();
                $result['error'] = $body['error']['message'] ?? ('HTTP ' . $response->status());
            }
        } catch (\Exception $e) {
            $result['error'] = $e->getMessage();
        }

        $result['latency_ms'] = round((microtime(true) - $start) * 1000, 1);
        return $result;
    }

    private function buildHeaders(?string $apiKey = null): array
    {
        $key = $apiKey ?? $this->primaryKey;
        return [
            'x-goog-api-key' => $key,
            'Content-Type' => 'application/json',
        ];
    }

    public function generateContent(
        array $contents,
        ?string $model = null,
        array $generationConfig = [],
        int $timeout = 300,
        array $payloadOverrides = [],
        ?string $apiKeyOverride = null
    ): array {
        if (!$this->apiKey) {
            return ['error' => 'No API key configured'];
        }

        $requestedModel = $model;

        if ($model === null) {
            $model = self::MODELS['gemini-2.5-flash'];
        } elseif (isset(self::MODELS[$model])) {
            $model = self::MODELS[$model];
        }

        $payload = [
            'contents' => $contents,
        ];

        if (!empty($generationConfig)) {
            $payload['generationConfig'] = $generationConfig;
        }

        if (!empty($payloadOverrides)) {
            $payload = array_merge($payload, $payloadOverrides);
        }

        Log::info('[GeminiClient] Request', [
            'requested_model' => $requestedModel,
            'resolved_model' => $model,
            'contents_count' => count($contents),
        ]);

        try {
            $response = Http::withHeaders($this->buildHeaders($apiKeyOverride))
                ->timeout($timeout)
                ->post(self::BASE_URL . "/models/{$model}:generateContent", $payload);

            if ($response->successful()) {
                return $response->json();
            } else {
                $errorBody = $response->json();
                $error = $errorBody['error']['message'] ?? $response->body();
                Log::error('[GeminiClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'body' => $errorBody,
                ]);
                return ['error' => $error];
            }
        } catch (\Exception $e) {
            Log::error('[GeminiClient] Exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return ['error' => $e->getMessage()];
        }
    }

    public function extractTextFromResponse(array $response): string
    {
        if (isset($response['candidates'][0]['content']['parts'])) {
            $parts = $response['candidates'][0]['content']['parts'];
            $texts = array_map(function($part) {
                return $part['text'] ?? '';
            }, $parts);
            return implode('', $texts);
        }

        return '';
    }

    public function chat(
        string $prompt,
        ?string $model = null,
        ?string $systemPrompt = null,
        array $extra = [],
        int $timeout = 300
    ): string {
        $contents = [];

        if ($systemPrompt) {
            $contents[] = [
                'role' => 'user',
                'parts' => [
                    ['text' => "System instruction: {$systemPrompt}\n\nUser: {$prompt}"]
                ]
            ];
        } else {
            $contents[] = [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt]
                ]
            ];
        }

        $generationConfig = [];
        if (isset($extra['temperature'])) {
            $generationConfig['temperature'] = $extra['temperature'];
        }
        if (isset($extra['top_p'])) {
            $generationConfig['topP'] = $extra['top_p'];
        }
        if (isset($extra['top_k'])) {
            $generationConfig['topK'] = $extra['top_k'];
        }
        if (isset($extra['max_tokens'])) {
            $generationConfig['maxOutputTokens'] = $extra['max_tokens'];
        }

        $response = $this->generateContent($contents, $model, $generationConfig, $timeout);

        if (isset($response['error'])) {
            return 'Error: ' . $response['error'];
        }

        return $this->extractTextFromResponse($response);
    }

    public function generateImage(string $prompt, array $options = []): array
    {
        return $this->generateImageFromPrompt($prompt, $options);
    }

    public function generateImageFromPrompt(string $prompt, array $options = []): array
    {
        $reservation = $this->acquireApiKey($options['token_estimate'] ?? $this->defaultImageTokens);
        if (!($reservation['success'] ?? false)) {
            return $reservation;
        }
        $selectedKey = $reservation['key'];

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                ],
            ],
        ];

        $generationConfig = $this->buildImageGenerationConfig($options);

        return $this->sendImageRequest(
            $contents,
            $generationConfig,
            $options['model'] ?? 'gemini-2.5-flash-image',
            $options['timeout'] ?? 180,
            $options['size'] ?? '1024x1024',
            $selectedKey
        );
    }

    public function generateImageWithReference(string $prompt, string $imagePath, array $options = []): array
    {
        if (!$this->apiKey) {
            return [
                'success' => false,
                'error' => 'No Gemini API key configured',
            ];
        }

        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => 'Reference image not found: ' . $imagePath,
            ];
        }

        $reservation = $this->acquireApiKey($options['token_estimate'] ?? $this->defaultImageTokens);
        if (!($reservation['success'] ?? false)) {
            return $reservation;
        }
        $selectedKey = $reservation['key'];

        $mimeType = $options['mime_type'] ?? mime_content_type($imagePath) ?: 'image/png';
        $imageData = base64_encode(file_get_contents($imagePath));

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => $mimeType,
                            'data' => $imageData,
                        ],
                    ],
                ],
            ],
        ];

        $generationConfig = $this->buildImageGenerationConfig($options);

        return $this->sendImageRequest(
            $contents,
            $generationConfig,
            $options['model'] ?? 'gemini-2.5-flash-image',
            $options['timeout'] ?? 180,
            $options['size'] ?? '1024x1024',
            $selectedKey
        );
    }

    public function generateMultimodalContent(
        array $history,
        string $prompt,
        array $options = []
    ): array {
        $contents = array_values($history);
        $contents[] = [
            'role' => 'user',
            'parts' => [
                ['text' => $prompt],
            ],
        ];

        $generationConfig = $options['generation_config'] ?? [];
        if (!isset($generationConfig['responseModalities'])) {
            $generationConfig['responseModalities'] = ['TEXT', 'IMAGE'];
        }
        if (isset($options['image_config'])) {
            $generationConfig['imageConfig'] = $options['image_config'];
        }

        $payloadOverrides = [];
        if (!empty($options['tools'])) {
            $payloadOverrides['tools'] = $options['tools'];
        }

        $response = $this->generateContent(
            $contents,
            $options['model'] ?? 'gemini-3-pro-image-preview',
            $generationConfig,
            $options['timeout'] ?? 300,
            $payloadOverrides
        );

        if (isset($response['error'])) {
            return [
                'success' => false,
                'error' => $response['error'],
            ];
        }

        return [
            'success' => true,
            'text' => $this->extractTextFromResponse($response),
            'images' => $this->extractInlineImages($response),
            'raw' => $response,
        ];
    }

    public function getModels(): array
    {
        return [
            [
                'id' => 'gemini-2.5-flash',
                'name' => 'Gemini 2.5 Flash',
                'provider' => 'gemini',
                'context_length' => 1000000,
            ],
            [
                'id' => 'gemini-2.0-flash-exp',
                'name' => 'Gemini 2.0 Flash Exp',
                'provider' => 'gemini',
                'context_length' => 1000000,
            ],
            [
                'id' => 'gemini-1.5-flash',
                'name' => 'Gemini 1.5 Flash',
                'provider' => 'gemini',
                'context_length' => 1000000,
            ],
            [
                'id' => 'gemini-1.5-pro',
                'name' => 'Gemini 1.5 Pro',
                'provider' => 'gemini',
                'context_length' => 2000000,
            ],
        ];
    }

    public function analyzeImage(
        string $imagePath,
        string $prompt,
        ?string $model = null,
        int $timeout = 120
    ): array {
        if (!$this->apiKey) {
            return [
                'success' => false,
                'error' => 'No Gemini API key configured',
            ];
        }

        if (!file_exists($imagePath)) {
            return [
                'success' => false,
                'error' => 'Image file not found: ' . $imagePath,
            ];
        }

        $mimeType = mime_content_type($imagePath) ?: 'image/png';
        $imageData = base64_encode(file_get_contents($imagePath));

        $contents = [
            [
                'role' => 'user',
                'parts' => [
                    ['text' => $prompt],
                    [
                        'inline_data' => [
                            'mime_type' => $mimeType,
                            'data' => $imageData,
                        ],
                    ],
                ],
            ],
        ];

        $response = $this->generateContent($contents, $model, [], $timeout);

        if (isset($response['error'])) {
            return [
                'success' => false,
                'error' => $response['error'],
            ];
        }

        return [
            'success' => true,
            'text' => $this->extractTextFromResponse($response),
            'raw' => $response,
        ];
    }

    public function generateAudio(
        array $parts,
        array $speechConfig = [],
        ?string $model = null,
        int $timeout = 120
    ): array {
        if (!$this->apiKey) {
            return [
                'success' => false,
                'error' => 'No Gemini API key configured',
            ];
        }

        $model = $model ?? self::TTS_MODEL;

        $payload = [
            'contents' => [
                [
                    'parts' => $parts,
                ],
            ],
            'generationConfig' => [
                'responseModalities' => ['AUDIO'],
            ],
        ];

        if (!empty($speechConfig)) {
            $payload['generationConfig']['speechConfig'] = $speechConfig;
        }

        try {
            $response = Http::withHeaders($this->buildHeaders())
                ->timeout($timeout)
                ->post(self::BASE_URL . "/models/{$model}:generateContent", $payload);

            if (!$response->successful()) {
                $body = $response->json();
                $error = $body['error']['message'] ?? $response->body();
                Log::error('[GeminiClient] Audio request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'body' => $body,
                ]);
                return ['success' => false, 'error' => $error];
            }

            $data = $response->json();
            $audioBase64 = $data['candidates'][0]['content']['parts'][0]['inlineData']['data'] ?? null;

            if (!$audioBase64) {
                return [
                    'success' => false,
                    'error' => 'Audio data not found in Gemini response',
                ];
            }

            $binary = base64_decode($audioBase64, true);

            return [
                'success' => true,
                'audio_base64' => $audioBase64,
                'audio_binary' => $binary,
                'raw' => $data,
            ];

        } catch (\Exception $e) {
            Log::error('[GeminiClient] Audio generation exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function buildImageGenerationConfig(array $options): array
    {
        $config = [];

        if (!empty($options['image_config'])) {
            $config['imageConfig'] = $options['image_config'];
        }

        if (!empty($options['response_modalities'])) {
            $config['responseModalities'] = (array) $options['response_modalities'];
        }

        return $config;
    }

    private function sendImageRequest(
        array $contents,
        array $generationConfig,
        ?string $model,
        int $timeout,
        string $sizeConfig = '1024x1024',
        ?string $apiKey = null
    ): array {
        $response = $this->generateContent(
            $contents,
            $model ?? 'gemini-2.5-flash-image',
            $generationConfig,
            $timeout,
            [],
            $apiKey
        );

        if (isset($response['error'])) {
            return [
                'success' => false,
                'error' => $response['error'],
            ];
        }

        $images = $this->extractInlineImages($response);
        if (empty($images)) {
            return [
                'success' => false,
                'error' => 'Image data not found in Gemini response',
            ];
        }

        [$width, $height] = $this->parseImageSize($sizeConfig);

        return [
            'success' => true,
            'binary' => base64_decode($images[0]['data'], true),
            'mime_type' => $images[0]['mime_type'],
            'width' => $width,
            'height' => $height,
            'raw' => $response,
        ];
    }

    private function parseImageSize(string $size): array
    {
        if (str_contains($size, 'x')) {
            [$width, $height] = explode('x', $size, 2);
            return [(int) $width, (int) $height];
        }

        return [1024, 1024];
    }

    private function extractInlineImages(array $response): array
    {
        $images = [];

        if (!isset($response['candidates'])) {
            return $images;
        }

        foreach ($response['candidates'] as $candidate) {
            $parts = $candidate['content']['parts'] ?? [];
            foreach ($parts as $part) {
                if (isset($part['inlineData']['data'])) {
                    $images[] = [
                        'mime_type' => $part['inlineData']['mimeType'] ?? 'image/png',
                        'data' => $part['inlineData']['data'],
                    ];
                }
            }
        }

        return $images;
    }

    private function resolveApiKeys(?string $apiKeyOverride): array
    {
        $keys = [];
        $append = function (?string $key) use (&$keys) {
            $key = is_string($key) ? trim($key) : '';
            if ($key !== '' && !in_array($key, $keys, true)) {
                $keys[] = $key;
            }
        };

        $sources = [
            $apiKeyOverride,
            GlobalSecretReader::getSecretContent('GOOGLE_API_KEY_1'),
            GlobalSecretReader::getSecretContent('GOOGLE_API_KEY_2'),
        ];

        foreach ($sources as $candidate) {
            $append($candidate);
        }

        return $keys;
    }

    private function buildKeyIdentifier(int $index, string $key): string
    {
        $hash = substr(md5($key), 0, 10);
        return 'key' . ($index + 1) . '_' . $hash;
    }

    private function acquireApiKey(int $tokensEstimate, int $requests = 1): array
    {
        if (empty($this->keyPool)) {
            return [
                'success' => false,
                'error' => 'No Gemini API key configured',
            ];
        }

        $failures = [];

        foreach ($this->keyPool as $entry) {
            $result = $this->rateLimiter->acquire(
                'gemini',
                $entry['identifier'],
                self::RATE_LIMITS,
                $requests,
                $tokensEstimate
            );

            if ($result['allowed'] ?? false) {
                return [
                    'success' => true,
                    'key' => $entry['key'],
                    'identifier' => $entry['identifier'],
                ];
            }

            $failures[] = [
                'identifier' => $entry['identifier'],
                'retry_after' => $result['retry_after'] ?? 60,
                'reason' => $result['reason'] ?? 'unknown',
            ];
        }

        $retryAfter = 60;
        if (!empty($failures)) {
            $retryAfter = min(array_map(static function ($failure) {
                return $failure['retry_after'] ?? 60;
            }, $failures));
        }

        return [
            'success' => false,
            'error' => 'All Gemini API keys are rate limited',
            'retry_after' => $retryAfter,
            'rate_limited' => true,
            'details' => $failures,
        ];
    }

    public function getUsageStats(): array
    {
        $stats = [];

        foreach ($this->keyPool as $entry) {
            $stats[$entry['identifier']] = $this->rateLimiter->getUsage('gemini', $entry['identifier']);
        }

        return $stats;
    }
}
