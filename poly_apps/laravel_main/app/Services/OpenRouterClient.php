<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Helpers\GlobalSecretReader;

class OpenRouterClient
{
    const BASE_URL = 'https://openrouter.ai/api/v1';
    
    // 'free' maps to OpenRouter's documented Free Models Router alias
    // (https://openrouter.ai/docs/guides/routing/routers/free-router), which
    // auto-selects an available free model. The old pinned free model
    // (tngtech/deepseek-r1t2-chimera:free) was retired upstream and now 404s,
    // so a static id is no longer a safe default.
    const MODELS = [
        'free' => 'openrouter/free',
        'auto' => 'openrouter/auto',
        'deepseek-r1' => 'deepseek/deepseek-r1',
        'deepseek-v3' => 'deepseek/deepseek-v3',
        'gpt-4o' => 'openai/gpt-4o',
        'gpt-4o-mini' => 'openai/gpt-4o-mini',
        'gpt-4-turbo' => 'openai/gpt-4-turbo',
        'gpt-3.5-turbo' => 'openai/gpt-3.5-turbo',
        'claude-3.5-sonnet' => 'anthropic/claude-3.5-sonnet',
        'claude-3-opus' => 'anthropic/claude-3-opus',
        'claude-3-haiku' => 'anthropic/claude-3-haiku',
        'gemini-pro' => 'google/gemini-pro',
        'gemini-flash' => 'google/gemini-flash',
        'llama-3.3-70b' => 'meta-llama/llama-3.3-70b-instruct',
        'llama-3.1-405b' => 'meta-llama/llama-3.1-405b-instruct',
    ];

    // In-request fallback list (OpenRouter `models` array). If the primary model
    // is unavailable/over-quota, OpenRouter transparently tries the next one.
    const FALLBACK_MODELS = [
        'openrouter/free',
        'nvidia/nemotron-3-super-120b-a12b:free',
    ];

    private $apiKey;
    
    public function __construct(?string $apiKey = null)
    {
        if ($apiKey === null) {
            $apiKey = GlobalSecretReader::getSecretContent('OPENROUTER_API_KEY_1');
            if (!$apiKey) {
                $apiKey = GlobalSecretReader::getSecretContent('OPENROUTER_API_KEY');
            }
            if (!$apiKey) {
                $apiKey = env('OPENROUTER_API_KEY_1') ?? env('OPENROUTER_API_KEY');
            }
        }
        
        if (!$apiKey) {
            Log::warning('[OpenRouterClient] No API key provided. Set OPENROUTER_API_KEY_1 in .secret_keys/.secret_ignore/');
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
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ];
    }
    
    public function chatCompletion(
        array $messages,
        ?string $model = null,
        array $extra = [],
        int $timeout = 300
    ): array {
        if (!$this->apiKey) {
            return ['error' => 'No API key configured'];
        }
        
        $requestedModel = $model;
        
        if ($model === null) {
            $model = self::MODELS['free'];
        } elseif (isset(self::MODELS[$model])) {
            $model = self::MODELS[$model];
        }
        
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'temperature' => 1.0,
            'top_p' => 1.0,
        ];

        // When the caller did not pin a specific model, add OpenRouter's
        // in-request `models` fallback array so a single dead/over-quota free
        // model never fails the whole request.
        if ($requestedModel === null && !isset($extra['models'])) {
            $fallbacks = array_values(array_unique(array_merge([$model], self::FALLBACK_MODELS)));
            $payload['models'] = $fallbacks;
        }

        Log::info('[OpenRouterClient] Request', [
            'requested_model' => $requestedModel,
            'resolved_model' => $model,
            'messages_count' => count($messages),
        ]);
        
        if (!empty($extra)) {
            $payload = array_merge($payload, $extra);
        }
        
