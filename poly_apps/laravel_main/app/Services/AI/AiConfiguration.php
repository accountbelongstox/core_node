<?php

namespace App\Services\AI;

use App\Utils\SecretStore;
use Laravel\Ai\AiManager;

final class AiConfiguration
{
    private const string ANTHROPIC_URL = 'https://api.anthropic.com/v1';
    private const string GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta';
    private const string OPENAI_URL = 'https://api.openai.com/v1';
    private const string QWEN_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    private const string VOLCANO_URL = 'https://ark.cn-beijing.volces.com/api/v3';

    public static function get(): array
    {
        return [
            'default' => AiProvider::OpenRouterFree->value,
            'default_for_images' => AiProvider::Gemini->value,
            'default_for_audio' => AiProvider::Gemini->value,
            'default_for_transcription' => AiProvider::Gemini->value,
            'default_for_embeddings' => AiProvider::Gemini->value,
            'default_for_reranking' => AiProvider::Cohere->value,
            'caching' => [
                'embeddings' => [
                    'cache' => false,
                    'store' => 'database',
                ],
            ],
            'conversations' => [
                // Titles come from the first prompt excerpt — a dedicated AI
                // title call per new conversation would double token spend.
                'generate_title' => false,
            ],
            'providers' => self::providers(),
        ];
    }

    /**
     * Push the live SecretStore-backed provider definitions into the runtime
     * config and drop the SDK manager's memoized provider instances.
     *
     * config/ai.php is evaluated once per Octane worker boot, so keys written
     * through the UI afterwards would stay invisible until a restart. The AI
     * gateway surface calls this before every SDK dispatch, keeping
     * SecretStore the single live source of truth.
     */
    public static function refreshRuntime(): void
    {
        $providers = self::providers();

        config()->set('ai.providers', $providers);

        try {
            app(AiManager::class)->forgetInstance(array_keys($providers));
        } catch (\Throwable $e) {
            // Container not bound yet (early boot) — nothing is memoized.
        }
    }

