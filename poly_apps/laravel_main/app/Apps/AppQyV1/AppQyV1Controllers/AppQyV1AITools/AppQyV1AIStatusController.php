<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1AITools;

use App\Http\Controllers\Controller;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService;
use App\Services\GeminiClient;
use App\Services\PycoreAiClient;
use App\Services\TimerTasks\AppQyV1CoverGenerationTask;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

/**
 * AI provider status endpoint.
 *
 * Returns the live availability of every direct AI provider (OpenRouter,
 * Gemini, DeepSeek) used by the translation fallback chain. The JSON shape is
 * aligned FIELD-FOR-FIELD with pycore's /api/local/ai/probe contract
 * (pycore.pyctl.ai.ai_probe) so the desktop UI can consume either source:
 *
 *   {
 *     "providers": [
 *       { "name", "configured", "available", "key_masked",
 *         "models", "error", "latency_ms" }, ...
 *     ],
 *     "fallback_chain": ["openrouter","gemini","deepseek","google"],
 *     "cached": bool,
 *     "age_ms": number
 *   }
 *
 * Probing makes live network calls (list-models per provider) so the result is
 * cached ~30s (config AppQyV1.ai.status_cache_ttl). Pass ?refresh=1 to force a
 * fresh probe. Caching keeps this Octane-safe (no heavy per-request work).
 */
class AppQyV1AIStatusController extends Controller
{
    use ApiResponse;

    private const CACHE_KEY = 'app_qy_v1:ai_status_probe';

    private $translationService;

    public function __construct()
    {
        $this->translationService = new AppQyV1TranslationService();
    }

    /**
     * GET .../ai_tools/ai/status[?refresh=1]
     */
    public function status(Request $request): JsonResponse
    {
        $ttl = (int) config('AppQyV1.ai.status_cache_ttl', 30);
        if ($ttl < 1) {
            $ttl = 1;
        }

        $refresh = $request->boolean('refresh');

        // Cache is best-effort: a misconfigured cache store must never break the
        // status endpoint (it then simply serves a fresh, uncached probe).
        $cached = null;
        if (!$refresh) {
            try {
                $cached = Cache::get(self::CACHE_KEY);
            } catch (\Throwable $e) {
                $cached = null;
            }
        }

        if (is_array($cached) && isset($cached['probed_at'])) {
            $ageMs = round((microtime(true) - $cached['probed_at']) * 1000, 1);
            $payload = $cached['payload'];
            $payload['cached'] = true;
            $payload['age_ms'] = $ageMs;
            return response()->json($payload);
        }

        $probe = $this->translationService->probeProviders();

        $payload = [
            'providers' => $probe['providers'] ?? [],
            'fallback_chain' => array_values((array) config('AppQyV1.ai.fallback_chain', [])),
        ];

        try {
            Cache::put(self::CACHE_KEY, [
                'payload' => $payload,
                'probed_at' => microtime(true),
            ], $ttl);
        } catch (\Throwable $e) {
            // Non-fatal: serve uncached.
        }

        $payload['cached'] = false;
        $payload['age_ms'] = 0.0;

        return response()->json($payload);
    }

