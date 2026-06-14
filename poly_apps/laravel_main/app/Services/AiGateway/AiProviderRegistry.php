<?php

namespace App\Services\AiGateway;

/**
 * Shared AI provider registry — the PHP port of pycore's pyctl.ai.ai_keys.
 *
 * Single source of truth for provider identity in laravel_main. AiProbe /
 * AiChat / AiGateway and the AI Management UI all read THIS class only.
 *
 * Per provider:
 *   key_base      : secret base name (indexed _1.._5 then bare, via AiSecretLoader)
 *   default_model : fallback when caller passes no model
 *   free_models   : known free-tier model ids (catalog + probe/chat fallback)
 *   limits        : human-readable free-tier limits (from provider docs)
 *   tier          : free | balance | paid (gateway dispatch order)
 *   client        : compat | gemini | anthropic | cloudflare | spark
 *   base_url      : OpenAI-compatible (or native) API base
 *   models_url    : optional explicit list-models URL (when not base_url/models)
 *   extra_secret  : optional secondary secret (e.g. CLOUDFLARE_ACCOUNT_ID)
 *   vision/image/image_model : capability flags
 *
 * Keys live in <core_node>/.secret_keys/.secret_ignore/<KEY> — the exact same
 * files pycore reads — so a key configured once works in both runtimes.
 */
class AiProviderRegistry
{
    /** Free OpenRouter models (subset; full list at openrouter.ai/models?q=free). */
    private const OPENROUTER_FREE = [
        'meta-llama/llama-3.3-70b-instruct:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'google/gemma-3-27b-it:free',
        'qwen/qwen3-coder:free',
        'deepseek/deepseek-r1t2-chimera:free',
    ];

    /** Dispatch order: free -> balance -> paid; within tier = list order. */
    public const PROVIDER_ORDER = [
        'openrouter', 'gemini', 'groq', 'cerebras', 'mistral', 'cohere',
        'nvidia', 'huggingface', 'github', 'cloudflare',
        'siliconflow', 'dashscope', 'hunyuan', 'qianfan', 'spark', 'zhipuai',
        'deepseek',
        'volcano', 'moonshot', 'minimax', 'stepfun', 'yi',
        'openai', 'anthropic', 'xai',
        'together',
    ];

    /** Memoized registry map (built once per worker). */
    private static ?array $cache = null;