    public static function providers(): array
    {
        $anthropicApiKey = '';
        $claudeCodeToken = '';
        $claudeCodeHeaders = [];

        $anthropicApiKey = SecretStore::getIndexed('ANTHROPIC_API_KEY');
        $claudeCodeToken = SecretStore::getIndexed('ANTHROPIC_AUTH_TOKEN');
        if ($claudeCodeToken !== '') {
            $claudeCodeHeaders['Authorization'] = 'Bearer ' . $claudeCodeToken;
        }

        return [
            AiProvider::Anthropic->value => [
                'driver' => 'anthropic',
                'key' => $anthropicApiKey,
                'url' => self::secretOr('ANTHROPIC_BASE_URL', self::ANTHROPIC_URL),
                'models' => [
                    'text' => [
                        'default' => self::secretOr('ANTHROPIC_MODEL', 'claude-sonnet-5'),
                    ],
                ],
                'capabilities' => self::capabilities(AiCapability::Text, AiCapability::Files),
            ],
            AiProvider::ClaudeCode->value => [
                'driver' => 'anthropic',
                'key' => $claudeCodeToken === '' ? $anthropicApiKey : '',
                'url' => self::secretOr('ANTHROPIC_BASE_URL', self::ANTHROPIC_URL),
                'headers' => $claudeCodeHeaders,
                'models' => [
                    'text' => [
                        'default' => self::secretOr('ANTHROPIC_MODEL', 'claude-sonnet-5'),
                    ],
                ],
                'capabilities' => self::capabilities(AiCapability::Text, AiCapability::Files),
            ],
            AiProvider::Cohere->value => [
                'driver' => 'cohere',
                'key' => SecretStore::getIndexed('COHERE_API_KEY'),
                'capabilities' => self::capabilities(
                    AiCapability::Embeddings,
                    AiCapability::Reranking,
                ),
            ],
            AiProvider::DeepSeek->value => [
                'driver' => 'deepseek',
                'key' => SecretStore::getIndexed('DEEPSEEK_API_KEY'),
                'models' => [
                    'text' => [
                        'default' => self::secretOr('DEEPSEEK_MODEL', 'deepseek-v4-flash'),
                    ],
                ],
                'capabilities' => self::capabilities(AiCapability::Text),
            ],
            AiProvider::Gemini->value => [
                'driver' => 'gemini',
                'key' => SecretStore::getIndexed('GOOGLE_API_KEY'),
                'url' => self::secretOr('GEMINI_BASE_URL', self::GEMINI_URL),
                'models' => [
                    'text' => ['default' => self::secretOr('GEMINI_TEXT_MODEL', 'gemini-3.6-flash')],
                    'image' => ['default' => self::secretOr('GEMINI_IMAGE_MODEL', 'gemini-3.1-flash-image-preview')],
                    'audio' => ['default' => self::secretOr('GEMINI_AUDIO_MODEL', 'gemini-2.5-flash-preview-tts')],
                    'transcription' => ['default' => self::secretOr('GEMINI_TRANSCRIPTION_MODEL', 'gemini-3.5-flash')],
                    'embeddings' => [
                        'default' => self::secretOr('GEMINI_EMBEDDINGS_MODEL', 'gemini-embedding-2'),
                        'dimensions' => 3072,
                    ],
                ],
                'capabilities' => self::capabilities(
                    AiCapability::Text,
                    AiCapability::Images,
                    AiCapability::Audio,
                    AiCapability::Transcription,
                    AiCapability::Embeddings,
                    AiCapability::Files,
                ),
            ],
            AiProvider::OpenAI->value => [
                'driver' => 'openai',
                'key' => SecretStore::getIndexed('OPENAI_API_KEY'),
                'url' => self::secretOr('OPENAI_BASE_URL', self::OPENAI_URL),
                'store' => false,
                'capabilities' => self::capabilities(
                    AiCapability::Text,
                    AiCapability::Images,
                    AiCapability::Audio,
                    AiCapability::Transcription,
                    AiCapability::Embeddings,
                    AiCapability::Files,
                ),
            ],
            AiProvider::OpenRouter->value => self::openRouterProvider(),
            AiProvider::OpenRouterFree->value => self::openRouterProvider([
                'text' => ['default' => 'openrouter/free'],
                'image' => ['default' => 'google/gemini-3.1-flash-image-preview'],
            ]),
            AiProvider::Volcano->value => [
                'driver' => 'openai-compatible',
                'key' => SecretStore::getIndexed('ARK_API_KEY'),
                'url' => self::secretOr('ARK_BASE_URL', self::VOLCANO_URL),
                'models' => [
                    'text' => [
                        'default' => self::secretOr('ARKCLI_MODEL', 'doubao-seed-1-6-flash-250615'),
                    ],
                ],
                'capabilities' => self::capabilities(AiCapability::Text),
            ],
            AiProvider::Qwen->value => [
                'driver' => 'openai-compatible',
                'key' => SecretStore::getIndexed('DASHSCOPE_API_KEY'),
                'url' => self::secretOr('DASHSCOPE_BASE_URL', self::QWEN_URL),
                'models' => [
                    'text' => [
                        'default' => self::secretOr('DASHSCOPE_MODEL', 'qwen3-max'),
                    ],
                ],
                'capabilities' => self::capabilities(AiCapability::Text),
            ],
        ];
    }

    private static function openRouterProvider(array $models = []): array
    {
        return [
            'driver' => 'openrouter',
            'key' => SecretStore::getIndexed('OPENROUTER_API_KEY'),
            'url' => self::secretOr('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
            'models' => $models,
            'capabilities' => self::capabilities(
                AiCapability::Text,
                AiCapability::Images,
                AiCapability::Audio,
                AiCapability::Transcription,
                AiCapability::Embeddings,
            ),
        ];
    }

    private static function secretOr(string $keyName, string $default): string
    {
        $value = '';

        $value = SecretStore::getIndexed($keyName);

        return $value === '' ? $default : $value;
    }

    private static function capabilities(AiCapability ...$capabilities): array
    {
        return array_map(
            static fn (AiCapability $capability): string => $capability->value,
            $capabilities,
        );
    }
}
