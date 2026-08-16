<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


use App\Http\Middleware\Authenticate;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ClientTokenAuth;
use App\Http\Middleware\CustomAuthenticate;
use App\Http\Middleware\GoLatency;
use App\Http\Middleware\LocalAccessOnly;
use App\Http\Middleware\LocalDebugOrSanctum;
use App\Http\Middleware\PycoreClientOnly;
use App\Http\Middleware\RemoveFrameworkFingerprints;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Illuminate\Http\Request;

$application = null;
$requestForgeryExclusions = [
    'api/*',
    'clipboard/*',
    'api_params_cache/*',
    'translation/*',
    'tts/*',
    'static-resources/*',
    'login',
    'register',
    'users/me/*',
    'batch-orders',
    'batch-orders/*',
    'convert-order-link',
    'recharge/*',
    'pay/*',
    'erp/*',
];

$application = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // Middleware-free extra routes: the /static/* bare-Octane fallback
        // (production nginx intercepts /static before Laravel sees it).
        then: function () {
            require __DIR__.'/../routes/static.php';
            // PddToolV1 ROOT-level SaaS surface (/login, /register, /users/me, ...)
            // MUST NOT carry the /api prefix (the 订多多 Chrome extension calls these
            // bare paths). Wired here, alongside routes/static.php, so they bypass
            // the api/web middleware groups; per-route 'custom.authenticate' (Sanctum
            // bearer token) guards the protected ones.
            require __DIR__.'/../routes/PddToolV1Router/PddToolV1Root.php';
        },
    )
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['prefix' => 'api', 'middleware' => ['api', 'auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware) use ($requestForgeryExclusions) {
        // API-only app: never redirect unauthenticated guests to a web login
        // route (none exists). Returning null throws AuthenticationException,
        // which bootstrap/app.php renders as a JSON 401 envelope.
        $middleware->redirectGuestsTo(fn (): ?string => null);

        $middleware->api(prepend: [
            GoLatency::class,
            EnsureFrontendRequestsAreStateful::class,
        ]);

        // Trust ONLY the same-machine reverse proxy (nginx -> Octane over
        // loopback). Without this, every request relayed by nginx carries
        // REMOTE_ADDR=127.0.0.1, so $request->ip() would report loopback for
        // remote visitors and the dashboard loopback debug-bypass
        // (LocalDebugOrSanctum / DebugAuthService) would silently log every
        // outside user in as admin. Trusting the loopback proxy makes
        // $request->ip() resolve the real client from X-Forwarded-For, so the
        // bypass only ever triggers for genuine same-machine requests.
        $middleware->trustProxies(at: [
            '127.0.0.1',
            '::1',
        ], headers: Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_HOST
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO);

        $middleware->alias([
            'auth' => Authenticate::class,
            'remove.framework.fingerprints' => RemoveFrameworkFingerprints::class,
            'verified' => \App\Http\Middleware\EnsureEmailIsVerified::class,
            'client.token' => ClientTokenAuth::class,
            'custom.authenticate' => CustomAuthenticate::class,
            'local.only' => LocalAccessOnly::class,
            'dashboard.auth' => LocalDebugOrSanctum::class,
            'pycore.client' => PycoreClientOnly::class,
        ]);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->preventRequestForgery(except: $requestForgeryExclusions);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            GoLatency::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Laravel 13 renders every API or explicitly JSON-preferring request as
        // JSON while the application-specific renderers below retain their
        // established response envelopes and status codes.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*') || $request->expectsJson(),
        );

        // Show all errors with full stack traces in debug mode
        $exceptions->dontReport([]);

        // PddToolV1 (订多多) root SaaS surface must emit FastAPI {"detail":"..."} errors
        // (the Chrome extension reads err.detail). Registered FIRST so it wins over the
        // generic {success:false} renderers for these specific root paths only.
        $exceptions->render(function (Throwable $e, Request $request) {
            $pddPaths = [
                'login', 'register', 'users/me', 'users/me/*',
                'batch-orders', 'batch-orders/*', 'convert-order-link',
                'recharge', 'recharge/*', 'pay/*', 'erp/*', 'pdd/health',
            ];
            if ($request->is(...$pddPaths)) {
                // Unauthenticated on a protected PddTool root path (custom.authenticate
                // throws AuthenticationException / aborts 401) must use the FastAPI
                // {"detail":"Could not validate credentials"} shape the 订多多 extension
                // reads, NOT the generic {success:false} envelope.
                if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                    return response()->json(['detail' => 'Could not validate credentials'], 401);
                }
                $status = 500;
                if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                    $status = $e->getStatusCode();
                }
                if ($status === 401) {
                    return response()->json(['detail' => 'Could not validate credentials'], 401);
                }
                return response()->json(
                    ['detail' => $e->getMessage() !== '' ? $e->getMessage() : 'Internal server error'],
                    $status
                );
            }
        });

        // Handle authentication exceptions for API routes
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated. Please login first.',
                    'code' => 'AUTH_REQUIRED',
                    'error' => 'Unauthenticated'
                ], 401);
            }
        });

        // Handle route not found exceptions
        $exceptions->render(function (\Symfony\Component\Routing\Exception\RouteNotFoundException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Route not found: ' . $e->getMessage(),
                    'code' => 'ROUTE_NOT_FOUND',
                    'error' => 'Route not found'
                ], 404);
            }
        });

        // Validation errors -> 422 with field errors. Registered BEFORE the
        // catch-all Throwable renderer below (which would otherwise emit 500 for
        // a validation failure on every API route).
        $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage(),
                    'code' => 'VALIDATION_ERROR',
                    'errors' => $e->errors(),
                ], 422);
            }
        });

        // Render all other exceptions. The HTTP status is derived from the
        // exception type — an HttpException (abort(404)/403/405/429/...) keeps its
        // own status — defaulting to 500, so API responses carry the correct code
        // instead of collapsing every error to 500.
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->expectsJson() || $request->is('api/*')) {
                $status = 500;
                if ($e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) {
                    $status = $e->getStatusCode();
                }

                if (config('app.debug')) {
                    // Return detailed JSON for API requests
                    return response()->json([
                        'success' => false,
                        'message' => $e->getMessage(),
                        'exception' => get_class($e),
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => collect($e->getTrace())->map(function ($trace) {
                            return [
                                'file' => $trace['file'] ?? null,
                                'line' => $trace['line'] ?? null,
                                'function' => $trace['function'] ?? null,
                                'class' => $trace['class'] ?? null,
                                'type' => $trace['type'] ?? null,
                            ];
                        })->all(),
                        'previous' => $e->getPrevious() ? [
                            'message' => $e->getPrevious()->getMessage(),
                            'exception' => get_class($e->getPrevious()),
                            'file' => $e->getPrevious()->getFile(),
                            'line' => $e->getPrevious()->getLine(),
                        ] : null,
                    ], $status);
                }

                // Production mode - minimal error info. Non-500 HTTP errors expose
                // their (safe) message; a true 500 stays generic.
                return response()->json([
                    'success' => false,
                    'message' => $status === 500 ? 'Internal server error' : $e->getMessage(),
                    'code' => $status,
                ], $status);
            }
        });
    })->create();

// Runtime configuration is owned by LaravelConfig and RuntimeConfigurationStore.
// Point Dotenv at a deliberately absent file so repository .env files are never loaded.
$application->loadEnvironmentFrom('.environment-disabled');

return $application;
