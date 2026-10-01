<?php

namespace App\Services\AiGateway;

/**
 * OpenRouter is used with free models only (the shared 1000/day free budget in
 * ai_rate_usage.json). Mirrors pycore's ai_request_failures codes:
 * AI_PAID_MODEL_REFUSED {provider, model} and AI_FREE_IMAGE_MODEL_UNAVAILABLE {provider}.
 */
final class OpenRouterFreeOnly
{
    public const PROVIDER = 'openrouter';
    public const PAID_MODEL_REFUSED = 'AI_PAID_MODEL_REFUSED';
    public const FREE_IMAGE_MODEL_UNAVAILABLE = 'AI_FREE_IMAGE_MODEL_UNAVAILABLE';
    private const FREE_ROUTER = 'openrouter/free';
    private const FREE_SUFFIX = ':free';

    public static function isFree(string $model): bool
    {
        return $model === self::FREE_ROUTER || str_ends_with($model, self::FREE_SUFFIX);
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
