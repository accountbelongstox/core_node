<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use App\Traits\ApiResponse;

/**
 * Path Configuration Controller
 * Returns path mappings for frontend components
 * Uses standardized ApiResponse trait
 */
class PathConfigController extends Controller
{
    use ApiResponse;

    /**
     * Get all path mapping configurations
     */
    public function getPaths(): JsonResponse
    {
        $paths = [
            'static_resources' => [
                'name' => 'static_resources',
                'path' => '/www/wwwroot/laravel_db/static',
                'description' => 'Static resources directory for media files',
                'accessible' => true
            ],
            'code_browser' => [
                'name' => 'code_browser',
                'path' => '/www/programing/core_node',
                'description' => 'Code browsing directory',
                'accessible' => true
            ]
        ];

        return $this->success(['paths' => $paths], 'Path mappings retrieved successfully');
    }

    /**
     * Get specific path mapping by name
     */
    public function getPathMapping(string $name): JsonResponse
    {
        $pathMappings = [
            'static_resources' => [
                'name' => 'static_resources',
                'path' => '/www/wwwroot/laravel_db/static',
                'description' => 'Static resources directory for media files',
                'accessible' => true
            ],
            'code_browser' => [
                'name' => 'code_browser',
                'path' => '/www/programing/core_node',
                'description' => 'Code browsing directory',
                'accessible' => true
            ]
        ];

        if (!isset($pathMappings[$name])) {
            return $this->notFound("Path mapping '{$name}' not found");
        }

        return $this->success($pathMappings[$name], 'Path mapping retrieved successfully');
    }
}