    /**
     * Full provider registry. Returns the canonical map keyed by provider name.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function providers(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        self::$cache = [
            'openrouter' => [
                'key_base' => 'OPENROUTER_API_KEY',
                'default_model' => 'meta-llama/llama-3.3-70b-instruct:free',
                'free_models' => self::OPENROUTER_FREE,
                'limits' => '20 req/min; 50 req/day (<$10 lifetime topup) or 1000/day; shared :free quota',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://openrouter.ai/api/v1',
                // OpenRouter's optional attribution headers (used for its model
                // ranking; demonstrates the registry extra_headers hook).
                'extra_headers' => ['X-Title' => 'core_node'],
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'gemini' => [
                'key_base' => 'GOOGLE_API_KEY',
                'default_model' => 'gemini-2.5-flash',
                'free_models' => ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemma-3-27b-it', 'gemma-3-12b-it'],
                'limits' => 'Free tier: per-model RPM/RPD (e.g. Flash 5 RPM / 20 RPD); no quota API',
                'tier' => 'free',
                'client' => 'gemini',
                'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
                'vision' => true,
                'image' => true,
                'image_model' => 'gemini-2.5-flash-image',
            ],
            'groq' => [
                'key_base' => 'GROQ_API_KEY',
                'default_model' => 'llama-3.3-70b-versatile',
                'free_models' => ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3-32b'],
                'limits' => 'Per-model free limits (e.g. Llama 3.3 70B: 1000 RPD / 12k TPM)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://api.groq.com/openai/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'cerebras' => [
                'key_base' => 'CEREBRAS_API_KEY',
                'default_model' => 'llama-3.3-70b',
                'free_models' => ['llama-3.3-70b', 'llama3.1-8b', 'gpt-oss-120b'],
                'limits' => 'gpt-oss-120b: 30 RPM / 1M TPD; Llama 3.1 8B: 30 RPM / 1M TPD',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://api.cerebras.ai/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'mistral' => [
                'key_base' => 'MISTRAL_API_KEY',
                'default_model' => 'mistral-small-latest',
                'free_models' => ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'],
                'limits' => 'Experiment plan: 1 req/s, 500k TPM, 1B TPM/month (data training opt-in)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://api.mistral.ai/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'cohere' => [
                'key_base' => 'COHERE_API_KEY',
                'default_model' => 'command-r-plus-08-2024',
                'free_models' => ['command-r-plus-08-2024', 'command-r-08-2024', 'command-r7b-12-2024', 'c4ai-aya-expanse-32b'],
                'limits' => '20 req/min; 1000 req/month (shared monthly quota)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://api.cohere.ai/compatibility/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'nvidia' => [
                'key_base' => 'NVIDIA_API_KEY',
                'default_model' => 'meta/llama-3.1-8b-instruct',
                'free_models' => ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct', 'nvidia/nemotron-4-340b-instruct'],
                'limits' => '40 req/min; phone verification required on build.nvidia.com',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://integrate.api.nvidia.com/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'huggingface' => [
                'key_base' => 'HF_TOKEN',
                'default_model' => 'meta-llama/Llama-3.1-8B-Instruct',
                'free_models' => ['meta-llama/Llama-3.1-8B-Instruct', 'meta-llama/Llama-3.1-70B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'],
                'limits' => '$0.10/month serverless credits (models <10GB)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://router.huggingface.co/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'github' => [
                'key_base' => 'GITHUB_MODELS_TOKEN',
                'default_model' => 'openai/gpt-4.1',
                'free_models' => ['openai/gpt-4.1', 'openai/gpt-4o-mini', 'meta-llama/Llama-3.3-70B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct'],
                'limits' => 'Low tier (Copilot Free): 15 RPM / 150 RPD; High tier: 10 RPM / 50 RPD',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://models.github.ai/inference',
                'models_url' => 'https://models.github.ai/catalog/models',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'cloudflare' => [
                'key_base' => 'CLOUDFLARE_API_TOKEN',
                'extra_secret' => 'CLOUDFLARE_ACCOUNT_ID',
                'default_model' => '@cf/meta/llama-3-8b-instruct',
                'free_models' => ['@cf/meta/llama-3-8b-instruct', '@cf/meta/llama-3.1-8b-instruct'],
                'limits' => 'Workers AI free daily neurons allocation (varies by plan)',
                'tier' => 'free',
                'client' => 'cloudflare',
                'base_url' => 'https://api.cloudflare.com/client/v4',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'siliconflow' => [
                'key_base' => 'SILICONFLOW_API_KEY',
                'default_model' => 'Qwen/Qwen2.5-7B-Instruct',
                'free_models' => ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V2.5'],
                'limits' => 'Selected models free (e.g. Qwen2.5-7B); paid models per token',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://api.siliconflow.cn/v1',
                'base_url_key' => 'SILICONFLOW_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'dashscope' => [
                'key_base' => 'DASHSCOPE_API_KEY',
                'default_model' => 'qwen-turbo',
                'free_models' => ['qwen-turbo', 'qwen-plus', 'qwen-max'],
                'limits' => 'Free quota for qwen-turbo (RPM/RPD per Bailian console)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                'base_url_key' => 'DASHSCOPE_BASE_URL',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'hunyuan' => [
                'key_base' => 'HUNYUAN_API_KEY',
                'default_model' => 'hunyuan-lite',
                'free_models' => ['hunyuan-lite', 'hunyuan-standard'],
                'limits' => 'hunyuan-lite free tier RPM limits (Tencent console)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://api.hunyuan.cloud.tencent.com/v1',
                'base_url_key' => 'HUNYUAN_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'qianfan' => [
                'key_base' => 'QIANFAN_API_KEY',
                'default_model' => 'ernie-speed-128k',
                'free_models' => ['ernie-speed-128k', 'ernie-lite-8k', 'ernie-3.5-8k'],
                'limits' => 'ERNIE speed/lite tiers free RPM (Baidu console)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://qianfan.baidubce.com/v2',
                'base_url_key' => 'QIANFAN_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'spark' => [
                'key_base' => 'SPARK_API_PASSWORD',
                'default_model' => 'lite',
                'free_models' => ['lite'],
                'limits' => 'Spark Lite free tier (iFlytek console RPM)',
                'tier' => 'free',
                'client' => 'spark',
                'base_url' => 'https://spark-api-open.xf-yun.com/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'zhipuai' => [
                'key_base' => 'ZHIPUAI_API_KEY',
                'default_model' => 'glm-4-flash',
                'free_models' => ['glm-4-flash', 'glm-4', 'glm-4v-flash'],
                'limits' => 'Free tier RPM limits; no public quota API (cooldown on 429)',
                'tier' => 'free',
                'client' => 'compat',
                'base_url' => 'https://open.bigmodel.cn/api/paas/v4',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'deepseek' => [
                'key_base' => 'DEEPSEEK_API_KEY',
                'default_model' => 'deepseek-chat',
                'free_models' => ['deepseek-chat', 'deepseek-reasoner'],
                'limits' => 'No free API tier — prepaid balance only; trial credits may apply for new accounts',
                'tier' => 'balance',
                'client' => 'compat',
                'base_url' => 'https://api.deepseek.com',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'volcano' => [
                'key_base' => 'ARK_API_KEY',
                'default_model' => 'doubao-1-5-pro-32k',
                'free_models' => ['doubao-1-5-lite-32k', 'doubao-1-5-pro-32k'],
                'limits' => 'Volcano Ark prepaid; some lite models have free trial quota',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://ark.cn-beijing.volces.com/api/v3',
                'base_url_key' => 'ARK_BASE_URL',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'moonshot' => [
                'key_base' => 'MOONSHOT_API_KEY',
                'default_model' => 'moonshot-v1-8k',
                'free_models' => ['moonshot-v1-8k', 'moonshot-v1-32k'],
                'limits' => 'Prepaid balance; trial credits for new accounts',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.moonshot.cn/v1',
                'base_url_key' => 'MOONSHOT_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'minimax' => [
                'key_base' => 'MINIMAX_API_KEY',
                'default_model' => 'abab6.5s-chat',
                'free_models' => ['abab6.5s-chat'],
                'limits' => 'Prepaid / package billing (MiniMax console)',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.minimax.chat/v1',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'stepfun' => [
                'key_base' => 'STEPFUN_API_KEY',
                'default_model' => 'step-1-8k',
                'free_models' => ['step-1-8k', 'step-2-mini'],
                'limits' => 'Prepaid balance (StepFun console)',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.stepfun.com/v1',
                'base_url_key' => 'STEPFUN_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'yi' => [
                'key_base' => 'YI_API_KEY',
                'default_model' => 'yi-light',
                'free_models' => ['yi-light', 'yi-medium'],
                'limits' => 'Prepaid balance (01.AI console)',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.lingyiwanwu.com/v1',
                'base_url_key' => 'YI_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
            'openai' => [
                'key_base' => 'OPENAI_API_KEY',
                'default_model' => 'gpt-4o-mini',
                'free_models' => ['gpt-4o-mini', 'gpt-4o'],
                'limits' => 'Paid API; no free tier quota API (cooldown on 429)',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.openai.com/v1',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'anthropic' => [
                'key_base' => 'ANTHROPIC_API_KEY',
                'default_model' => 'claude-3-5-haiku-latest',
                'free_models' => ['claude-3-5-haiku-latest', 'claude-3-5-sonnet-latest'],
                'limits' => 'Paid API; no balance endpoint (cooldown on 429)',
                'tier' => 'paid',
                'client' => 'anthropic',
                'base_url' => 'https://api.anthropic.com/v1',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'xai' => [
                'key_base' => 'XAI_API_KEY',
                'default_model' => 'grok-2-latest',
                'free_models' => ['grok-2-latest', 'grok-beta'],
                'limits' => 'Prepaid credits ($25 free promo may apply for new accounts)',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.x.ai/v1',
                'base_url_key' => 'XAI_BASE_URL',
                'vision' => true,
                'image' => false,
                'image_model' => '',
            ],
            'together' => [
                'key_base' => 'TOGETHER_API_KEY',
                'default_model' => 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
                'free_models' => ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mistral-Small-24B-Instruct-2501'],
                'limits' => 'No free trial — $5 minimum prepaid (docs.together.ai/credits)',
                'tier' => 'paid',
                'client' => 'compat',
                'base_url' => 'https://api.together.xyz/v1',
                'base_url_key' => 'TOGETHER_BASE_URL',
                'vision' => false,
                'image' => false,
                'image_model' => '',
            ],
        ];

        return self::$cache;
    }

    /** Metadata for one provider (empty array when unknown). */
    public static function meta(string $provider): array
    {
        return self::providers()[$provider] ?? [];
    }

