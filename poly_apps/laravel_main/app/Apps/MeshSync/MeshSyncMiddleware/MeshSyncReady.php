<?php

namespace App\Apps\MeshSync\MeshSyncMiddleware;

use App\Apps\MeshSync\MeshSyncServices\MeshSyncInitializer;
use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class MeshSyncReady
{
    use ApiResponse;

    private const HTTP_UNAVAILABLE = 503;
    private const RETRY_AFTER_SECONDS = '30';

    public function handle(Request $request, Closure $next): Response
    {
        $missing = MeshSyncInitializer::missingTables();

        if ($missing !== []) {
            return $this->codedError('MESH_SYNC_NOT_INITIALIZED', __('mesh_sync.not_initialized'),
                ['missing_tables' => $missing], self::HTTP_UNAVAILABLE)
                ->header('Cache-Control', 'no-store, private')
                ->header('Retry-After', self::RETRY_AFTER_SECONDS);
        }

        return $next($request);
    }
}
