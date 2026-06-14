<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###


namespace App\Http\EnvironmentApiInfo;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class ApiParamsCache
{
    private static function getCacheDir(): string
    {
        $cacheDir = storage_path('app/api_params_cache');
        if (!File::isDirectory($cacheDir)) {
            File::makeDirectory($cacheDir, 0755, true);
        }
        return $cacheDir;
    }

    private static function getCacheFilePath(string $appName, string $apiEndpoint): string
    {
        $fileName = md5($appName . '_' . $apiEndpoint) . '.json';
        return self::getCacheDir() . DIRECTORY_SEPARATOR . $fileName;
    }

    /**
     * Save API parameters to cache
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public static function save(Request $request)
    {
        try {
            $appName = $request->input('app_name');
            $apiEndpoint = $request->input('api_endpoint');
            $params = $request->input('params');
            $method = $request->input('method', 'GET');
            
            if (!$appName || !$apiEndpoint) {
                return response()->json([
                    'success' => false,
                    'message' => 'App name and API endpoint are required'
                ], 400);
            }

            $cacheData = [
                'app_name' => $appName,
                'api_endpoint' => $apiEndpoint,
                'method' => $method,
                'params' => $params,
                'updated_at' => now()->toISOString()
            ];

            $filePath = self::getCacheFilePath($appName, $apiEndpoint);
            File::put($filePath, json_encode($cacheData, JSON_PRETTY_PRINT));

            return response()->json([
                'success' => true,
                'message' => 'Parameters saved successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to save API parameters: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save parameters'
            ], 500);
        }
    }

    /**
     * Load API parameters from cache
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public static function load(Request $request)
    {
        try {
            $appName = $request->input('app_name');
            $apiEndpoint = $request->input('api_endpoint');
            
            if (!$appName || !$apiEndpoint) {
                return response()->json([
                    'success' => false,
                    'message' => 'App name and API endpoint are required'
                ], 400);
            }

            $filePath = self::getCacheFilePath($appName, $apiEndpoint);
            
            if (!File::exists($filePath)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No cached parameters found'
                ], 404);
            }

            $cacheData = json_decode(File::get($filePath), true);
            
            return response()->json([
                'success' => true,
                'data' => $cacheData
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to load API parameters: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to load parameters'
            ], 500);
        }
    }

    /**
     * Get all cached parameters for an app
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public static function listByApp(Request $request)
    {
        try {
            $appName = $request->input('app_name');
            
            if (!$appName) {
                return response()->json([
                    'success' => false,
                    'message' => 'App name is required'
                ], 400);
            }

            $cacheDir = self::getCacheDir();
            $files = File::files($cacheDir);
            $appCaches = [];

            foreach ($files as $file) {
                $content = json_decode(File::get($file->getPathname()), true);
                if ($content && isset($content['app_name']) && $content['app_name'] === $appName) {
                    $appCaches[] = $content;
                }
            }

            return response()->json([
                'success' => true,
                'data' => $appCaches
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to list API parameters: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to list parameters'
            ], 500);
        }
    }
}