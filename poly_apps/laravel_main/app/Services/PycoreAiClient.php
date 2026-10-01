<?php

namespace App\Services;

use App\CallPycoreUtils\PycoreHttpClient;
use App\CallPycoreUtils\PycoreRpcException;

/**
 * pycore's local AI gateway state (the third-party assist provider), read
 * through the `local/ai/status` route: {success, providers[{name, image,
 * configured, available, paused, ...}], records}. The payload is cached per
 * worker; an unreachable pycore reads as not image-capable.
 */
class PycoreAiClient
{
    private const PROBE_CACHE_SECONDS = 300;

    private static ?array $lastProbe = null;
    private static float $lastProbeAt = 0.0;

    public function baseUrl(): ?string
    {
        return PycoreHttpClient::baseUrl();
    }

    /** pycore's gateway status payload, or null when pycore is unreachable. */
    public function probe(bool $forceRefresh = false): ?array
    {
        $age = microtime(true) - self::$lastProbeAt;

        if (!$forceRefresh && self::$lastProbe !== null && $age < self::PROBE_CACHE_SECONDS) {
            return self::$lastProbe;
        }
        try {
            self::$lastProbe = PycoreHttpClient::call('localAiStatus', ['refresh' => $forceRefresh]);
            self::$lastProbeAt = microtime(true);
        } catch (PycoreRpcException) {
            // Unreachable endpoints are negative-cached by PycoreHttpClient.
            self::$lastProbe = null;
        }

        return self::$lastProbe;
    }

    /** True when an image-capable provider is configured and not cooling down. */
    public function isImageCapable(): bool
    {
        foreach ((array) ($this->probe()['providers'] ?? []) as $provider) {
            if (is_array($provider) && ($provider['image'] ?? false) && ($provider['configured'] ?? false) && !($provider['paused'] ?? false)) {
                return true;
            }
        }

        return false;
    }
}