        try {
            $response = Http::withHeaders($this->buildHeaders())
                ->timeout($timeout)
                ->post(self::BASE_URL . '/chat/completions', $payload);
            
            if ($response->successful()) {
                return $response->json();
            } else {
                $errorBody = $response->json();
                $error = $errorBody['error']['message'] ?? $response->body();
                Log::error('[OpenRouterClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'body' => $errorBody,
                ]);
                return ['error' => $error];
            }
        } catch (\Exception $e) {
            Log::error('[OpenRouterClient] Exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return ['error' => $e->getMessage()];
        }
    }
    
    private function extractMessageContent(array $message): string
    {
        $content = $message['content'] ?? '';
        
        if (empty($content)) {
            $content = $message['reasoning'] ?? '';
        }
        
        if (empty($content) && isset($message['reasoning_details']) && is_array($message['reasoning_details'])) {
            $texts = array_map(function($detail) {
                return $detail['text'] ?? '';
            }, $message['reasoning_details']);
            $content = implode('', $texts);
        }
        
        return $content;
    }
    
    public function chat(
        string $prompt,
        ?string $model = null,
        ?string $systemPrompt = null,
        array $extra = [],
        int $timeout = 300
    ): string {
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
        
        $response = $this->chatCompletion($messages, $model, $extra, $timeout);
        
        if (isset($response['error'])) {
            return 'Error: ' . $response['error'];
        }
        
        $message = $response['choices'][0]['message'] ?? [];
        return $this->extractMessageContent($message);
    }
    
    public function getModels(): array
    {
        return self::MODELS;
    }
    
    public function listAvailableModels(): array
    {
        return array_keys(self::MODELS);
    }
    
    public function fetchAvailableModels(bool $freeOnly = false): array
    {
        try {
            $response = Http::withHeaders($this->buildHeaders())
                ->get(self::BASE_URL . '/models');
            
            if (!$response->successful()) {
                Log::error('[OpenRouterClient] Failed to fetch models', [
                    'status' => $response->status(),
                ]);
                return $this->getFallbackModels($freeOnly);
            }
            
            $data = $response->json();
            $models = $data['data'] ?? [];
            
            $result = [];
            foreach ($models as $model) {
                $modelId = $model['id'] ?? null;
                $modelName = $model['name'] ?? null;
                
                if (!$modelId || !$modelName) {
                    continue;
                }
                
                $isFree = self::isFreeModel($model);

                if ($freeOnly && !$isFree) {
                    continue;
                }
                
                $result[] = [
                    'id' => $modelId,
                    'name' => $modelName,
                    'free' => $isFree,
                    'context_length' => $model['context_length'] ?? 0,
                    'pricing' => $model['pricing'] ?? null,
                ];
            }
            
            return $result;
        } catch (\Exception $e) {
            Log::error('[OpenRouterClient] Exception fetching models: ' . $e->getMessage());
            return $this->getFallbackModels($freeOnly);
        }
    }
    
    /**
     * Live availability probe for the AI status endpoint.
     *
     * Calls GET /models and returns a small slice of model ids. Mirrors the
     * pycore ai_probe contract field-for-field (available / models / error /
     * latency_ms) so the Laravel and pycore status payloads stay aligned.
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
                $data = $response->json()['data'] ?? [];
                $ids = [];
                foreach ($data as $model) {
                    // Load ONLY free OpenRouter models: id ends with ":free" OR
                    // prompt+completion price is "0" (per OpenRouter's free
                    // models router / pricing=free filter).
                    if (empty($model['id']) || !self::isFreeModel($model)) {
                        continue;
                    }
                    $ids[] = $model['id'];
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

    /**
     * Whether an OpenRouter /models entry is a FREE model.
     *
     * Per OpenRouter's docs a model is free when its id carries the ":free"
     * variant suffix, or its pricing has zero prompt AND completion cost — the
     * same set surfaced by the site's pricing=free filter and consumed by the
     * openrouter/free router.
     */
    private static function isFreeModel(array $model): bool
    {
        $id = $model['id'] ?? '';
        if (is_string($id) && str_ends_with($id, ':free')) {
            return true;
        }
        $pricing = $model['pricing'] ?? [];
        $isZero = static function ($v): bool {
            return $v === '0' || $v === 0 || $v === '0.0' || $v === 0.0;
        };
        return $isZero($pricing['prompt'] ?? null) && $isZero($pricing['completion'] ?? null);
    }

    public function getFreeModels(): array
    {
        $cached = $this->getCachedFreeModels();
        if ($cached !== null) {
            return $cached;
        }
        
        $models = $this->fetchAvailableModels(true);
        
        $deepseekModels = array_filter($models, function($model) {
            return stripos($model['id'], 'deepseek') !== false && 
                   stripos($model['id'], 'free') !== false;
        });
        
        $result = array_values($deepseekModels);
        
        if (empty($result)) {
            $result = $this->getFallbackModels(true);
        }
        
        $this->cacheFreeModels($result);
        
        return $result;
    }
    
    private function getFallbackModels(bool $freeOnly = false): array
    {
        $fallback = [
            [
                'id' => 'tngtech/deepseek-r1t2-chimera:free',
                'name' => 'DeepSeek R1T2 Chimera (Free)',
                'free' => true,
                'context_length' => 8192,
            ],
        ];
        
        if (!$freeOnly) {
            $fallback = array_merge($fallback, [
                [
                    'id' => 'deepseek/deepseek-r1',
                    'name' => 'DeepSeek R1',
                    'free' => false,
                    'context_length' => 64000,
                ],
                [
                    'id' => 'openai/gpt-4o',
                    'name' => 'GPT-4o',
                    'free' => false,
                    'context_length' => 128000,
                ],
            ]);
        }
        
        return $fallback;
    }
    
    private function getCachedFreeModels(): ?array
    {
        $cacheFile = storage_path('app/cache/openrouter_free_models.json');
        
        if (!file_exists($cacheFile)) {
            return null;
        }
        
        $cacheData = json_decode(file_get_contents($cacheFile), true);
        
        if (!$cacheData || !isset($cacheData['timestamp']) || !isset($cacheData['models'])) {
            return null;
        }
        
        if (time() - $cacheData['timestamp'] > 3600) {
            return null;
        }
        
        return $cacheData['models'];
    }
    
    private function cacheFreeModels(array $models): void
    {
        $cacheDir = storage_path('app/cache');
        if (!is_dir($cacheDir)) {
            mkdir($cacheDir, 0755, true);
        }
        
        $cacheFile = $cacheDir . '/openrouter_free_models.json';
        
        $cacheData = [
            'timestamp' => time(),
            'models' => $models,
        ];
        
        file_put_contents($cacheFile, json_encode($cacheData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }
}
