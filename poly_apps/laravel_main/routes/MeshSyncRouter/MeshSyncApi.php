<?php

use App\Apps\MeshSync\MeshSyncControllers\MeshSyncCtl;
use App\Apps\MeshSync\MeshSyncMiddleware\MeshSyncReady;
use App\Apps\MeshSync\MeshSyncServices\MeshSyncContract;
use App\Http\Middleware\ServerIdentityHeader;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

$meshSyncThrottle = 'throttle:'.(int) MeshSyncContract::auth('throttle_per_minute').',1';
$meshSyncRoutes = [
    'info' => [MeshSyncContract::auth('read_middleware'), 'info'],
    'records' => [MeshSyncContract::auth('machine_middleware'), 'records'],
    'changes' => [MeshSyncContract::auth('machine_middleware'), 'changes'],
    'search' => [MeshSyncContract::auth('read_middleware'), 'search'],
    'peers' => [MeshSyncContract::auth('read_middleware'), 'peers'],
];

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])
    ->prefix(MeshSyncContract::routePrefix())
    ->group(function () use ($meshSyncRoutes, $meshSyncThrottle): void {
        foreach ($meshSyncRoutes as $name => [$auth, $action]) {
            $route = MeshSyncContract::route($name);
            Route::match([$route['method']], $route['path'], [MeshSyncCtl::class, $action])
                ->middleware([$auth, MeshSyncReady::class, ServerIdentityHeader::class, $meshSyncThrottle]);
        }
    });