    /** True when the provider name exists in the registry. */
    public static function exists(string $provider): bool
    {
        return isset(self::providers()[$provider]);
    }

    /**
     * Canonical dispatch/display order for EVERY registered provider.
     *
     * This is the single ordering used by probe / gateway / catalog. It honors
     * the explicit PROVIDER_ORDER but is derived from the registry, so adding a
     * provider to providers() ALONE is enough — a provider missing from (or new
     * to) PROVIDER_ORDER still appears, slotted into its tier group (free →
     * balance → paid) instead of silently vanishing. Stale names in
     * PROVIDER_ORDER that no longer exist are dropped.
     *
     * @return string[]
     */
    public static function orderedNames(): array
    {
        $pos = array_flip(self::PROVIDER_ORDER);
        $tierRank = ['free' => 0, 'balance' => 1, 'paid' => 2];
        $names = array_keys(self::providers());
        // Stable sort (PHP 8 usort is stable): by tier, then explicit position,
        // then registry insertion order for providers not listed explicitly.
        usort($names, static function (string $a, string $b) use ($pos, $tierRank) {
            $ta = $tierRank[self::tier($a)] ?? 3;
            $tb = $tierRank[self::tier($b)] ?? 3;
            if ($ta !== $tb) {
                return $ta <=> $tb;
            }
            return ($pos[$a] ?? PHP_INT_MAX) <=> ($pos[$b] ?? PHP_INT_MAX);
        });
        return $names;
    }

