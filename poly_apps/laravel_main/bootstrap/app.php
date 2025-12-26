<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\ClientTokenAuth;
use App\Http\Middleware\CustomAuthenticate;
use App\Http\Middleware\GoLatency;
use App\Http\Middleware\LocalAccessOnly;
use App\Http\Middleware\RemoveFrameworkFingerprints;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
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
        ]);

        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->validateCsrfTokens(except: [
            'api/*',
            'clipboard/*',
            'api_params_cache/*',
            'translation/*',
            'tts/*',
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

        // Render all exceptions with full details
        $exceptions->render(function (Throwable $e) {
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
                ], 500);
            }

            // Production mode - minimal error info
            return response()->json([
                'success' => false,
                'message' => 'Internal server error',
                'code' => 500,
            ], 500);
        });
    })->create();
