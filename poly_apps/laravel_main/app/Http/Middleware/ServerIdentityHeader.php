<?php

namespace App\Http\Middleware;

use App\Support\LaravelServerIdentity;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Stamps pycore-facing responses with this server's identity so a server swap behind one URL is noticed at once. */
class ServerIdentityHeader
{
    public const HEADER = 'X-Core-Node-Server-Id';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set(self::HEADER, LaravelServerIdentity::id());

        return $response;
    }
}
