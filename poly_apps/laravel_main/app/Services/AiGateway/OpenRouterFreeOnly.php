<?php

namespace App\Services\AiGateway;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\ConnectionException;

/**
 * OpenRouter is used with free models only (the shared 1000/day free budget
 * in ai_rate_usage.json). The one definition of "free" (OpenRouter docs): the
 * id ends in ":free", OR prompt and completion pricing are zero, OR the
 * "openrouter/free" router. Mirrors pycore's ai_request_failures codes:
 * AI_PAID_MODEL_REFUSED {provider, model} and AI_FREE_IMAGE_MODEL_UNAVAILABLE {provider}.
 */
final class OpenRouterFreeOnly
{
    public const PROVIDER = 'openrouter';
    public const PAID_MODEL_REFUSED = 'AI_PAID_MODEL_REFUSED';
    public const FREE_IMAGE_MODEL_UNAVAILABLE = 'AI_FREE_IMAGE_MODEL_UNAVAILABLE';
    public const FREE_ROUTER = 'openrouter/free';
    private const FREE_SUFFIX = ':free';
    private const IMAGE_MODALITY = 'image';
    private const CATALOG_CACHE_PREFIX = 'openrouter_free_catalog:';
    private const CATALOG_CACHE_SECONDS = 3600;
    private const CATALOG_TIMEOUT_SECONDS = 20;
    private const ZERO_PRICES = ['0', '0.0', 0, 0.0];
    /** Length cap of the in-request `models` fallback list. */
    private const FALLBACK_MODELS_MAX = 3;

    /** Free by id alone (used when no catalog pricing is at hand). */
    public static function isFree(string $model): bool
    {
        return $model === self::FREE_ROUTER || str_ends_with($model, self::FREE_SUFFIX) || isset(self::pricedFree()[$model]);
    }

    /** Free by a /models catalog entry (id suffix or zero prompt + completion price). */
    public static function isFreeModel(array $model): bool
    {
        $id = (string) ($model['id'] ?? '');
        $pricing = (array) ($model['pricing'] ?? []);

        return $id === self::FREE_ROUTER
            || str_ends_with($id, self::FREE_SUFFIX)
            || (in_array($pricing['prompt'] ?? null, self::ZERO_PRICES, true)
                && in_array($pricing['completion'] ?? null, self::ZERO_PRICES, true));
    }

    /**
     * Free catalog entries {id, name, free, context_length, pricing}, cached an
     * hour per output modality (null = text). Only a successful, non-empty
     * fetch is cached; otherwise the text catalog falls back to the registry
     * free ids (as the former OpenRouterClient::getFallbackModels did) and the
     * image catalog is empty, and the next call fetches again.
     */
    public static function freeCatalog(?string $outputModality = null): array
    {
        $cacheKey = self::CATALOG_CACHE_PREFIX.($outputModality ?? 'text');
        $cached = Cache::get($cacheKey);
        $fetched = null;

        if (is_array($cached) && $cached !== []) {
            return $cached;
        }
        $fetched = self::fetchFreeCatalog($outputModality);
        if ($fetched !== null && $fetched !== []) {
            Cache::put($cacheKey, $fetched, self::CATALOG_CACHE_SECONDS);

            return $fetched;
        }

        return $outputModality === null ? self::registryCatalog() : [];
    }

    /** Registry free ids as catalog entries (the offline fallback). */
    private static function registryCatalog(): array
    {
        return array_map(static fn (string $id): array => [
            'id' => $id,
            'name' => $id,
            'free' => true,
            'context_length' => 0,
            'pricing' => null,
        ], array_values(array_filter(AiProviderRegistry::freeModels(self::PROVIDER), [self::class, 'isFree'])));
    }

    /** First free image-output model, or null when OpenRouter offers none. */
    public static function freeImageModel(): ?string
    {
        $catalog = self::freeCatalog(self::IMAGE_MODALITY);

        return isset($catalog[0]['id']) ? (string) $catalog[0]['id'] : null;
    }

    /** In-request `models` fallback list: the primary first, then the registry free ids. */
    public static function fallbackModels(string $primary): array
    {
        return array_slice(array_values(array_unique(array_filter(
            array_merge([$primary], AiProviderRegistry::freeModels(self::PROVIDER)),
            [self::class, 'isFree']
        ))), 0, self::FALLBACK_MODELS_MAX);
    }

    /** @return array{success: false, error: string, error_code: string, error_params: array, provider_reached: false} */
    public static function paidModelRefused(string $model): array
    {
        return self::failure(self::PAID_MODEL_REFUSED, ['provider' => self::PROVIDER, 'model' => $model]);
    }

    /** @return array{success: false, error: string, error_code: string, error_params: array, provider_reached: false} */
    public static function freeImageModelUnavailable(): array
    {
        return self::failure(self::FREE_IMAGE_MODEL_UNAVAILABLE, ['provider' => self::PROVIDER]);
    }

    /** Free entries of the live catalog, or null when it cannot be read. */
    private static function fetchFreeCatalog(?string $outputModality): ?array
    {
        $key = AiProviderRegistry::firstSecret(self::PROVIDER);
        $query = $outputModality !== null ? ['output_modalities' => $outputModality] : [];
        $response = null;
        $free = [];

        try {
            $response = Http::withHeaders($key !== '' ? ['Authorization' => 'Bearer '.$key] : [])
                ->timeout(self::CATALOG_TIMEOUT_SECONDS)
                ->get(AiProviderRegistry::baseUrl(self::PROVIDER).'/models', $query);
        } catch (ConnectionException) {
            return null;
        }
        if (!$response->successful() || !is_array($response->json()['data'] ?? null)) {
            return null;
        }
        foreach ($response->json()['data'] as $model) {
            if (is_array($model) && !empty($model['id']) && self::isFreeModel($model)) {
                $free[] = [
                    'id' => (string) $model['id'],
                    'name' => (string) ($model['name'] ?? $model['id']),
                    'free' => true,
                    'context_length' => (int) ($model['context_length'] ?? 0),
                    'pricing' => $model['pricing'] ?? null,
                ];
            }
        }

        return $free;
    }

    /** Zero-priced ids without the ":free" suffix, from the cached text catalog (no fetch). */
    private static function pricedFree(): array
    {
        $catalog = Cache::get(self::CATALOG_CACHE_PREFIX.'text');

        return is_array($catalog) ? array_flip(array_column($catalog, 'id')) : [];
    }

    private static function failure(string $code, array $params): array
    {
        return [
            'success' => false,
            'error' => __('ai_gateway.'.$code, $params),
            'error_code' => $code,
            'error_params' => $params,
            'provider_reached' => false,
        ];
    }

    private function __construct()
    {
    }
}
