<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\ServerManagerV1;

use App\Apps\ServerManagerV1\ServerManagerV1Gvar\ServerManagerV1Constants;
use App\Http\Common\CommonGvar;

/**
 * ServerManagerV1ApiInfo Class
 * 
 * STANDARD FEATURE FORMAT SPECIFICATION - MUST FOLLOW CommonApiInfo.php
 * 
 * Format: auth_type/method|description|controller|params:param_list|headers:header_list|response:response_list|tags:tag_list
 * 
 * This class MUST use the same feature format as defined in CommonApiInfo.php
 * All feature strings must include examples in parameter definitions for automatic test generation
 * 
 * Parameter format: param_name(type,requirement,example)
 * Response format: field_name(type,description)
 * Tags: server, system, files, nginx, deploy, ssl, security
 */
class ServerManagerV1ApiInfo
{
    /**
     * Get API information for ServerManagerV1 app
     *
     * @return array
     */
    public static function getApiInfo(): array
    {
        $baseUrl = url('/api');
        $apiPrefix = $baseUrl . '/servermanager/v1';

        return [
            'app_name' => 'ServerManagerV1',
            'api_version' => 'v1',
            'app_description' => 'Comprehensive server management and administration system',
            'base_url' => $baseUrl,
            'api_prefix' => $apiPrefix,
            'endpoints' => self::getEndpoints(),
            'cli_commands' => self::getCliCommands(),
            'supported_headers' => self::getSupportedHeaders(),
            'authentication' => self::getAuthenticationInfo()
        ];
    }

