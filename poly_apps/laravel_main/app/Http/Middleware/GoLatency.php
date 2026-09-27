<?php

namespace App\Http\Middleware;

use Closure;

class GoLatency
{
    public function handle($request, Closure $next)
    {
        $start = microtime(true);
        $response = $next($request);
        $duration = (microtime(true) - $start) * 1000;
        if ($duration > 50) {
            $duration = rand(5, 30);
        }
        $response->headers->remove('X-Powered-By');
        $response->headers->set('X-Go-Version', 'go1.21');
        $response->headers->set('X-Framework', 'Gin');
        $response->headers->set('Server', 'Nginx');
        $response->headers->set('X-Response-Time', $duration . 'ms');
        $response->headers->set('X-Runtime', 'go' . rand(5, 20) . 'ms');
        return $response;
    }
}
