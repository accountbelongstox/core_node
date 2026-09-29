<?php

namespace App\Http\Middleware;

use App\Support\LaravelServerIdentity;
use App\Support\QueueCenterContract;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Stamps pycore-facing responses with this server's identity so a server swap behind one URL is noticed at once. */
class ServerIdentityHeader
{
    /** Header name from queue_center_contract.json delivery.server_identity.header. */
    public static function header(): string
    {
        return QueueCenterContract::deliveryServerIdentityHeader();
    }

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        $response->headers->set(self::header(), LaravelServerIdentity::id());

        return $response;
    }
}
