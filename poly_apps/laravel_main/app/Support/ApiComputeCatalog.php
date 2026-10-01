<?php

namespace App\Support;

use App\Http\Middleware\ClientKeyOnly;
use App\Http\Middleware\ClientKeyOrDashboard;
use App\Http\Middleware\LocalDebugOrSanctum;
use Illuminate\Support\Facades\Route;

/**
 * Compute classification of every Laravel API, exposed per endpoint at
 * /api_info (ApiInfoIndex merges classify() into each endpoint entry):
 * - pycore_required: the result is produced by a pycore task (the request
 *   queues it; see PycoreTaskQueue for the queued / pycore_unavailable shapes);
 * - compute: none (data, CRUD, keyed-AI gateway, remote APIs) | light (local
 *   work capped by ResourceLimiter) | pycore;
 * - pycore_task_types: the pycore task types an endpoint produces;
 * - direct_api_capable / direct_api_kinds: marker only, read from those task
 *   types in config/queue_center_contract.json (a keyed remote API could
 *   serve them instead of pycore in a future upgrade);
 * - auth: present on the compute routes this catalog protects (AUTH_MIDDLEWARE);
 * - platforms: present only when an endpoint is linux-only.
 *
 * Everything not matched is pycore_required false / compute none, so wordnew
 * may call it directly on Laravel.
 */
final class ApiComputeCatalog
{
    public const COMPUTE_NONE = 'none';
    public const COMPUTE_LIGHT = 'light';
    public const COMPUTE_PYCORE = 'pycore';

    /**
     * Auth for routes that create pycore tasks or run light local work: a K3
     * client-key signature (wordnew and pycore sign with CORE_NODE_CLIENT_KEY_1)
     * or a dashboard / user session, plus the per-caller `compute` throttle.
     */
    public const AUTH_MIDDLEWARE = ['client.key_or_dashboard:user', 'throttle:'.self::THROTTLE];
    public const AUTH_MIDDLEWARE_ADMIN = ['client.key_or_dashboard', 'throttle:'.self::THROTTLE];
    public const THROTTLE = 'compute';
    public const THROTTLE_PER_MINUTE = 30;
    /** Own limiter of the public signed-route table (not shared with compute work). */
    public const THROTTLE_ROUTE_TABLE = 'client-key-routes';
    public const THROTTLE_ROUTE_TABLE_PER_MINUTE = 60;
    public const AUTH_CLIENT_KEY_OR_SESSION = 'client_key_or_session';
    public const AUTH_CLIENT_KEY = 'client_key';
    private const MIDDLEWARE_CLIENT_KEY = 'client.key';
    private const MIDDLEWARE_CLIENT_KEY_OR_SESSION = 'client.key_or_dashboard';
    public const AUTH_PUBLIC_THROTTLED = 'public_throttled';

    /** Path regex => classification (first match wins). */
    private const RULES = [
        '#^/api/(ocr/recognize(-batch)?|mcp/v1/ocr/(recognize|smart-recognize|batch))$#' => [
            'pycore_required' => true, 'compute' => self::COMPUTE_PYCORE, 'pycore_task_types' => ['ocr_recognize'],
            'auth' => self::AUTH_CLIENT_KEY_OR_SESSION,
        ],
        '#^/api/mcp/v1/voice-subtitle/add(-text|-image|-voice)?$#' => [
            'pycore_required' => true, 'compute' => self::COMPUTE_PYCORE, 'pycore_task_types' => ['ocr_recognize', 'tts_synthesize'],
            'auth' => self::AUTH_CLIENT_KEY_OR_SESSION,
        ],
        '#^/tts/(generate|batch-generate)$#' => [
            'pycore_required' => true, 'compute' => self::COMPUTE_PYCORE, 'pycore_task_types' => ['tts_synthesize'],
            'auth' => self::AUTH_CLIENT_KEY_OR_SESSION,
        ],
        '#^/api/app_qy_v1/(ai_tools/tts/sentence/audio/head|word/audio/head)$#' => [
            'pycore_required' => true, 'compute' => self::COMPUTE_PYCORE, 'pycore_task_types' => ['word_audio', 'sentence_audio'],
            'auth' => self::AUTH_CLIENT_KEY_OR_SESSION,
        ],
        '#^/api/(queue-center/queues/[^/]+/head(/batch)?|app_qy_v1/ai_tools/tts/(generate|batch-generate|queue/add|queue/add-at-position|queue/batch/(add|query)|queue_batch))$#' => [
            'pycore_required' => true, 'compute' => self::COMPUTE_PYCORE, 'pycore_task_types' => ['word_audio', 'sentence_audio'],
        ],
        '#^/api/ittools/v1/advanced/pdf/#' => [
            'pycore_required' => false, 'compute' => self::COMPUTE_LIGHT, 'platforms' => ['linux'],
            'auth' => self::AUTH_CLIENT_KEY_OR_SESSION,
        ],
        '#^/api/(ittools/v1/advanced/image/|mcp/v1/placeholders/generate|app_qy_v1/system/initialize$)#' => [
            'pycore_required' => false, 'compute' => self::COMPUTE_LIGHT,
            'auth' => self::AUTH_CLIENT_KEY_OR_SESSION,
        ],
        '#^/api/public/avatar/#' => [
            'pycore_required' => false, 'compute' => self::COMPUTE_LIGHT,
            'auth' => self::AUTH_PUBLIC_THROTTLED,
        ],
        '#^/api/(app_qy_v1/social/posts/[^/]+/images|app_qy_v1/user/avatar|app_qy_v1/system/reinitialize)$#' => [
            'pycore_required' => false, 'compute' => self::COMPUTE_LIGHT,
        ],
    ];

