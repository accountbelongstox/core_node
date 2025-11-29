<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Helpers\GlobalSecretReader;
use App\Services\GeminiRateLimiter;

class GeminiClient
{
    const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
    
    const MODELS = [
        'gemini-2.5-flash' => 'gemini-2.5-flash',
        'gemini-2.0-flash-exp' => 'gemini-2.0-flash-exp',
        'gemini-1.5-flash' => 'gemini-1.5-flash',
        'gemini-1.5-pro' => 'gemini-1.5-pro',
    ];
    const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
    
    private $apiKey;
    private ?GeminiRateLimiter $rateLimiter = null;
    private int $defaultImageTokens = 200;
    
    public function __construct(?string $apiKey = null, ?GeminiRateLimiter $rateLimiter = null)
    {
        if ($apiKey === null) {
            $apiKey = GlobalSecretReader::getSecretContent('GOOGLE_API_KEY_1');
            if (!$apiKey) {
                $apiKey = GlobalSecretReader::getSecretContent('GEMINI_API_KEY');
            }
            if (!$apiKey) {
                $apiKey = env('GOOGLE_API_KEY_1') ?? env('GEMINI_API_KEY');
            }
        }
        
        if (!$apiKey) {
            Log::warning('[GeminiClient] No API key provided. Set GOOGLE_API_KEY_1 in .secret_keys/.secret_ignore/');
        }
        
        $this->apiKey = $apiKey;
        $this->rateLimiter = $rateLimiter ?? new GeminiRateLimiter();
    }
    
    public function hasApiKey(): bool
    {
        return !empty($this->apiKey);
    }

    private function buildHeaders(): array
    {
        return [
            'x-goog-api-key' => $this->apiKey,
            'Content-Type' => 'application/json',
        ];
    }
    
    public function generateContent(
        array $contents,
        ?string $model = null,
        array $generationConfig = [],
        int $timeout = 300,
        array $payloadOverrides = []
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
            $response = Http::withHeaders($this->buildHeaders())
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
        if ($limit = $this->throttle($options['token_estimate'] ?? $this->defaultImageTokens)) {
            return $limit;
        }

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
            $options['size'] ?? '1024x1024'
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

        if ($limit = $this->throttle($options['token_estimate'] ?? $this->defaultImageTokens)) {
            return $limit;
        }

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
            $options['size'] ?? '1024x1024'
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
        string $sizeConfig = '1024x1024'
    ): array {
        $response = $this->generateContent(
            $contents,
            $model ?? 'gemini-2.5-flash-image',
            $generationConfig,
            $timeout
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

    private function throttle(int $tokensEstimate, int $requests = 1): ?array
    {
        if (!$this->rateLimiter) {
            return null;
        }

        $result = $this->rateLimiter->reserve($tokensEstimate, $requests);
        if (!($result['allowed'] ?? false)) {
            $retry = $result['retry_after'] ?? 60;
            return [
                'success' => false,
                'error' => 'Gemini rate limit (' . ($result['reason'] ?? 'unknown') . ') reached. Retry after ' . $retry . ' seconds.',
                'retry_after' => $retry,
                'rate_limited' => true,
            ];
        }

        return null;
    }
}