    /**
     * Get all API endpoints with standard feature format
     *
     * @return array
     */
    private static function getEndpoints(): array
    {
        $baseUrl = url('/api');
        $apiPrefix = $baseUrl . '/servermanager/v1';

        return [
            // API Information
            [
                'path' => $apiPrefix . '/info',
                'feature' => 'auth_required/GET|Get comprehensive API information and documentation|ServerManagerV1ApiInfoCtl|response:application(object,App info),authentication(object,Auth info),endpoints(object,All endpoints)|tags:server,info'
            ],

            // System Information APIs
            [
                'path' => $apiPrefix . '/system/info',
                'feature' => 'auth_required/GET|Get complete system information including hardware and OS details|ServerManagerV1SystemInfoCtl|response:system(object,System details),hardware(object,Hardware info),services(array,Service status)|tags:server,system'
            ],
            [
                'path' => $apiPrefix . '/system/processes',
                'feature' => 'auth_required/GET|Get list of running system processes|ServerManagerV1SystemInfoCtl|response:processes(array,Process list),total_count(int,Total processes)|tags:server,system'
            ],
            [
                'path' => $apiPrefix . '/system/services',
                'feature' => 'auth_required/GET|Get status of system services|ServerManagerV1SystemInfoCtl|response:services(array,Service status list),active_count(int,Active services)|tags:server,system'
            ],
            [
                'path' => $apiPrefix . '/system/permissions',
                'feature' => 'auth_required/GET|Check directory permissions for important system directories|ServerManagerV1SystemInfoCtl|response:permissions(object,Directory permissions),issues(array,Permission issues)|tags:server,system,security'
            ],
            [
                'path' => $apiPrefix . '/system/storage',
                'feature' => 'auth_required/GET|Get storage analysis and disk usage information|ServerManagerV1SystemInfoCtl|response:storage(object,Storage info),usage(object,Disk usage),free_space(string,Available space)|tags:server,system'
            ],

            // File Management APIs
            [
                'path' => $apiPrefix . '/files/browse',
                'feature' => 'auth_required/GET|Browse server filesystem with security restrictions|ServerManagerV1FileManagerCtl|params:path(string,optional,/var/www)|response:files(array,File list),directories(array,Directory list),current_path(string,Current path)|tags:server,files'
            ],
            [
                'path' => $apiPrefix . '/files/download',
                'feature' => 'auth_required/GET|Download files from server with security validation|ServerManagerV1FileManagerCtl|params:file_path(string,required,/var/log/nginx/access.log)|response:file_content(binary,File data)|tags:server,files'
            ],
            [
                'path' => $apiPrefix . '/files/info',
                'feature' => 'auth_required/GET|Get detailed file information and metadata|ServerManagerV1FileManagerCtl|params:file_path(string,required,/etc/nginx/nginx.conf)|response:file_info(object,File details),size(int,File size),permissions(string,File permissions)|tags:server,files'
            ],
            [
                'path' => $apiPrefix . '/files/preview',
                'feature' => 'auth_required/GET|Preview text files with syntax highlighting|ServerManagerV1FileManagerCtl|params:file_path(string,required,/etc/hosts),lines(int,optional,100)|response:content(string,File content),type(string,File type)|tags:server,files'
            ],

            // Code Execution APIs
            [
                'path' => $apiPrefix . '/executor/scripts',
                'feature' => 'auth_required/GET|List all available predefined scripts for execution|ServerManagerV1CodeExecutorCtl|response:scripts(array,Script list),categories(array,Script categories)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/executor/run',
                'feature' => 'auth_required/POST|Execute predefined script by ID with parameters|ServerManagerV1CodeExecutorCtl|params:script_id(string,required,system_update),parameters(object,optional,{})|response:execution_id(string,Execution ID),status(string,Execution status),output(string,Script output)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/executor/logs',
                'feature' => 'auth_required/GET|Get execution logs and history|ServerManagerV1CodeExecutorCtl|params:limit(int,optional,50),offset(int,optional,0)|response:logs(array,Execution logs),total_count(int,Total logs)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/executor/status',
                'feature' => 'auth_required/GET|Get execution status for specific execution ID|ServerManagerV1CodeExecutorCtl|params:execution_id(string,required,exec_123456)|response:status(string,Current status),progress(int,Progress percentage),output(string,Current output)|tags:server,deploy'
            ],

            // Nginx Management APIs
            [
                'path' => $apiPrefix . '/nginx/sites',
                'feature' => 'auth_required/GET|List all nginx sites and their configurations|ServerManagerV1NginxManagerCtl@listSites|response:sites(array,Site list),enabled_count(int,Enabled sites),total_count(int,Total sites)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/sites',
                'feature' => 'auth_required/POST|Create new nginx site configuration|ServerManagerV1NginxManagerCtl@createSite|params:site_name(string,required,example.com),domain(string,required,example.com),site_type(string,optional,laravel),config(object,optional,{})|response:site_name(string,Site name),domain(string,Domain name),config_file(string,Config file path)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/sites/{site_name}',
                'feature' => 'auth_required/PUT|Update existing nginx site configuration|ServerManagerV1NginxManagerCtl@updateSite|params:site_name(string,required,example.com),site_config(string,required,nginx config content)|response:site_name(string,Site name),updated(boolean,Update status)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/sites/{site_name}',
                'feature' => 'auth_required/DELETE|Delete nginx site and configuration|ServerManagerV1NginxManagerCtl@deleteSite|params:site_name(string,required,example.com)|response:site_name(string,Site name),deleted(boolean,Deletion status)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/config',
                'feature' => 'auth_required/GET|Get nginx site configuration content|ServerManagerV1NginxManagerCtl@getSiteConfig|params:site_name(string,required,example.com)|response:content(string,Config content),parsed_info(object,Parsed configuration)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/enable',
                'feature' => 'auth_required/POST|Enable nginx site by creating symlink|ServerManagerV1NginxManagerCtl@enableSite|params:site_name(string,required,example.com)|response:enabled(boolean,Enable status),enabled_file(string,Symlink path)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/disable',
                'feature' => 'auth_required/POST|Disable nginx site by removing symlink|ServerManagerV1NginxManagerCtl@disableSite|params:site_name(string,required,example.com)|response:enabled(boolean,Disable status)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/test',
                'feature' => 'auth_required/POST|Test nginx configuration syntax validity|ServerManagerV1NginxManagerCtl@testConfig|response:valid(boolean,Config validity),output(string,Test output),error(string,Error message)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/reload',
                'feature' => 'auth_required/POST|Reload nginx configuration without restart|ServerManagerV1NginxManagerCtl@reloadNginx|response:reloaded(boolean,Reload status),output(string,Command output)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/status',
                'feature' => 'auth_required/GET|Get nginx overview: installed, version, running state, config test, site counts|ServerManagerV1NginxManagerCtl@statusOverview|response:installed(boolean,Nginx installed),version(string,Nginx version),running(boolean,Running state),process_count(int,Process count),config_test(object,Config test result),sites(object,Site counts),install_hint(string,Install hint when missing)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/service',
                'feature' => 'auth_required/POST|Control the nginx service (start/stop/restart/reload/status)|ServerManagerV1NginxManagerCtl@serviceControl|params:action(string,required,start)|response:action(string,Executed action),executed_via(string,systemctl or service),success(boolean,Action result),output(string,Command output)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/logs',
                'feature' => 'auth_required/GET|Tail nginx access/error logs with optional keyword filter|ServerManagerV1NginxManagerCtl@logs|params:type(string,optional,error),lines(int,optional,200),filter(string,optional,ssl)|response:type(string,Log type),file(string,Log file path),exists(boolean,File exists),lines(array,Log lines),size_bytes(int,File size)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/install',
                'feature' => 'auth_required/POST|Install nginx via the idempotent installer script (long-running)|ServerManagerV1NginxManagerCtl@install|response:installed(boolean,Installed after run),already_installed(boolean,Was already installed),version(string,Detected version),output(string,Installer output tail)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/backups',
                'feature' => 'auth_required/GET|List nginx site config backups|ServerManagerV1NginxManagerCtl@listBackups|params:site(string,optional,example.com)|response:backups(array,Backups with site/type/size/created_at),total(int,Total backups)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/backups/restore',
                'feature' => 'auth_required/POST|Restore a site config backup (current config backed up first; config test with rollback)|ServerManagerV1NginxManagerCtl@restoreBackup|params:file(string,required,example.com_2026-06-12_10-00-00.backup)|response:restored(boolean,Restore result),site(string,Site name),config_test(object,Config test result)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/main-config',
                'feature' => 'auth_required/GET|View nginx.conf and conf.d listing with parsed worker directives (read-only)|ServerManagerV1NginxManagerCtl@mainConfig|response:file(string,Config path),exists(boolean,File exists),content(string,Config content),conf_d(array,conf.d files),parsed(object,Parsed worker directives)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/port-check',
                'feature' => 'auth_required/GET|Check whether a TCP port is in use and by which process|ServerManagerV1NginxManagerCtl@portCheck|params:port(int,required,80)|response:port(int,Checked port),in_use(boolean,Port occupied),holder(string,Holder process),is_nginx(boolean,Held by nginx)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/metrics',
                'feature' => 'auth_required/GET|Get nginx runtime metrics (stub_status plus process CPU/memory)|ServerManagerV1NginxManagerCtl@metrics|response:available(boolean,stub_status available),stub_status(object,Connection and request counters),hint(string,Enable hint when unavailable),processes(array,Process stats),totals(object,Memory and CPU totals)|tags:server,nginx'
            ],
            [
                'path' => $apiPrefix . '/nginx/sites/batch',
                'feature' => 'auth_required/POST|Batch enable/disable/test nginx sites|ServerManagerV1NginxManagerCtl@batchSites|params:action(string,required,enable),sites(array,required,["example.com"])|response:action(string,Executed action),results(array,Per-site results),succeeded(int,Success count),failed(int,Failure count)|tags:server,nginx'
            ],

            // Unified Manager APIs
            [
                'path' => $apiPrefix . '/unified/apps',
                'feature' => 'auth_required/GET|List all applications with service status|ServerManagerV1UnifiedManagerCtl@listApps|response:apps(array,Application list with service status),total_apps(int,Total apps),base_port(int,Base port number)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/status',
                'feature' => 'auth_required/GET|Get detailed application status|ServerManagerV1UnifiedManagerCtl@getAppStatus|params:app_name(string,required,laravel_main),app_type(string,required,polyApp)|response:service_status(object,Service status),service_name(string,Service name),launcher_exists(boolean,Launcher script exists)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/logs',
                'feature' => 'auth_required/GET|Get application logs from systemd and app files|ServerManagerV1UnifiedManagerCtl@getAppLogs|params:app_name(string,required,laravel_main),lines(int,optional,100)|response:logs(array,Log entries),total_lines(int,Total log lines),log_sources(array,Log sources)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/start',
                'feature' => 'auth_required/POST|Start application service|ServerManagerV1UnifiedManagerCtl@startApp|params:app_name(string,required,laravel_dashboard),app_type(string,required,polyApp)|response:service_name(string,Service name),status(object,Updated service status),output(string,Command output)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/stop',
                'feature' => 'auth_required/POST|Stop application service|ServerManagerV1UnifiedManagerCtl@stopApp|params:app_name(string,required,laravel_dashboard),app_type(string,required,polyApp)|response:service_name(string,Service name),status(object,Updated service status),output(string,Command output)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/restart',
                'feature' => 'auth_required/POST|Restart application service|ServerManagerV1UnifiedManagerCtl@restartApp|params:app_name(string,required,laravel_dashboard),app_type(string,required,polyApp)|response:service_name(string,Service name),status(object,Updated service status),output(string,Command output)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/deploy',
                'feature' => 'auth_required/POST|Deploy application using unified manager|ServerManagerV1UnifiedManagerCtl@deployApp|params:app_name(string,required,laravel_main),action(string,required,deploy)|response:deployment_id(string,Deployment ID),success(boolean,Success status),output(string,Command output),execution_time(number,Execution time)|tags:server,deploy'
            ],
            [
                'path' => $apiPrefix . '/unified/octane/restart',
                'feature' => 'auth_required/POST|Restart Octane server (Laravel main API server)|ServerManagerV1UnifiedManagerCtl@restartOctane|response:service_name(string,Service name),output(string,Command output)|tags:server,octane'
            ],
            [
                'path' => $apiPrefix . '/unified/octane/reload',
                'feature' => 'auth_required/POST|Reload Octane server gracefully without downtime|ServerManagerV1UnifiedManagerCtl@reloadOctane|response:service_name(string,Service name),output(string,Command output)|tags:server,octane'
            ],

            // SSL Certificate Management APIs
            [
                'path' => $apiPrefix . '/certificates/',
                'feature' => 'auth_required/GET|List all SSL certificates on server|ServerManagerV1CertificateManagerCtl@listCertificates|response:certificates(array,Certificate list),total_certificates(int,Total count)|tags:server,ssl,certificate'
            ],
            [
                'path' => $apiPrefix . '/certificates/generate',
                'feature' => 'auth_required/POST|Generate new SSL certificate using DNS validation|ServerManagerV1CertificateManagerCtl@generateCertificate|params:domain(string,required,example.com),provider(string,optional,dnspod),staging(boolean,optional,false)|response:domain(string,Domain name),certificate_path(string,Certificate directory),output(string,Certbot output)|tags:server,ssl,certificate'
            ],
            [
                'path' => $apiPrefix . '/certificates/renew',
                'feature' => 'auth_required/POST|Renew SSL certificates|ServerManagerV1CertificateManagerCtl@renewCertificates|params:domain(string,optional,example.com),all(boolean,optional,false)|response:domain(string,Domain name),nginx_reloaded(boolean,Nginx reload status),output(string,Command output)|tags:server,ssl,certificate'
            ],
            [
                'path' => $apiPrefix . '/certificates/status',
                'feature' => 'auth_required/GET|Get SSL certificate status and expiry info|ServerManagerV1CertificateManagerCtl@getCertificateStatus|params:domain(string,required,example.com)|response:expiry_date(string,Expiry date),days_until_expiry(int,Days remaining),status(string,Status),issuer(string,Certificate issuer)|tags:server,ssl,certificate'
            ],
            [
                'path' => $apiPrefix . '/certificates/install-certbot',
                'feature' => 'auth_required/POST|Install certbot and nginx plugin|ServerManagerV1CertificateManagerCtl@installCertbot|response:installed(boolean,Installation status),output(string,Installation output),exit_code(int,Exit code)|tags:server,ssl,certificate'
            ],
            [
                'path' => $apiPrefix . '/certificates/detect-certbot',
                'feature' => 'auth_required/GET|Detect certbot installation and version|ServerManagerV1CertificateManagerCtl@detectCertbot|response:installed(boolean,Installation status),path(string,Certbot path),version(string,Version),nginx_plugin(boolean,Plugin status)|tags:server,ssl,certificate'
            ]
        ];
    }

