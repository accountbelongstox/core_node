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
        $apiInfo = [
            'application' => [
                'name' => ServerManagerV1Constants::APP_NAME,
                'version' => ServerManagerV1Constants::APP_VERSION,
                'description' => 'Comprehensive server management API for system administration',
                'api_prefix' => ServerManagerV1Constants::API_PREFIX
            ],
            'authentication' => [
                'method' => 'API Key',
                'header' => ServerManagerV1Constants::AUTH_HEADER,
                'description' => 'Include API key in request header for authentication'
            ],
            'rate_limiting' => [
                'requests_per_hour' => ServerManagerV1Constants::RATE_LIMIT_REQUESTS,
                'window_minutes' => ServerManagerV1Constants::RATE_LIMIT_MINUTES
            ],
            'endpoints' => $this->getEndpointsInfo(),
            'security' => $this->getSecurityInfo(),
            'system_info' => $this->getSystemInfo()
        ];
        
        return $this->successResponse($apiInfo, 'API information retrieved successfully');
    }
    
    /**
     * Get all available endpoints
     */
    private function getEndpointsInfo(): array
    {
        return [
            'system_information' => [
                'base_path' => '/api/servermanager/v1/system',
                'endpoints' => [
                    [
                        'method' => 'GET',
                        'path' => '/info',
                        'description' => 'Get complete system information including hardware, OS, and services',
                        'parameters' => [],
                        'response' => 'System information object'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/processes',
                        'description' => 'Get list of running processes',
                        'parameters' => [],
                        'response' => 'Array of process objects'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/services',
                        'description' => 'Get status of system services',
                        'parameters' => [],
                        'response' => 'Service status object'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/permissions',
                        'description' => 'Check directory permissions for important directories',
                        'parameters' => [],
                        'response' => 'Directory permissions object'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/storage',
                        'description' => 'Get storage analysis and disk usage information',
                        'parameters' => [],
                        'response' => 'Storage analysis object'
                    ]
                ]
            ],
            'file_management' => [
                'base_path' => '/api/servermanager/v1/files',
                'status' => 'Active',
                'endpoints' => [
                    [
                        'method' => 'GET',
                        'path' => '/browse',
                        'description' => 'Browse server filesystem (restricted to whitelisted paths)',
                        'parameters' => ['path'],
                        'response' => 'Directory listing'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/download',
                        'description' => 'Download files from server (security restricted)',
                        'parameters' => ['file_path'],
                        'response' => 'File download'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/info',
                        'description' => 'Get file information',
                        'parameters' => ['file_path'],
                        'response' => 'File information object'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/preview',
                        'description' => 'Preview text files',
                        'parameters' => ['file_path'],
                        'response' => 'File content preview'
                    ]
                ]
            ],
            'code_execution' => [
                'base_path' => '/api/servermanager/v1/executor',
                'status' => 'Active',
                'security_note' => 'Only predefined hardcoded scripts can be executed',
                'endpoints' => [
                    [
                        'method' => 'GET',
                        'path' => '/scripts',
                        'description' => 'List available predefined scripts',
                        'parameters' => [],
                        'response' => 'Array of script objects'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/run',
                        'description' => 'Execute predefined script by ID',
                        'parameters' => ['script_id'],
                        'response' => 'Execution result object'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/logs',
                        'description' => 'Get execution logs',
                        'parameters' => ['limit', 'offset'],
                        'response' => 'Array of execution log objects'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/status',
                        'description' => 'Get execution status',
                        'parameters' => ['execution_id'],
                        'response' => 'Execution status object'
                    ]
                ]
            ],
            'nginx_management' => [
                'base_path' => '/api/servermanager/v1/nginx',
                'status' => 'Active',
                'endpoints' => [
                    [
                        'method' => 'GET',
                        'path' => '/sites',
                        'description' => 'List all nginx sites',
                        'parameters' => [],
                        'response' => 'Array of site objects'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/sites',
                        'description' => 'Create new nginx site',
                        'parameters' => ['site_name', 'domain', 'site_type', 'config'],
                        'response' => 'Created site object'
                    ],
                    [
                        'method' => 'PUT',
                        'path' => '/sites/{id}',
                        'description' => 'Update existing site',
                        'parameters' => ['site_config'],
                        'response' => 'Updated site object'
                    ],
                    [
                        'method' => 'DELETE',
                        'path' => '/sites/{id}',
                        'description' => 'Delete site',
                        'parameters' => [],
                        'response' => 'Deletion confirmation'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/reload',
                        'description' => 'Reload nginx configuration',
                        'parameters' => [],
                        'response' => 'Reload result'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/logs',
                        'description' => 'Access nginx logs',
                        'parameters' => ['log_type', 'lines'],
                        'response' => 'Log content'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/validate',
                        'description' => 'Validate nginx configuration',
                        'parameters' => [],
                        'response' => 'Validation result'
                    ]
                ]
            ],
            'unified_manager' => [
                'base_path' => '/api/servermanager/v1/unified',
                'status' => 'Active',
                'description' => 'Integration with unified manager system',
                'endpoints' => [
                    [
                        'method' => 'GET',
                        'path' => '/apps',
                        'description' => 'List applications from registry',
                        'parameters' => [],
                        'response' => 'Array of application objects'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/deploy',
                        'description' => 'Deploy application',
                        'parameters' => ['app_name'],
                        'response' => 'Deployment result'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/build',
                        'description' => 'Build application',
                        'parameters' => ['app_name'],
                        'response' => 'Build result'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/start',
                        'description' => 'Start application service',
                        'parameters' => ['app_name'],
                        'response' => 'Start result'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/stop',
                        'description' => 'Stop application service',
                        'parameters' => ['app_name'],
                        'response' => 'Stop result'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/restart',
                        'description' => 'Restart application service',
                        'parameters' => ['app_name'],
                        'response' => 'Restart result'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/status',
                        'description' => 'Get application status',
                        'parameters' => ['app_name'],
                        'response' => 'Application status object'
                    ]
                ]
            ],
            'ssl_certificates' => [
                'base_path' => '/api/servermanager/v1/certificates',
                'status' => 'Coming Soon',
                'description' => 'SSL certificate management with certbot',
                'endpoints' => [
                    [
                        'method' => 'GET',
                        'path' => '/',
                        'description' => 'List all SSL certificates',
                        'parameters' => [],
                        'response' => 'Array of certificate objects'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/generate',
                        'description' => 'Generate new SSL certificate',
                        'parameters' => ['domain', 'email'],
                        'response' => 'Certificate generation result'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/renew',
                        'description' => 'Renew all certificates',
                        'parameters' => [],
                        'response' => 'Renewal result'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/status',
                        'description' => 'Get certificate status',
                        'parameters' => ['domain'],
                        'response' => 'Certificate status object'
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/install-certbot',
                        'description' => 'Install certbot if not present',
                        'parameters' => [],
                        'response' => 'Installation result'
                    ],
                    [
                        'method' => 'GET',
                        'path' => '/detect-certbot',
                        'description' => 'Detect certbot installation',
                        'parameters' => [],
                        'response' => 'Detection result'
                    ]
                ]
            ]
        ];
    }
    
    /**
     * Get security information
     */
    private function getSecurityInfo(): array
    {
        return [
            'file_access' => [
                'security_model' => 'Hardcoded path whitelist',
                'allowed_paths' => ServerManagerV1Constants::ALLOWED_DOWNLOAD_PATHS,
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
