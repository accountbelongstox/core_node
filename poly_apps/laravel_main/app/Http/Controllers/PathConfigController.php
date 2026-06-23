<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;
use App\Providers\PathMapper;

/**
 * Path Configuration Controller
 * Returns path mappings for frontend components
 * Uses standardized ApiResponse trait
 */
class PathConfigController extends Controller
{
    use ApiResponse;

    /**
     * Single source of truth for the path mappings exposed to the frontend.
     *
     * Paths are resolved DYNAMICALLY (never hardcoded) so they follow the live
     * environment instead of a fixed /www layout:
     *   - code_browser  -> the real core_node checkout (PathMapper::getCoreNodeDir),
     *     e.g. /mnt/<disk>/programing/core_node. The old hardcoded
     *     "/www/programing/core_node" does not exist on this host, so the file
     *     browser 404'd ("Path does not exist or cannot be resolved").
     *   - static_resources -> the web-data static dir under the resolved wwwroot.
     */
    private function pathMappings(): array
    {
        $coreNode = PathMapper::getCoreNodeDir() ?: '/www/programing/core_node';
        $staticDir = PathMapper::mapWebPath('wwwroot') . '/laravel_db/static';

        return [
            'static_resources' => [
                'name' => 'static_resources',
                'path' => $staticDir,
                'description' => 'Static resources directory for media files',
                'accessible' => is_dir($staticDir),
            ],
            'code_browser' => [
                'name' => 'code_browser',
                'path' => $coreNode,
                'description' => 'Code browsing directory',
                'accessible' => is_dir($coreNode),
            ],
        ];
    }

    /**
     * Get all path mapping configurations
     */
    public function getPaths(): JsonResponse
    {
        return $this->success(['paths' => $this->pathMappings()], 'Path mappings retrieved successfully');
    }

    /**
     * Get specific path mapping by name
     */
    public function getPathMapping(string $name): JsonResponse
    {
        $pathMappings = $this->pathMappings();

        if (!isset($pathMappings[$name])) {
            return $this->notFound("Path mapping '{$name}' not found");
        }

        return $this->success($pathMappings[$name], 'Path mapping retrieved successfully');
    }
}
