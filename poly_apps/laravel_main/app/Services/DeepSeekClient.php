<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Helpers\GlobalSecretReader;

class DeepSeekClient
{
    const BASE_URL = 'https://api.deepseek.com';
    
    const MODELS = [
        'deepseek-chat' => 'deepseek-chat',
        'deepseek-reasoner' => 'deepseek-reasoner',
    ];
    
    private $apiKey;
    
    public function __construct(?string $apiKey = null)
    {
        if ($apiKey === null) {
            $apiKey = GlobalSecretReader::getSecretContent('OPENROUTER_API_KEY_2');
            if (!$apiKey) {
                $apiKey = GlobalSecretReader::getSecretContent('DEEPSEEK_API_KEY');
            }
            if (!$apiKey) {
                $apiKey = env('OPENROUTER_API_KEY_2') ?? env('DEEPSEEK_API_KEY');
            }
        }
        
        if (!$apiKey) {
            Log::warning('[DeepSeekClient] No API key provided. Set OPENROUTER_API_KEY_2 or DEEPSEEK_API_KEY in .secret_keys/.secret_ignore/');
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
            $model = self::MODELS['deepseek-chat'];
        } elseif (isset(self::MODELS[$model])) {
            $model = self::MODELS[$model];
        }
        
        $payload = [
            'model' => $model,
            'messages' => $messages,
            'stream' => false,
        ];
        
        Log::info('[DeepSeekClient] Request', [
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
                Log::error('[DeepSeekClient] Request failed', [
                    'status' => $response->status(),
                    'error' => $error,
                    'body' => $errorBody,
                ]);
                return ['error' => $error];
            }
        } catch (\Exception $e) {
            Log::error('[DeepSeekClient] Exception: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return ['error' => $e->getMessage()];
        }
    }
    
    private function extractMessageContent(array $message): string
    {
        $content = $message['content'] ?? '';
        
        if (empty($content)) {
            $content = $message['reasoning_content'] ?? '';
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
        return [
            [
                'id' => 'deepseek-chat',
                'name' => 'DeepSeek Chat (V3.2-Exp)',
                'provider' => 'deepseek',
                'context_length' => 64000,
            ],
            [
                'id' => 'deepseek-reasoner',
                'name' => 'DeepSeek Reasoner (V3.2-Exp Thinking)',
                'provider' => 'deepseek',
                'context_length' => 64000,
            ],
        ];
    }
}
