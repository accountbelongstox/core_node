<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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

        return response()->json($details);
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
     * @return array|string
     */
    private static function loadAppApiInfo(string $appName): array|string
    {
        try {
            $apiInfoClass = "\\App\\Apps\\{$appName}\\{$appName}ApiInfo";
            
            if (class_exists($apiInfoClass)) {
                $apiInfoInstance = new $apiInfoClass();
                
                if (method_exists($apiInfoInstance, 'getDetails')) {
                    return $apiInfoInstance->getDetails();
                } elseif (method_exists($apiInfoClass, 'getApiInfo')) {
                    return $apiInfoClass::getApiInfo();
                }
            }
            
            return "API information class not found for {$appName}";
        } catch (\Exception $e) {
            return "Error loading API information for {$appName}: " . $e->getMessage();
        }
    }

    /**
     * Load Common API information
     * 
     * @return array|string
     */
    private static function loadCommonApiInfo(): array|string
    {
        try {
            $commonApiInfoClass = "\\App\\Http\\EnvironmentApiInfo\\CommonApiInfo";
            
            if (class_exists($commonApiInfoClass)) {
                $commonApiInfoInstance = new $commonApiInfoClass();
                
                if (method_exists($commonApiInfoInstance, 'getDetails')) {
                    return $commonApiInfoInstance->getDetails();
                }
            }
            
            return "Common API information class not found";
        } catch (\Exception $e) {
            return "Error loading Common API information: " . $e->getMessage();
        }
    }
}