    /**
     * First non-empty secret for the provider (indexed _1.._5 then bare).
     */
    public static function firstSecret(string $provider): string
    {
        $base = self::meta($provider)['key_base'] ?? '';
        return $base ? AiSecretLoader::getIndexed($base) : '';
    }

    /** Secondary secret (e.g. CLOUDFLARE_ACCOUNT_ID). */
    public static function extraSecret(string $provider): string
    {
        $name = self::meta($provider)['extra_secret'] ?? '';
        return $name ? AiSecretLoader::getIndexed($name) : '';
    }

    /**
     * Optional per-provider extra HTTP headers for the OpenAI-compatible client
     * (e.g. OpenRouter's X-Title, a provider's API-version header). Defining
     * `extra_headers` in the registry entry is all that's needed — no code edit.
     *
     * @return array<string, string>
     */
    public static function extraHeaders(string $provider): array
    {
        $headers = self::meta($provider)['extra_headers'] ?? [];
        return is_array($headers) ? $headers : [];
    }

    /**
     * Resolved API base URL. Honors an optional override secret (base_url_key),
     * else the registry default; trailing slash stripped.
     */
    public static function baseUrl(string $provider): string
    {
        $meta = self::meta($provider);
        $urlKey = $meta['base_url_key'] ?? '';
        if ($urlKey) {
            $override = AiSecretLoader::getIndexed($urlKey);
            if ($override !== '') {
                return rtrim(trim($override), '/');
            }
        }
        return rtrim(trim((string) ($meta['base_url'] ?? '')), '/');
    }

    /** True when the provider's required secrets are present. */
    public static function isConfigured(string $provider): bool
    {
        if (self::firstSecret($provider) === '') {
            return false;
        }
        if ($provider === 'cloudflare' && self::extraSecret('cloudflare') === '') {
            return false;
        }
        return true;
    }

    public static function defaultModel(string $provider): string
    {
        return (string) (self::meta($provider)['default_model'] ?? '');
    }

    public static function imageModel(string $provider): string
    {
        return (string) (self::meta($provider)['image_model'] ?? '');
    }

    public static function tier(string $provider): string
    {
        return (string) (self::meta($provider)['tier'] ?? 'paid');
    }

    public static function client(string $provider): string
    {
        return (string) (self::meta($provider)['client'] ?? 'compat');
    }

    public static function limitsNote(string $provider): string
    {
        return (string) (self::meta($provider)['limits'] ?? '');
    }

    /** @return string[] */
    public static function freeModels(string $provider): array
    {
        return array_values((array) (self::meta($provider)['free_models'] ?? []));
    }

    /** Registry model catalog (free-tier ids) for probe/chat fallback. */
    public static function catalogModels(string $provider, int $maxCount = 5): array
    {
        return array_slice(self::freeModels($provider), 0, $maxCount);
    }

    /**
     * Mask a secret for display: first 4 + "…" + last 4 only. null when absent.
     */
    public static function maskKey(?string $key): ?string
    {
        if (!$key) {
            return null;
        }
        $key = trim($key);
        if (strlen($key) <= 8) {
            return '…';
        }
        return substr($key, 0, 4) . '…' . substr($key, -4);
    }
}