    /**
     * POST .../ai_tools/ai/test
     *
     * Live one-shot chat against a single provider/model so the dashboard panel
     * can verify any provider/model end-to-end. No-auth (mirrors /status) so the
     * panel can call it directly. Never throws — chatOnce() captures provider
     * failures and they surface as a 502 with the provider/model/latency payload.
     */
    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'required|string|in:openrouter,gemini,deepseek',
            'model' => 'nullable|string',
            'prompt' => 'nullable|string|max:2000',
        ]);

        $provider = $validated['provider'];
        $model = $validated['model'] ?? null;
        $prompt = trim((string) ($validated['prompt'] ?? ''));
        if ($prompt === '') {
            $prompt = 'Reply with the single word: ok';
        }

        $result = $this->translationService->chatOnce($provider, $model, $prompt);

        if (($result['success'] ?? false) === true) {
            return $this->success([
                'provider' => $result['provider'] ?? $provider,
                'model' => $result['model'] ?? $model,
                'response' => $result['response'] ?? '',
                'latency_ms' => $result['latency_ms'] ?? null,
            ], 'AI test ok');
        }

        return $this->error($result['error'] ?? 'AI test failed', 502, [
            'provider' => $result['provider'] ?? $provider,
            'model' => $result['model'] ?? $model,
            'latency_ms' => $result['latency_ms'] ?? null,
        ]);
    }

    /**
     * GET .../ai_tools/cover-status
     *
     * Dashboard panel for the vocabulary cover pipeline: timer task config,
     * queue counters (incl. live assist leases), Laravel-side Gemini state
     * (probe REUSED from the cached probeProviders payload - never a live
     * probe here), pycore assist availability and the last failures.
     */
    public function coverStatus(): JsonResponse
    {
        $assist = new AppQyV1AssistService();

        // Laravel AI (Gemini) - configured flag is live, probe data comes
        // exclusively from the /ai/status cache (cheap, Octane-safe).
        $gemini = app(GeminiClient::class);
        $keyMasked = null;
        $geminiProbe = null;
        try {
            $cached = Cache::get(self::CACHE_KEY);
            if (is_array($cached)) {
                foreach ((array) ($cached['payload']['providers'] ?? []) as $providerEntry) {
                    if (($providerEntry['name'] ?? '') === 'gemini') {
                        $keyMasked = $providerEntry['key_masked'] ?? null;
                        $geminiProbe = [
                            'available' => (bool) ($providerEntry['available'] ?? false),
                            'error' => $providerEntry['error'] ?? null,
                            'latency_ms' => $providerEntry['latency_ms'] ?? null,
                        ];
                        break;
                    }
                }
            }
        } catch (\Throwable $e) {
            // Cache failure -> probe stays null.
        }

        // pycore assist provider state.
        $pycoreClient = app(PycoreAiClient::class);
        $pycoreProbe = $pycoreClient->probe();
        $pycore = [
            'reachable' => $pycoreProbe !== null,
            'base_url' => $pycoreClient->baseUrl(),
            'image_capable' => $pycoreClient->isImageCapable(),
            'providers' => $pycoreProbe['providers'] ?? null,
            'error' => $pycoreProbe === null ? 'pycore AI endpoint unreachable' : null,
        ];

        $recentFailures = AppQyV1VocabularyLibraryModel::query()
            ->where('cover_status', 'failed')
            ->orderByDesc('cover_finished_at')
            ->limit(5)
            ->get(['id', 'name', 'cover_error_message', 'cover_finished_at'])
            ->map(static fn ($row) => [
                'library_id' => (int) $row->id,
                'name' => $row->name,
                'error' => $row->cover_error_message,
                'at' => optional($row->cover_finished_at)->toIso8601String(),
            ])
            ->values()
            ->all();

        return response()->json([
            'success' => true,
            'task' => [
                'enabled' => (bool) env('APPQYV1_COVER_GENERATION_ENABLED', true),
                'batch_size' => AppQyV1CoverGenerationTask::BATCH_SIZE,
                'retry_delay_minutes' => AppQyV1CoverGenerationTask::RETRY_DELAY_MINUTES,
            ],
            'queue' => $assist->coverCounts(),
            'laravel_ai' => [
                'provider' => 'gemini',
                'configured' => $gemini->hasApiKey(),
                'key_masked' => $keyMasked,
                'probe' => $geminiProbe,
            ],
            'pycore' => $pycore,
            'recent_failures' => $recentFailures,
        ]);
    }

    /**
     * POST .../ai_tools/cover-retry
     *
     * Requeue stuck covers: failed rows and stale processing rows (claimed
     * over 10 minutes ago) go back to pending with a fresh retry budget;
     * expired assist leases are cleared. Live leases/claims are untouched.
     */
    public function coverRetry(): JsonResponse
    {
        $staleProcessingBefore = now()->subMinutes(10);

        $reset = AppQyV1VocabularyLibraryModel::query()
            ->whereNotNull('cover_filename')
            ->where(function ($query) use ($staleProcessingBefore) {
                $query->where('cover_status', 'failed')
                    ->orWhere(function ($staleQuery) use ($staleProcessingBefore) {
                        $staleQuery->where('cover_status', 'processing')
                            ->where('cover_started_at', '<', $staleProcessingBefore);
                    });
            })
            ->update([
                'cover_status' => 'pending',
                'cover_error_message' => null,
                'cover_attempts' => 0,
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        // Clear expired assist leases on otherwise-untouched rows so they
        // re-enter the claimable pool immediately.
        AppQyV1VocabularyLibraryModel::query()
            ->whereNotNull('assist_claimed_at')
            ->where('assist_claimed_at', '<', now()->subMinutes(AppQyV1AssistService::LEASE_MINUTES))
            ->update([
                'assist_claimed_at' => null,
                'assist_claimed_by' => null,
            ]);

        return response()->json([
            'success' => true,
            'reset' => (int) $reset,
            'queue' => (new AppQyV1AssistService())->coverCounts(),
        ]);
    }
}