    /**
     * @return array{pycore_required: bool, compute: string, direct_api_capable: bool, direct_api_kinds: array, pycore_task_types?: array, platforms?: array}
     */
    public static function classify(string $pathOrUrl): array
    {
        $path = '/'.ltrim((string) (parse_url($pathOrUrl, PHP_URL_PATH) ?? $pathOrUrl), '/');
        $classification = ['pycore_required' => false, 'compute' => self::COMPUTE_NONE];
        $direct = ['direct_api_capable' => false, 'direct_api_kinds' => []];
        $marker = null;

        foreach (self::RULES as $pattern => $rule) {
            if (preg_match($pattern, $path) === 1) {
                $classification = $rule;
                break;
            }
        }
        foreach ($classification['pycore_task_types'] ?? [] as $taskType) {
            $marker = QueueCenterContract::taskTypeDirectApi($taskType);
            $direct['direct_api_capable'] = $direct['direct_api_capable'] || $marker['direct_api_capable'];
            $direct['direct_api_kinds'] = array_values(array_unique(array_merge($direct['direct_api_kinds'], $marker['direct_api_kinds'])));
        }

        return $classification + $direct;
    }

    /**
     * Routes that accept a K3 client-key signature, read from the live route
     * table (route and controller middleware), so clients derive the list:
     * [{method, path, auth: client_key | client_key_or_session}]. HEAD is listed
     * wherever GET is (it passes the same middleware and is signed the same way).
     * $publicOnly keeps the routes a client may sign instead of logging in
     * (client_key_or_session, any session level; `session_level` says which
     * login an unsigned call needs); worker-only routes (client_key, the pycore
     * worker API) stay in the admin-only /api_info.
     *
     * @return array<int, array{method: string, path: string, auth: string, session_level?: string}>
     */
    public static function signedRoutes(bool $publicOnly = false): array
    {
        $routes = [];
        $auth = null;
        $level = null;
        $parts = [];

        foreach (Route::getRoutes()->getRoutes() as $route) {
            $auth = null;
            $level = null;
            foreach ($route->gatherMiddleware() as $middleware) {
                $parts = is_string($middleware) ? explode(':', $middleware, 2) : [''];
                if ($parts[0] === self::MIDDLEWARE_CLIENT_KEY || $parts[0] === ClientKeyOnly::class) {
                    $auth = self::AUTH_CLIENT_KEY;
                } elseif ($auth === null && ($parts[0] === self::MIDDLEWARE_CLIENT_KEY_OR_SESSION || $parts[0] === ClientKeyOrDashboard::class)) {
                    $auth = self::AUTH_CLIENT_KEY_OR_SESSION;
                    $level = $parts[1] ?? LocalDebugOrSanctum::LEVEL_ADMIN;
                }
            }
            if ($auth === null || ($publicOnly && $auth !== self::AUTH_CLIENT_KEY_OR_SESSION)) {
                continue;
            }
            foreach ($route->methods() as $method) {
                $routes[] = ['method' => $method, 'path' => '/'.ltrim($route->uri(), '/'), 'auth' => $auth]
                    + ($level !== null ? ['session_level' => $level] : []);
            }
        }
        usort($routes, static fn (array $a, array $b): int => [$a['path'], $a['method']] <=> [$b['path'], $b['method']]);

        return $routes;
    }

    private function __construct()
    {
    }
}
