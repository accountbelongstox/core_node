<?php

namespace App\Apps\Relay\RelayMiddleware;

use App\Apps\Relay\RelayServices\RelayDeviceSignatureService;
use App\Apps\Relay\RelayServices\RelayContract;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class RelayDeviceSignatureMiddleware
{
    public function __construct(private readonly RelayDeviceSignatureService $signatures)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $this->signatures->verify($request);

        return $next($request)
            ->header(RelayContract::header('protocol'), RelayContract::protocolVersion());
    }
}
