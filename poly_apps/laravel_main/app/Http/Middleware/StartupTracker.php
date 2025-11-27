<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Utils\StartupLogger;

class StartupTracker
{
    private static $firstRequestLogged = false;

    public function handle(Request $request, Closure $next): Response
    {
        if (!self::$firstRequestLogged) {
            self::$firstRequestLogged = true;

            StartupLogger::checkpoint('FIRST_REQUEST_RECEIVED', 'First HTTP request received', [
                'method' => $request->method(),
                'url' => $request->fullUrl(),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
        }

        StartupLogger::checkpoint('REQUEST_BEFORE_HANDLER', 'Processing request', [
            'route' => $request->path()
        ]);

        $response = $next($request);

        StartupLogger::checkpoint('REQUEST_AFTER_HANDLER', 'Request processed', [
            'status' => $response->getStatusCode(),
            'content_length' => strlen($response->getContent())
        ]);

        return $response;
    }
}
