<?php

namespace App\Services\AiGateway;

use Illuminate\Support\Facades\Http;

/**
 * Unified AI provider probe — the PHP port of pycore's pyctl.ai.ai_probe.
 *
 * catalog()   : list every provider WITHOUT any network call (no token spend) —
 *               configured / tier / limits / vision / key_masked / catalog
 *               models + current rate snapshot, all tested:false. The UI renders
 *               its grid from this and only tests on demand.
 * probeOne()  : one provider's live availability test (rate-gated + recorded).
 * probeAll()  : probe every provider (each independent; one failing never aborts
 *               the rest).
 *
 * Contract per provider (UI depends on this EXACT shape):
 *   { name, configured, available, tier, limits, vision, image, key_masked,
 *     models[], error, latency_ms, tested, rate, rate_limited? }
 */
class AiProbe
{
    private const MAX_MODELS = 5;

    /** Catalog of every provider, no live probe. */
    public static function catalog(): array
    {
        $providers = [];
        foreach (AiProviderRegistry::orderedNames() as $name) {
            $rec = self::finalize(self::blank($name));
            $rec['tested'] = false;
            self::attachRate($rec);
            $providers[] = $rec;
        }
        self::sortProviders($providers);
        return ['providers' => $providers];
    }

    /**
     * Single provider live availability test.
     *
     * A probe is a cheap list-models *metadata* call, NOT generation, so it is
     * deliberately NOT rate-gated and NOT counted against the provider's
     * free-tier budget — repeatedly clicking Test / Test All can never starve
     * real text/image generation (the gemini "20/20 but no image" trap). Every
     * probe is still logged (kind="probe") in the shared usage log.
     */
    public static function probeOne(string $name): array
    {
        $name = strtolower(trim($name));

        if (!AiProviderRegistry::exists($name)) {
            $rec = self::finalize(self::blank($name));
            $rec['tested'] = true;
            $rec['error'] = $rec['error'] ?? "Unknown provider '{$name}'";
            return self::attachRate($rec);
        }

        $rec = self::blank($name);
        if (AiProviderRegistry::isConfigured($name)) {
            $start = microtime(true);
            [$models, $error] = self::probeModels($name);
            $rec['latency_ms'] = round((microtime(true) - $start) * 1000, 1);
            if (!empty($models)) {
                $rec['available'] = true;
                $rec['models'] = array_slice($models, 0, self::MAX_MODELS);
            } else {
                $rec['error'] = $error ?: 'No models returned';
            }
        }
        $rec = self::finalize($rec);
        $rec['tested'] = true;

        $models = $rec['models'] ?? [];
        AiUsageLog::record('probe', $name, $models[0] ?? '', (bool) ($rec['available'] ?? false),
            $rec['latency_ms'] ?? null, 'probe', $rec['error'] ?? null);
        return self::attachRate($rec);
    }

    /** Probe every provider in registry order. */
    public static function probeAll(): array
    {
        $providers = [];
        foreach (AiProviderRegistry::orderedNames() as $name) {
            $providers[] = self::probeOne($name);
        }
        self::sortProviders($providers);
        return ['providers' => $providers];
    }

    /**
     * List model ids for one provider via the matching dialect.
     *
     * @return array{0: string[], 1: string|null}
     */
    private static function probeModels(string $provider): array
    {
        // Image-only providers (pollinations / imagen / azure / bedrock / vertex)
        // have no chat /models endpoint to list. Report the catalog when they're
        // configured (image readiness is gated by image_ready, not this probe),
        // and avoid the misleading "key" check (pollinations is keyless; vertex may
        // auth via a token rather than a key_base value).
        if (AiProviderRegistry::isImageOnly($provider)) {
            return AiProviderRegistry::isConfigured($provider)
                ? [AiProviderRegistry::catalogModels($provider, self::MAX_MODELS), null]
                : [[], 'Not configured'];
        }

        $key = AiProviderRegistry::firstSecret($provider);
        if ($key === '') {
            return [[], 'No API key configured'];
        }

        switch (AiProviderRegistry::client($provider)) {
            case 'gemini':
                return self::probeGemini($provider, $key);
            case 'anthropic':
                return self::probeAnthropic($provider, $key);
            case 'cloudflare':
                return self::probeCloudflare($provider, $key);
            default:
                $modelsUrl = AiProviderRegistry::meta($provider)['models_url'] ?? null;
                $client = new OpenAiCompatClient(
                    AiProviderRegistry::baseUrl($provider),
                    $key,
                    AiProviderRegistry::extraHeaders($provider)
                );
                [$models, $error] = $client->listModels($modelsUrl);
                // Some compat providers (e.g. modern Spark) lack a /models route;
                // fall back to the catalog so a working key is not shown as down.
                if (empty($models) && $provider === 'spark') {
                    return [AiProviderRegistry::catalogModels($provider, self::MAX_MODELS), null];
                }
                return [$models, $error];
        }
    }

