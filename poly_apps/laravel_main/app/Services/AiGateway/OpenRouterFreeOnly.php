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
    private const CATALOG_CACHE_PREFIX = 'openrouter_free_catalog:v2:';
    private const CATALOG_LOCK_PREFIX = 'openrouter_free_catalog:fetch:';
    private const CATALOG_CACHE_SECONDS = 3600;
    /** A failed or empty fetch is cached this long (config services.openrouter.catalog_failure_cache_seconds). */
    private const CATALOG_FAILURE_CACHE_SECONDS = 600;
    /** The stored entry (and its last good catalog) outlives its expiry this long for stale serving. */
    private const CATALOG_KEEP_SECONDS = 86400;
    private const CATALOG_LOCK_SECONDS = 30;
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
     * Free catalog entries {id, name, free, context_length, pricing} per output
     * modality (null = text). Every fetch result is cached: a non-empty one an
     * hour, a failed or empty one CATALOG_FAILURE_CACHE_SECONDS (a failure keeps
     * serving the last good catalog). Past expiry one caller refetches under a
     * single-flight lock while the others serve the stored entry without
     * waiting. With nothing usable the text catalog falls back to the registry
     * free ids and the image catalog is empty.
     */
    public static function freeCatalog(?string $outputModality = null): array
    {
        $entry = self::catalogEntry($outputModality);

        if ($entry !== null && (int) $entry['expires_at'] > time()) {
            return self::entryCatalog($entry, $outputModality);
        }

        return self::refreshCatalog($outputModality);
    }

    /** Cache-only read for request paths that must never fetch: the stored catalog, else the fallback. */
    public static function cachedFreeCatalog(?string $outputModality = null): array
    {
        $entry = self::catalogEntry($outputModality);

        return $entry !== null ? self::entryCatalog($entry, $outputModality) : self::fallbackCatalog($outputModality);
    }

    /** Background warm-up: refetch the text and image catalogs whose entries expired. */
    public static function warmCatalogs(): void
    {
        foreach ([null, self::IMAGE_MODALITY] as $modality) {
            self::freeCatalog($modality);
        }
    }

    /** Single-flight refetch; a caller that loses the lock serves the stored entry or the fallback. */
    private static function refreshCatalog(?string $outputModality): array
    {
        $lockKey = self::CATALOG_LOCK_PREFIX.($outputModality ?? 'text');
        $entry = null;
        $fetched = null;
        $ttl = 0;

        if (!Cache::add($lockKey, 1, self::CATALOG_LOCK_SECONDS)) {
            $entry = self::catalogEntry($outputModality);

            return $entry !== null ? self::entryCatalog($entry, $outputModality) : self::fallbackCatalog($outputModality);
        }
        try {
            $entry = self::catalogEntry($outputModality);
            $fetched = self::fetchFreeCatalog($outputModality);
            $ttl = $fetched !== null && $fetched !== []
                ? self::CATALOG_CACHE_SECONDS
                : max(1, (int) config('services.openrouter.catalog_failure_cache_seconds', self::CATALOG_FAILURE_CACHE_SECONDS));
            $entry = [
                'catalog' => $fetched ?? ($entry['catalog'] ?? []),
                'expires_at' => time() + $ttl,
            ];
            Cache::put(self::CATALOG_CACHE_PREFIX.($outputModality ?? 'text'), $entry, $ttl + self::CATALOG_KEEP_SECONDS);
        } finally {
            Cache::forget($lockKey);
        }

        return self::entryCatalog($entry, $outputModality);
    }

    /** @return array{catalog: array, expires_at: int}|null */
    private static function catalogEntry(?string $outputModality): ?array
    {
        $entry = Cache::get(self::CATALOG_CACHE_PREFIX.($outputModality ?? 'text'));

        return is_array($entry) && is_array($entry['catalog'] ?? null) && isset($entry['expires_at']) ? $entry : null;
    }

    private static function entryCatalog(array $entry, ?string $outputModality): array
    {
        return $entry['catalog'] !== [] ? $entry['catalog'] : self::fallbackCatalog($outputModality);
    }

    private static function fallbackCatalog(?string $outputModality): array
    {
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

    /**
     * First free image-output model, or null when OpenRouter offers none.
     * $cachedOnly reads the stored catalog without fetching (request paths).
     */
    public static function freeImageModel(bool $cachedOnly = false): ?string
    {
        $catalog = $cachedOnly ? self::cachedFreeCatalog(self::IMAGE_MODALITY) : self::freeCatalog(self::IMAGE_MODALITY);

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
        $entry = self::catalogEntry(null);

        return $entry !== null ? array_flip(array_column($entry['catalog'], 'id')) : [];
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
