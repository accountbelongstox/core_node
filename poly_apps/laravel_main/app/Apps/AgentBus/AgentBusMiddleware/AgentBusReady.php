<?php

namespace App\Apps\AgentBus\AgentBusMiddleware;

use App\Apps\AgentBus\AgentBusServices\AgentBusInitializer;
use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class AgentBusReady
{
    use ApiResponse;

    private const HTTP_UNAVAILABLE = 503;
    private const RETRY_AFTER_SECONDS = '30';

    public function handle(Request $request, Closure $next): Response
    {
        $missing = AgentBusInitializer::missingTables();

        if ($missing !== []) {
            return $this->codedError('AGENT_BUS_NOT_INITIALIZED', __('agent_bus.not_initialized'),
                ['missing_tables' => $missing], self::HTTP_UNAVAILABLE)
                ->header('Cache-Control', 'no-store, private')
                ->header('Retry-After', self::RETRY_AFTER_SECONDS);
        }

        return $next($request);
    }
}
