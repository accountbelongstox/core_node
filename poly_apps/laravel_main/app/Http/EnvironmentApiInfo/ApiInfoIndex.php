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

class ApiInfoIndex
{
    /**
     * The main entry point called by the route.
     * It scans its own directory for other service classes, collects their data,
     * and gathers API info from apps.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public static function index(Request $request)
    {
        $publicInfo = self::gatherPublicInfo();
        $apiInfo = self::gatherAppApiInfo($request);
        $details = [
            'public_info' => $publicInfo,
            'api_reference' => $apiInfo,
        ];

        $payload = json_encode($details);
        $etag = '"' . md5($payload) . '"';
        $cacheControl = 'public, max-age=300, stale-while-revalidate=600';
        $ifNoneMatch = trim((string) $request->headers->get('If-None-Match'));

        // Body shape is unchanged; only HTTP caching metadata is added so the
        // dashboard client cache becomes effective and stops constant refetch.
        if ($ifNoneMatch !== '' && $ifNoneMatch === $etag) {
            return response('', 304)
                ->header('ETag', $etag)
                ->header('Cache-Control', $cacheControl);
        }

        return response($payload, 200)
            ->header('Content-Type', 'application/json')
            ->header('ETag', $etag)
            ->header('Cache-Control', $cacheControl);
    }

    /**
     * Scans the current directory for other classes and collects their details.
     *
     * @return array
     */
    private static function gatherPublicInfo(): array
    {
        $info = [];
        $files = File::files(__DIR__);

        foreach ($files as $file) {
            $className = $file->getFilenameWithoutExtension();
            $classNamespace = __NAMESPACE__ . '\\' . $className;

            if ($className === 'ApiInfoIndex' || $className === 'Index' || !class_exists($classNamespace)) {
                continue;
            }

            $instance = new $classNamespace();
            if (method_exists($instance, 'getDetails')) {
                $info[$className] = $instance->getDetails();
            }
        }

        return $info;
    }

    /**
     * Gathers API information from specific apps, if requested.
     * 
     * @param Request $request
     * @return array
     */
    private static function gatherAppApiInfo(Request $request): array
    {
        $apiInfo = [];
        $appName = $request->input('app');
        $availableApps = self::getAvailableApps();
        
        // Add Common APIs as a special app
        $availableApps[] = 'Common';

        if ($appName && in_array($appName, $availableApps)) {
            if ($appName === 'Common') {
                $apiInfo[$appName] = self::loadCommonApiInfo();
            } else {
                $apiInfo[$appName] = self::loadAppApiInfo($appName);
            }
        } else {
            // Load all apps API information including Common APIs
            foreach ($availableApps as $app) {
                if ($app === 'Common') {
                    $apiInfo[$app] = self::loadCommonApiInfo();
                } else {
                    $apiInfo[$app] = self::loadAppApiInfo($app);
                }
            }
        }

        return $apiInfo;
    }

    /**
     * Get list of available apps by scanning the Apps directory
     * 
     * @return array
     */
    private static function getAvailableApps(): array
    {
        $appsPath = app_path('Apps');
        $availableApps = [];

        if (File::isDirectory($appsPath)) {
            $appDirectories = File::directories($appsPath);
            
            foreach ($appDirectories as $appDir) {
                $appName = basename($appDir);
                $apiInfoFile = $appDir . DIRECTORY_SEPARATOR . $appName . 'ApiInfo.php';
                
                if (File::exists($apiInfoFile)) {
                    $availableApps[] = $appName;
                }
            }
        }

        return $availableApps;
    }

    /**
     * Load API information for a specific app
     *
     * @param string $appName
     * @return array
     */
    private static function loadAppApiInfo(string $appName): array
    {
        $apiInfoClass = "\\App\\Apps\\{$appName}\\{$appName}ApiInfo";

        try {
            if (class_exists($apiInfoClass)) {
                if (method_exists($apiInfoClass, 'getDetails')) {
                    return self::normalizeAppInfo((new $apiInfoClass())->getDetails(), $appName);
                }
                if (method_exists($apiInfoClass, 'getApiInfo')) {
                    return self::normalizeAppInfo($apiInfoClass::getApiInfo(), $appName);
                }
                if (method_exists($apiInfoClass, 'getInfo')) {
                    return self::normalizeAppInfo($apiInfoClass::getInfo(), $appName);
                }
            }

            return self::normalizeAppInfo("API information class not found for {$appName}", $appName);
        } catch (\Throwable $e) {
            return self::normalizeAppInfo("Error loading API information for {$appName}: {$e->getMessage()}", $appName);
        }
    }

    /**
     * Load Common API information
     *
     * @return array
     */
    private static function loadCommonApiInfo(): array
    {
        try {
            $commonApiInfoClass = "\\App\\Http\\EnvironmentApiInfo\\CommonApiInfo";

            if (class_exists($commonApiInfoClass) && method_exists($commonApiInfoClass, 'getDetails')) {
                return self::normalizeAppInfo((new $commonApiInfoClass())->getDetails(), 'Common');
            }

            return self::normalizeAppInfo("Common API information class not found", 'Common');
        } catch (\Throwable $e) {
            return self::normalizeAppInfo("Error loading Common API information: {$e->getMessage()}", 'Common');
        }
    }

    /**
     * Normalize any app info payload into the client contract shape.
     *
     * Contract: app info is always an array containing a sequential list of
     * endpoint arrays and a supported_headers map, so clients never receive
     * raw error strings or associative endpoint maps.
     *
     * @param mixed $info
     * @param string $appName
     * @return array
     */
    private static function normalizeAppInfo(mixed $info, string $appName): array
    {
        if (!is_array($info)) {
            return [
                'app_name' => $appName,
                'endpoints' => [],
                'supported_headers' => [],
                'error' => is_string($info) ? $info : 'Invalid API information payload',
            ];
        }

        if (!is_string($info['app_name'] ?? null) || $info['app_name'] === '') {
            $info['app_name'] = $appName;
        }
        $info['endpoints'] = self::normalizeEndpointList($info['endpoints'] ?? []);
        $info['supported_headers'] = is_array($info['supported_headers'] ?? null) ? $info['supported_headers'] : [];

        return $info;
    }

    /**
     * Normalize endpoints into a sequential list of endpoint arrays.
     *
     * Accepts both sequential lists and associative maps keyed by endpoint
     * name; non-array entries are dropped.
     *
     * @param mixed $endpoints
     * @return array
     */
    private static function normalizeEndpointList(mixed $endpoints): array
    {
        if (!is_array($endpoints)) {
            return [];
        }

        $normalized = [];
        foreach ($endpoints as $endpoint) {
            if (is_array($endpoint)) {
                $normalized[] = $endpoint;
            }
        }

        return $normalized;
    }
}