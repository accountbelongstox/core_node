<?php

namespace App\Apps\RelayV2\RelayV2Middleware;

use App\Apps\RelayV2\RelayV2Services\RelayV2DeviceSignatureService;
use App\Apps\RelayV2\RelayV2Services\RelayV2Contract;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RelayV2DeviceSignatureMiddleware
{
    public function __construct(private readonly RelayV2DeviceSignatureService $signatures)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $this->signatures->verify($request);

        return $next($request)
            ->header(RelayV2Contract::header('protocol'), RelayV2Contract::protocolVersion());
    }
}
