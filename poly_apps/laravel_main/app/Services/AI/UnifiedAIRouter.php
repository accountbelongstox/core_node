<?php

namespace App\Services\AI;

use App\Services\GeminiClient;
use Illuminate\Support\Facades\Log;

/**
 * Unified AI Router
 *
 * Intelligently routes AI requests to the appropriate provider based on:
 * - Task type (text, image generation, image analysis, document analysis)
 * - Provider availability
 * - Rate limits
 *
 * Priority:
 * - Text: OpenRouter > DeepSeek
 * - Image/Vision: Gemini only
 * - Fallback: DeepSeek when others are rate limited
 */
class UnifiedAIRouter
{
    private OpenRouterClient $openRouter;
    private DeepSeekClient $deepSeek;
    private GeminiClient $gemini;

    public function __construct()
    {
        $this->openRouter = new OpenRouterClient();
        $this->deepSeek = new DeepSeekClient();
        $this->gemini = new GeminiClient();
    }

    /**
     * Main entry point for all AI requests
     */
    public function request(string $taskType, array $params): array
    {
        $keyword = $params['keyword'] ?? null;

        Log::info('[UnifiedAIRouter] Request received', [
            'task_type' => $taskType,
            'keyword' => $keyword,
        ]);

        switch ($taskType) {
            case 'text':
            case 'chat':
                return $this->routeTextRequest($params, $keyword);

            case 'image_generate':
            case 'image_gen':
                return $this->routeImageGeneration($params, $keyword);

            case 'image_analyze':
            case 'vision':
                return $this->routeImageAnalysis($params, $keyword);

            case 'document_analyze':
            case 'multimodal':
                return $this->routeDocumentAnalysis($params, $keyword);

            default:
                return [
                    'success' => false,
                    'error' => 'Unknown task type: ' . $taskType,
                ];
        }
    }

    /**
     * Route text generation requests
     * Priority: OpenRouter > DeepSeek
     */
    private function routeTextRequest(array $params, ?string $keyword): array
    {
        $prompt = $params['prompt'] ?? '';
        $model = $params['model'] ?? null;
        $systemPrompt = $params['system_prompt'] ?? null;
        $options = $params['options'] ?? [];

        if ($this->openRouter->hasApiKey()) {
            Log::info('[UnifiedAIRouter] Trying OpenRouter for text');

            $result = $this->openRouter->chat($prompt, $model, $systemPrompt, $options, $keyword);

            if ($result['success']) {
                return $this->formatResponse('openrouter', $result);
            }

            if (!($result['rate_limited'] ?? false)) {
                return $this->formatResponse('openrouter', $result);
            }

            Log::warning('[UnifiedAIRouter] OpenRouter rate limited, falling back to DeepSeek');
        } else {
            Log::info('[UnifiedAIRouter] OpenRouter not configured, skipping');
        }

        if ($this->deepSeek->hasApiKey()) {
            Log::info('[UnifiedAIRouter] Trying DeepSeek for text');

            $result = $this->deepSeek->chat($prompt, $model, $systemPrompt, $options, $keyword);

            return $this->formatResponse('deepseek', $result);
        }

        return [
            'success' => false,
            'error' => 'No text provider available',
            'details' => 'Both OpenRouter and DeepSeek are unavailable',
        ];
    }

    /**
     * Route image generation requests
     * Only provider: Gemini
     */
    private function routeImageGeneration(array $params, ?string $keyword): array
    {
        if (!$this->gemini->hasApiKey()) {
            return [
                'success' => false,
                'error' => 'Gemini not configured',
                'details' => 'Image generation requires Gemini API key',
            ];
        }

        Log::info('[UnifiedAIRouter] Using Gemini for image generation');

        $prompt = $params['prompt'] ?? '';
        $options = $params['options'] ?? [];

        if (isset($params['reference_image'])) {
            $result = $this->gemini->generateImageWithReference(
                $prompt,
                $params['reference_image'],
                $options
            );
        } else {
            $result = $this->gemini->generateImageFromPrompt($prompt, $options);
        }

        return $this->formatResponse('gemini', $result);
    }

