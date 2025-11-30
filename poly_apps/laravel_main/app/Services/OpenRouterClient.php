<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Helpers\GlobalSecretReader;

class OpenRouterClient
{
    const BASE_URL = 'https://openrouter.ai/api/v1';
    
    const MODELS = [
        'deepseek-r1t2-chimera' => 'tngtech/deepseek-r1t2-chimera:free',
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
        'free' => 'tngtech/deepseek-r1t2-chimera:free',
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
                
                $isFree = isset($model['pricing']['prompt']) && 
                          $model['pricing']['prompt'] === '0';
                
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
