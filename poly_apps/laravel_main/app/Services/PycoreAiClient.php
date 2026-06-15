<?php

namespace App\Services;

use App\Support\CoreNodeSecrets;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * HTTP client for the pycore local AI surface (third-party assist provider).
 *
 * pycore binds 0.0.0.0:59000 on the Windows host while Laravel runs in WSL,
 * so the reachable address differs per environment:
 *   - explicit override: CoreNodeSecrets PYCORE_BASE_URL (global-var store);
 *   - 127.0.0.1:59000 (same-host / port-forwarded setups);
 *   - the WSL default-gateway nameserver from /etc/resolv.conf (the Windows
 *     host as seen from inside WSL).
 *
 * The first candidate whose GET /api/local/ai/probe answers (2s timeout) is
 * cached in a static for the worker's lifetime; failures are re-checked at
 * most every 30 seconds (negative cache) so image capability recovers quickly
 * once pycore comes up. No retries anywhere by design - status/UI surfaces
 * treat an unreachable pycore as not-image-capable.
 */
class PycoreAiClient
{
    private const PROBE_TIMEOUT_SECONDS = 2;
    private const IMAGE_TIMEOUT_SECONDS = 120;
    private const NEGATIVE_RECHECK_SECONDS = 30;
    private const PROBE_CACHE_SECONDS = 300;

    /** Resolved working base URL (null = not resolved yet / unreachable). */
    private static ?string $resolvedBaseUrl = null;

    /** Last successful probe payload for the resolved base URL. */
    private static ?array $lastProbe = null;

    /** monotonic-ish timestamp of the last resolution attempt (s). */
    private static float $lastAttemptAt = 0.0;

    /** timestamp of the cached probe payload (s). */
    private static float $lastProbeAt = 0.0;

    /**
     * Candidate base URLs, most specific first.
     *
     * @return string[]
     */
    public function candidateBaseUrls(): array
    {
        $configured = trim((string) CoreNodeSecrets::get('PYCORE_BASE_URL', ''));
        if ($configured !== '') {
            return [rtrim($configured, '/')];
        }

        $candidates = ['http://127.0.0.1:59000'];

        $nameserver = $this->readResolvConfNameserver();
        if ($nameserver !== null) {
            $candidates[] = "http://{$nameserver}:59000";
        }

        return $candidates;
    }

    /**
     * Resolve (and statically cache) the first reachable pycore base URL.
     * Unreachable results are re-tested at most every 5 minutes.
     */
    public function baseUrl(): ?string
    {
        if (self::$resolvedBaseUrl !== null) {
            return self::$resolvedBaseUrl;
        }

        $now = microtime(true);
        if (self::$lastAttemptAt > 0 && ($now - self::$lastAttemptAt) < self::NEGATIVE_RECHECK_SECONDS) {
            return null; // negative cache still fresh (30s)
        }
        self::$lastAttemptAt = $now;

        foreach ($this->candidateBaseUrls() as $candidate) {
            $probe = $this->probeUrl($candidate);
            if ($probe !== null) {
                self::$resolvedBaseUrl = $candidate;
                self::$lastProbe = $probe;
                self::$lastProbeAt = microtime(true);
                Log::info('[PycoreAiClient] pycore AI endpoint resolved', ['base_url' => $candidate]);
                return $candidate;
            }
        }

        return null;
    }

    /**
     * GET /api/local/ai/probe of the resolved endpoint. Returns the decoded
     * payload ({providers: [...], ...}) or null when pycore is unreachable.
     * The payload is cached for 5 minutes; pass $forceRefresh to re-probe.
     */
    public function probe(bool $forceRefresh = false): ?array
    {
        $baseUrl = $this->baseUrl();
        if ($baseUrl === null) {
            return null;
        }

        $age = microtime(true) - self::$lastProbeAt;
        if (!$forceRefresh && self::$lastProbe !== null && $age < self::PROBE_CACHE_SECONDS) {
            return self::$lastProbe;
        }

        $probe = $this->probeUrl($baseUrl);
        if ($probe === null) {
            // Endpoint went away: drop the positive cache so the next call
            // re-resolves (subject to the 5-minute negative recheck).
            self::$resolvedBaseUrl = null;
            self::$lastProbe = null;
            return null;
        }

        self::$lastProbe = $probe;
        self::$lastProbeAt = microtime(true);

        return $probe;
    }

    /**
     * True when pycore is reachable AND at least one provider reports it is
     * ready to generate images. Gates on the probe's `image_ready` field
     * (capability AND key present, no live call) so a transient live-probe
     * failure does not mark pycore image-incapable. Falls back to
     * `configured && image` when `image_ready` is absent from the payload.
     */
    public function isImageCapable(): bool
    {
        $probe = $this->probe();
        if ($probe === null) {
            return false;
        }

        foreach ((array) ($probe['providers'] ?? []) as $provider) {
            if (!is_array($provider)) {
                continue;
            }
            if (array_key_exists('image_ready', $provider)) {
                if ($provider['image_ready']) {
                    return true;
                }
                continue;
            }
            if (($provider['configured'] ?? false) && ($provider['image'] ?? false)) {
                return true;
            }
        }

        return false;
    }

    /**
     * POST /api/local/ai/image. Returns the pycore payload verbatim on HTTP
     * success ({success, provider, model, image_base64, mime, latency_ms,
     * error}); transport-level failures collapse to {success:false, error}.
     */
    public function generateImage(string $prompt, string $size = '1024x1024', ?string $model = null): array
    {
        $baseUrl = $this->baseUrl();
        if ($baseUrl === null) {
            return ['success' => false, 'error' => 'pycore AI endpoint unreachable'];
        }

        try {
            $response = Http::timeout(self::IMAGE_TIMEOUT_SECONDS)
                ->acceptJson()
                ->post($baseUrl . '/api/local/ai/image', array_filter([
                    'prompt' => $prompt,
                    'size' => $size,
                    'model' => $model,
                    'source' => 'laravel_main',
                ], static fn ($v) => $v !== null));

            $payload = $response->json();
            if (!is_array($payload)) {
                return [
                    'success' => false,
                    'error' => 'pycore image endpoint returned non-JSON (HTTP ' . $response->status() . ')',
                ];
            }
            if (!$response->successful() && !isset($payload['success'])) {
                $payload['success'] = false;
                $payload['error'] = $payload['error'] ?? ('HTTP ' . $response->status());
            }

            return $payload;
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => 'pycore transport failure: ' . $e->getMessage()];
        }
    }

    /** One probe request against one candidate; null on any failure. */
    private function probeUrl(string $baseUrl): ?array
    {
        try {
            $response = Http::timeout(self::PROBE_TIMEOUT_SECONDS)
                ->acceptJson()
                ->get($baseUrl . '/api/local/ai/probe');

            if (!$response->successful()) {
                return null;
            }

            $payload = $response->json();
            return is_array($payload) ? $payload : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** First nameserver from /etc/resolv.conf (WSL -> Windows-host address). */
    private function readResolvConfNameserver(): ?string
    {
        $path = '/etc/resolv.conf';
        if (!is_file($path) || !is_readable($path)) {
            return null;
        }

        $content = @file_get_contents($path);
        if ($content === false) {
            return null;
        }

        if (preg_match('/^\s*nameserver\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s*$/m', $content, $m)) {
            return $m[1];
        }

        return null;
    }
}
