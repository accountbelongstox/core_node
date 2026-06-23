<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ClientTokenAuth;
use App\Http\Middleware\CustomAuthenticate;
use App\Http\Middleware\GoLatency;
use App\Http\Middleware\LocalAccessOnly;
use App\Http\Middleware\LocalDebugOrSanctum;
use App\Http\Middleware\RemoveFrameworkFingerprints;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
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
    ->withProviders([
        \App\Providers\AppServiceProvider::class,
    ])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->api(prepend: [
            GoLatency::class,
            EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->alias([
            'remove.framework.fingerprints' => RemoveFrameworkFingerprints::class,
            'verified' => \App\Http\Middleware\EnsureEmailIsVerified::class,
            'client.token' => ClientTokenAuth::class,
            'custom.authenticate' => CustomAuthenticate::class,
            'local.only' => LocalAccessOnly::class,
            'dashboard.auth' => LocalDebugOrSanctum::class,
        ]);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->validateCsrfTokens(except: [
            'api/*',
            'clipboard/*',
            'api_params_cache/*',
            'translation/*',
            'tts/*',
            // SPA file-manager endpoints (web group): token-less cross-origin POSTs
            // from the wordflow UI. The '*' glob spans '/', so this also covers the
            // nested static-resources/chunked-upload/* sub-paths.
            'static-resources/*',
            // PddToolV1 ROOT-level POST/PUT/DELETE SaaS endpoints (no /api prefix).
            'login',
            'register',
            'users/me/*',
            'batch-orders',
            'batch-orders/*',
            'convert-order-link',
            'recharge/*',
            'pay/*',
            'erp/*',
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
            GoLatency::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
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