    /**
     * Route image analysis requests
     * Only provider: Gemini
     */
    private function routeImageAnalysis(array $params, ?string $keyword): array
    {
        if (!$this->gemini->hasApiKey()) {
            return [
                'success' => false,
                'error' => 'Gemini not configured',
                'details' => 'Image analysis requires Gemini API key',
            ];
        }

        Log::info('[UnifiedAIRouter] Using Gemini for image analysis');

        $imagePath = $params['image_path'] ?? '';
        $prompt = $params['prompt'] ?? 'Describe this image';
        $model = $params['model'] ?? null;
        $timeout = $params['timeout'] ?? 120;

        $result = $this->gemini->analyzeImage($imagePath, $prompt, $model, $timeout);

        return $this->formatResponse('gemini', $result);
    }

    /**
     * Route document/multimodal analysis requests
     * Only provider: Gemini
     */
    private function routeDocumentAnalysis(array $params, ?string $keyword): array
    {
        if (!$this->gemini->hasApiKey()) {
            return [
                'success' => false,
                'error' => 'Gemini not configured',
                'details' => 'Document analysis requires Gemini API key',
            ];
        }

        Log::info('[UnifiedAIRouter] Using Gemini for document analysis');

        $history = $params['history'] ?? [];
        $prompt = $params['prompt'] ?? '';
        $options = $params['options'] ?? [];

        $result = $this->gemini->generateMultimodalContent($history, $prompt, $options);

        return $this->formatResponse('gemini', $result);
    }

    /**
     * Format response with provider metadata
     */
    private function formatResponse(string $provider, array $result): array
    {
        return array_merge($result, [
            'provider' => $provider,
            'routed_by' => 'UnifiedAIRouter',
            'timestamp' => now()->toDateTimeString(),
        ]);
    }

    /**
     * Get all providers status
     */
    public function getProvidersStatus(): array
    {
        return [
            'openrouter' => [
                'available' => $this->openRouter->hasApiKey(),
                'type' => 'text',
                'priority' => 1,
                'usage' => $this->openRouter->getUsageStats(),
            ],
            'deepseek' => [
                'available' => $this->deepSeek->hasApiKey(),
                'type' => 'text',
                'priority' => 2,
                'usage' => $this->deepSeek->getUsageStats(),
            ],
            'gemini' => [
                'available' => $this->gemini->hasApiKey(),
                'type' => 'multimodal',
                'priority' => 1,
                'capabilities' => ['text', 'image_gen', 'image_analyze', 'document'],
            ],
        ];
    }

    /**
     * Get recommended provider for task type
     */
    public function getRecommendedProvider(string $taskType): array
    {
        $routes = [
            'text' => ['openrouter', 'deepseek'],
            'chat' => ['openrouter', 'deepseek'],
            'image_generate' => ['gemini'],
            'image_gen' => ['gemini'],
            'image_analyze' => ['gemini'],
            'vision' => ['gemini'],
            'document_analyze' => ['gemini'],
            'multimodal' => ['gemini'],
        ];

        $providers = $routes[$taskType] ?? [];

        $available = [];
        foreach ($providers as $provider) {
            $status = $this->getProvidersStatus()[$provider] ?? null;
            if ($status && $status['available']) {
                $available[] = $provider;
            }
        }

        return [
            'task_type' => $taskType,
            'all_providers' => $providers,
            'available_providers' => $available,
            'recommended' => $available[0] ?? null,
        ];
    }

    /**
     * Simple text helper
     */
    public function chat(string $prompt, ?string $systemPrompt = null, ?string $keyword = null): array
    {
        return $this->request('text', [
            'prompt' => $prompt,
            'system_prompt' => $systemPrompt,
            'keyword' => $keyword,
        ]);
    }

    /**
     * Simple image generation helper
     */
    public function generateImage(string $prompt, array $options = []): array
    {
        return $this->request('image_generate', [
            'prompt' => $prompt,
            'options' => $options,
        ]);
    }

    /**
     * Simple image analysis helper
     */
    public function analyzeImage(string $imagePath, string $prompt = 'Describe this image'): array
    {
        return $this->request('image_analyze', [
            'image_path' => $imagePath,
            'prompt' => $prompt,
        ]);
    }
}
