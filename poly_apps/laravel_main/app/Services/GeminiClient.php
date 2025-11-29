<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Helpers\GlobalSecretReader;

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
    
    public function __construct(?string $apiKey = null)
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
        int $timeout = 300
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
        if (!$this->apiKey) {
            return [
                'success' => false,
                'error' => 'No Gemini API key configured',
            ];
        }

        $model = $options['model'] ?? 'gemini-2.0-flash-exp';
        $size = $options['size'] ?? '1024x1024';
        $timeout = $options['timeout'] ?? 180;

        $payload = [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'responseMimeType' => 'image/png',
                'imageGenerationConfig' => [
                    'size' => $size,
                ],
            ]
        ];

        try {
            $response = Http::withHeaders($this->buildHeaders())
                ->timeout($timeout)
                ->post(self::BASE_URL . "/models/{$model}:generateContent", $payload);

            if (!$response->successful()) {
                $body = $response->json();
                $error = $body['error']['message'] ?? $response->body();
                Log::error('[GeminiClient] Image request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'body' => $body,
                ]);
                return ['success' => false, 'error' => $error];
            }

            $data = $response->json();
            $inlineData = $data['candidates'][0]['content']['parts'][0]['inlineData'] ?? null;

            if (!$inlineData || empty($inlineData['data'])) {
                return [
                    'success' => false,
                    'error' => 'Image data not found in Gemini response',
                ];
            }

            return [
                'success' => true,
                'binary' => base64_decode($inlineData['data'], true),
                'mime_type' => $inlineData['mimeType'] ?? 'image/png',
            ];

        } catch (\Exception $e) {
            Log::error('[GeminiClient] Image generation exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
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
}
