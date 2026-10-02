<?php

namespace App\Services\TimerTasks;

use App\Services\AiGateway\AiProviderRegistry;
use App\Services\AiGateway\OpenRouterFreeOnly;

/**
 * Keeps the OpenRouter free-model catalogs (text and image) cached, so request
 * paths (ai_tools status, image provider choice) read them without fetching.
 */
final class OpenRouterCatalogWarmTask extends OctaneTimerTaskAbstract
{
    private const INTERVAL_SECONDS = 300;

    public function getExecutionMode(): string
    {
        return self::EXECUTION_BACKGROUND;
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        return AiProviderRegistry::isConfigured(OpenRouterFreeOnly::PROVIDER);
    }

    public function exec(): void
    {
        OpenRouterFreeOnly::warmCatalogs();
    }
}