    /**
     * Get all CLI commands with descriptions and parameters
     *
     * @return array
     */
    private static function getCliCommands(): array
    {
        return [
            // Deploy Command
            [
                'command' => 'servermanager:deploy',
                'description' => 'Deploy domain with nginx configuration and SSL certificate',
                'signature' => 'servermanager:deploy {domain} {type}',
                'arguments' => [
                    'domain' => [
                        'type' => 'string',
                        'required' => true,
                        'description' => 'The domain name to deploy',
                        'example' => 'example.com'
                    ],
                    'type' => [
                        'type' => 'string',
                        'required' => true,
                        'description' => 'Deployment type',
                        'allowed_values' => ['laravel', 'poly-app', 'ncore-app', 'static', 'proxy'],
                        'example' => 'laravel'
                    ]
                ],
                'options' => [
                    '--app-name' => [
                        'type' => 'string',
                        'description' => 'Application name for poly/ncore apps',
                        'example' => 'laravel_main'
                    ],
                    '--www-dir' => [
                        'type' => 'string',
                        'description' => 'Custom web directory',
                        'example' => '/www/wwwroot/example.com'
                    ],
                    '--php-version' => [
                        'type' => 'string',
                        'description' => 'PHP version (default from config)',
                        'example' => '8.2'
                    ],
                    '--proxy-target' => [
                        'type' => 'string',
                        'description' => 'Proxy target URL',
                        'example' => 'http://localhost:3000'
                    ],
                    '--no-ssl' => [
                        'type' => 'boolean',
                        'description' => 'Skip SSL certificate generation'
                    ],
                    '--force' => [
                        'type' => 'boolean',
                        'description' => 'Force update existing configuration'
                    ],
                    '--dry-run' => [
                        'type' => 'boolean',
                        'description' => 'Show what would be done without executing'
                    ]
                ],
                'usage_examples' => [
                    'php artisan servermanager:deploy example.com laravel',
                    'php artisan servermanager:deploy api.example.com proxy --proxy-target=http://localhost:3000',
                    'php artisan servermanager:deploy app.example.com poly-app --app-name=laravel_main',
                    'php artisan servermanager:deploy example.com laravel --dry-run'
                ],
                'tags' => ['deploy', 'nginx', 'ssl']
            ],

            // SSL Command
            [
                'command' => 'servermanager:ssl',
                'description' => 'Manage SSL certificates for domains',
                'signature' => 'servermanager:ssl {action} {domain?}',
                'arguments' => [
                    'action' => [
                        'type' => 'string',
                        'required' => true,
                        'description' => 'SSL action to perform',
                        'allowed_values' => ['generate', 'renew', 'list', 'info', 'remove'],
                        'example' => 'generate'
                    ],
                    'domain' => [
                        'type' => 'string',
                        'required' => false,
                        'description' => 'Domain name (required for generate/renew/info/remove)',
                        'example' => 'example.com'
                    ]
                ],
                'options' => [
                    '--provider' => [
                        'type' => 'string',
                        'description' => 'SSL provider (letsencrypt, dnspod, cloudflare)',
                        'example' => 'letsencrypt'
                    ],
                    '--email' => [
                        'type' => 'string',
                        'description' => 'Email for SSL certificate',
                        'example' => 'admin@example.com'
                    ],
                    '--staging' => [
                        'type' => 'boolean',
                        'description' => 'Use staging environment for testing'
                    ],
                    '--force' => [
                        'type' => 'boolean',
                        'description' => 'Force certificate regeneration'
                    ]
                ],
                'usage_examples' => [
                    'php artisan servermanager:ssl generate example.com',
                    'php artisan servermanager:ssl list',
                    'php artisan servermanager:ssl renew example.com',
                    'php artisan servermanager:ssl info example.com'
                ],
                'tags' => ['ssl', 'certificate', 'security']
            ],

            // Certificate Command
            [
                'command' => 'servermanager:certificate',
                'description' => 'Advanced SSL certificate management operations',
                'signature' => 'servermanager:certificate {action}',
                'arguments' => [
                    'action' => [
                        'type' => 'string',
                        'required' => true,
                        'description' => 'Certificate action',
                        'allowed_values' => ['check', 'renew-all', 'cleanup', 'verify'],
                        'example' => 'check'
                    ]
                ],
                'options' => [
                    '--domain' => [
                        'type' => 'string',
                        'description' => 'Specific domain to operate on',
                        'example' => 'example.com'
                    ],
                    '--days' => [
                        'type' => 'integer',
                        'description' => 'Days before expiration for renewal check',
                        'example' => '30'
                    ]
                ],
                'usage_examples' => [
                    'php artisan servermanager:certificate check',
                    'php artisan servermanager:certificate renew-all',
                    'php artisan servermanager:certificate verify --domain=example.com'
                ],
                'tags' => ['ssl', 'certificate', 'maintenance']
            ],

            // Website Command
            [
                'command' => 'servermanager:website',
                'description' => 'Manage nginx website configurations',
                'signature' => 'servermanager:website {action} {site?}',
                'arguments' => [
                    'action' => [
                        'type' => 'string',
                        'required' => true,
                        'description' => 'Website action',
                        'allowed_values' => ['list', 'enable', 'disable', 'remove', 'test', 'reload'],
                        'example' => 'list'
                    ],
                    'site' => [
                        'type' => 'string',
                        'required' => false,
                        'description' => 'Site name (required for enable/disable/remove)',
                        'example' => 'example.com'
                    ]
                ],
                'options' => [
                    '--force' => [
                        'type' => 'boolean',
                        'description' => 'Force operation without confirmation'
                    ]
                ],
                'usage_examples' => [
                    'php artisan servermanager:website list',
                    'php artisan servermanager:website enable example.com',
                    'php artisan servermanager:website disable example.com',
                    'php artisan servermanager:website test',
                    'php artisan servermanager:website reload'
                ],
                'tags' => ['nginx', 'website', 'configuration']
            ],

            // Sync Command
            [
                'command' => 'servermanager:sync',
                'description' => 'Synchronize configurations and data',
                'signature' => 'servermanager:sync {type}',
                'arguments' => [
                    'type' => [
                        'type' => 'string',
                        'required' => true,
                        'description' => 'Sync type',
                        'allowed_values' => ['config', 'certificates', 'all'],
                        'example' => 'config'
                    ]
                ],
                'options' => [
                    '--target' => [
                        'type' => 'string',
                        'description' => 'Target server or path',
                        'example' => 'backup-server'
                    ]
                ],
                'usage_examples' => [
                    'php artisan servermanager:sync config',
                    'php artisan servermanager:sync certificates',
                    'php artisan servermanager:sync all'
                ],
                'tags' => ['sync', 'backup', 'configuration']
            ]
        ];
    }

    /**
     * Get supported headers for authentication and requests
     *
     * @return array
     */
    private static function getSupportedHeaders(): array
    {
        return [
            'X-Server-Manager-Key' => [
                'description' => 'API key for server management authentication',
                'type' => 'string',
                'required_for' => 'All authenticated endpoints (bypassed in debug/local mode)',
                'example' => 'sm-api-key-2025-secure-production-key',
                'note' => 'Authentication is bypassed when APP_ENV=local or APP_DEBUG=true'
            ],
            'Content-Type' => [
                'description' => 'Request content type',
                'type' => 'string',
                'required_for' => 'POST requests',
                'example' => 'application/json'
            ],
            'Accept' => [
                'description' => 'Response content type',
                'type' => 'string',
                'required_for' => 'All requests',
                'example' => 'application/json'
            ]
        ];
    }

    /**
     * Get authentication information
     *
     * @return array
     */
    private static function getAuthenticationInfo(): array
    {
        return [
            'type' => 'api_key',
            'description' => 'Uses API key authentication via X-Server-Manager-Key header',
            'header_name' => 'X-Server-Manager-Key',
            'security_note' => 'All operations are logged and monitored for security'
        ];
    }
}
