<?php

namespace App\Services\Relay;

use App\Support\QueueCenterContract;

/**
 * Capability-provider registry (PART_1 1.8): contract-driven declarations.
 *
 * Groups render what the contract declares - no end hardcodes who else
 * exists. Only pycore is implemented in this pass; laravel-manager, wordnew
 * and mcp-chrome are declaration-only.
 */
final class RelayCapabilityRegistry
{
    public static function providers(): array
    {
        return QueueCenterContract::relayCapabilityProviders();
    }

    public static function isImplemented(string $provider): bool
    {
        $providers = self::providers();
        $entry = $providers[$provider] ?? [];

        return ($entry['implemented'] ?? false) === true;
    }

    /**
     * @return array<int, string>
     */
    public static function providersForClass(string $class): array
    {
        $matches = [];
        foreach (self::providers() as $provider => $entry) {
            if (($entry['class'] ?? '') === $class) {
                $matches[] = (string) $provider;
            }
        }

        return $matches;
    }

    /**
     * @return array<int, string>
     */
    public static function providedCapabilities(string $provider): array
    {
        $entry = self::providers()[$provider] ?? [];
        $provides = $entry['provides'] ?? [];

        return array_values(array_filter(is_array($provides) ? $provides : [], 'is_string'));
    }
}