    private static function probeGemini(string $provider, string $key): array
    {
        try {
            $resp = Http::timeout(20)->get(AiProviderRegistry::baseUrl($provider) . '/models?key=' . urlencode($key));
            if ($resp->status() !== 200) {
                return [[], 'HTTP ' . $resp->status()];
            }
            $ids = [];
            foreach ($resp->json()['models'] ?? [] as $m) {
                $id = (string) ($m['name'] ?? '');
                if ($id !== '') {
                    $ids[] = str_starts_with($id, 'models/') ? substr($id, 7) : $id;
                }
            }
            return [$ids, $ids ? null : 'No models returned'];
        } catch (\Throwable $e) {
            return [[], $e->getMessage()];
        }
    }

    private static function probeAnthropic(string $provider, string $key): array
    {
        try {
            $resp = Http::withHeaders(['x-api-key' => $key, 'anthropic-version' => '2023-06-01'])
                ->timeout(20)->get(AiProviderRegistry::baseUrl($provider) . '/models');
            if ($resp->status() !== 200) {
                return [[], 'HTTP ' . $resp->status()];
            }
            $ids = [];
            foreach ($resp->json()['data'] ?? [] as $m) {
                if (!empty($m['id'])) {
                    $ids[] = (string) $m['id'];
                }
            }
            return [$ids, $ids ? null : 'No models returned'];
        } catch (\Throwable $e) {
            return [[], $e->getMessage()];
        }
    }

    private static function probeCloudflare(string $provider, string $key): array
    {
        $accountId = AiProviderRegistry::extraSecret($provider);
        if ($accountId === '') {
            return [[], 'CLOUDFLARE_ACCOUNT_ID not configured'];
        }
        try {
            $url = AiProviderRegistry::baseUrl($provider) . '/accounts/' . $accountId . '/ai/models/search';
            $resp = Http::withHeaders(['Authorization' => 'Bearer ' . $key])->timeout(20)->get($url);
            if ($resp->status() !== 200) {
                return [[], 'HTTP ' . $resp->status()];
            }
            $ids = [];
            foreach ($resp->json()['result'] ?? [] as $m) {
                if (!empty($m['name'])) {
                    $ids[] = (string) $m['name'];
                }
            }
            return [$ids, $ids ? null : 'No models returned'];
        } catch (\Throwable $e) {
            return [[], $e->getMessage()];
        }
    }

    // --- record helpers ---------------------------------------------------- //

    private static function blank(string $name): array
    {
        $configured = AiProviderRegistry::exists($name) && AiProviderRegistry::isConfigured($name);
        $key = AiProviderRegistry::exists($name) ? AiProviderRegistry::firstSecret($name) : '';
        $meta = AiProviderRegistry::meta($name);
        return [
            'name' => $name,
            'configured' => $configured,
            'available' => false,
            'tier' => $meta['tier'] ?? 'paid',
            'limits' => $meta['limits'] ?? '',
            'vision' => $meta['vision'] ?? false,
            'image' => $meta['image'] ?? false,
            // image_ready = registry image flag AND an image-usable key exists
            // (or keyless). Consumers gate image work on THIS, not the volatile
            // live `available`. Mirrors pycore ai_probe.
            'image_ready' => (bool) ($meta['image'] ?? false) && AiProviderRegistry::hasImageKey($name),
            'image_model' => ($meta['image'] ?? false) ? (string) ($meta['image_model'] ?? '') : '',
            'key_masked' => $configured ? AiProviderRegistry::maskKey($key) : null,
            'models' => [],
            'error' => $configured ? null : 'No API key configured',
            'latency_ms' => null,
        ];
    }

    private static function finalize(array $rec): array
    {
        $name = $rec['name'] ?? '';
        $meta = AiProviderRegistry::meta($name);
        $rec['tier'] = $meta['tier'] ?? 'paid';
        $rec['limits'] = $meta['limits'] ?? '';
        $rec['vision'] = $meta['vision'] ?? false;
        $rec['image'] = $meta['image'] ?? false;
        $rec['image_ready'] = (bool) ($meta['image'] ?? false) && AiProviderRegistry::hasImageKey($name);
        $rec['image_model'] = ($meta['image'] ?? false) ? (string) ($meta['image_model'] ?? '') : '';
        if (!empty($rec['configured']) && empty($rec['models'])) {
            $rec['models'] = AiProviderRegistry::catalogModels($name, self::MAX_MODELS);
        }
        return $rec;
    }

    private static function attachRate(array &$rec): array
    {
        $name = $rec['name'] ?? '';
        try {
            $rec['rate'] = AiRateLimiter::rateStatus($name)['status'] ?? null;
        } catch (\Throwable $e) {
            $rec['rate'] = null;
        }
        return $rec;
    }

    private static function sortProviders(array &$providers): void
    {
        $order = array_flip(AiProviderRegistry::orderedNames());
        usort($providers, static function ($a, $b) use ($order) {
            $rank = static function ($p) {
                if (!empty($p['available'])) {
                    return 0;
                }
                return !empty($p['configured']) ? 1 : 2;
            };
            $ra = $rank($a);
            $rb = $rank($b);
            if ($ra !== $rb) {
                return $ra <=> $rb;
            }
            return ($order[$a['name']] ?? 999) <=> ($order[$b['name']] ?? 999);
        });
    }
}
