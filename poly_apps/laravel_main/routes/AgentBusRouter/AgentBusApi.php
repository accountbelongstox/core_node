<?php

use App\Apps\AgentBus\AgentBusControllers\AgentBusCtl;
use App\Apps\AgentBus\AgentBusMcp\AgentBusMcpServer;
use App\Apps\AgentBus\AgentBusMiddleware\AgentBusReady;
use App\Apps\AgentBus\AgentBusServices\AgentBusContract;
use Illuminate\Support\Facades\Route;
use Laravel\Mcp\Facades\Mcp;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

$agentBusMiddleware = [
    (string) AgentBusContract::get('auth')['middleware'],
    AgentBusReady::class,
    'throttle:'.(int) AgentBusContract::get('auth')['throttle_per_minute'].',1',
];

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->group(function () use ($agentBusMiddleware): void {
    Route::get(AgentBusContract::routePrefix().'/info', [AgentBusCtl::class, 'info'])->middleware('throttle:60,1');

    Mcp::web(AgentBusContract::mcpRoute(), AgentBusMcpServer::class)->middleware($agentBusMiddleware);

    Route::prefix(AgentBusContract::routePrefix())->middleware($agentBusMiddleware)->group(function (): void {
        foreach (AgentBusContract::operations() as $operation) {
            Route::match([$operation['method']], $operation['path'], [AgentBusCtl::class, 'call'])
                ->defaults('operation', $operation['name']);
        }
    });
});
