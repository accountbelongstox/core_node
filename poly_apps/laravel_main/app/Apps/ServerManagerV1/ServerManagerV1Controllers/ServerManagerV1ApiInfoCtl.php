<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Controllers;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ServerManagerV1ApiInfoCtl extends ServerManagerV1BaseCtl
{
    /**
     * Get API information and documentation
     */
    public function getApiInfo(Request $request): JsonResponse
    {
        $validation = $this->validateRequest($request, 'api_info');

        if ($validation) {
            return $validation;
        }

        $fullApiInfo = \App\Apps\ServerManagerV1\ServerManagerV1ApiInfo::getApiInfo();

        $apiInfo = [
            'application' => [
                'name' => $fullApiInfo['app_name'],
                'version' => $fullApiInfo['api_version'],
                'description' => $fullApiInfo['app_description'],
                'base_url' => $fullApiInfo['base_url'],
                'api_prefix' => $fullApiInfo['api_prefix']
            ],
            'authentication' => $fullApiInfo['authentication'],
            'supported_headers' => $fullApiInfo['supported_headers'],
            'endpoints' => $fullApiInfo['endpoints'],
            'cli_commands' => $fullApiInfo['cli_commands'],
            'security' => $this->getSecurityInfo(),
            'system_info' => $this->getSystemInfo()
        ];

        return $this->success($apiInfo, 'API information retrieved successfully');
    }
    
    
    /**
     * Get security information
     */
    private function getSecurityInfo(): array
    {
        return [
            'file_access' => [
                'security_model' => 'Hardcoded path whitelist',
                'allowed_paths' => ServerManagerV1Constants::getAllowedDownloadPaths(),
                'max_file_size' => ServerManagerV1Constants::MAX_FILE_DOWNLOAD_SIZE,
                'allowed_preview_extensions' => ServerManagerV1Constants::ALLOWED_PREVIEW_EXTENSIONS
            ],
            'code_execution' => [
                'security_model' => 'Predefined scripts only',
                'dynamic_execution' => false,
                'parameter_injection' => false,
                'max_execution_time' => ServerManagerV1Constants::MAX_EXECUTION_TIME,
                'script_categories' => ServerManagerV1Constants::SCRIPT_CATEGORIES
            ],
            'authentication' => [
                'method' => 'API Key',
                'header_name' => ServerManagerV1Constants::AUTH_HEADER,
                'session_timeout' => ServerManagerV1Constants::SESSION_TIMEOUT
            ],
            'logging' => [
                'all_requests_logged' => true,
                'file_access_logged' => true,
                'execution_logged' => true,
                'max_log_entries' => ServerManagerV1Constants::MAX_LOG_ENTRIES
            ]
        ];
    }
    
    /**
     * Get basic system information for API info
     */
    private function getSystemInfo(): array
    {
        return [
            'server_time' => now()->toISOString(),
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'application_environment' => config('app.env'),
            'debug_mode' => config('app.debug'),
            'timezone' => config('app.timezone')
        ];
    }
}
