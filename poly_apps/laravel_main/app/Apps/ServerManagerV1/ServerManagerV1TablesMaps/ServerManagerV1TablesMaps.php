<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1TablesMaps;

use App\Providers\TableMaps;

class ServerManagerV1TablesMaps extends TableMaps
{
    // Nginx Sites Table
    public const servermanagerv1_NGINX_SITES_TABLE = [
        'tablename' => 'nginx_sites',
        'fields' => [
            'id' => 'id',
            'site_name' => 'site_name',
            'domain' => 'domain',
            'site_type' => 'site_type',
            'document_root' => 'document_root',
            'php_version' => 'php_version',
            'ssl_enabled' => 'ssl_enabled',
            'ssl_cert_path' => 'ssl_cert_path',
            'ssl_key_path' => 'ssl_key_path',
            'proxy_pass' => 'proxy_pass',
            'config_content' => 'config_content',
            'is_enabled' => 'is_enabled',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    // Execution Logs Table
    public const servermanagerv1_EXECUTION_LOGS_TABLE = [
        'tablename' => 'execution_logs',
        'fields' => [
            'id' => 'id',
            'script_id' => 'script_id',
            'script_name' => 'script_name',
            'script_category' => 'script_category',
            'command' => 'command',
            'arguments' => 'arguments',
            'output' => 'output',
            'error_output' => 'error_output',
            'exit_code' => 'exit_code',
            'execution_time' => 'execution_time',
            'memory_usage' => 'memory_usage',
            'user_ip' => 'user_ip',
            'user_agent' => 'user_agent',
            'started_at' => 'started_at',
            'completed_at' => 'completed_at',
            'created_at' => 'created_at'
        ]
    ];

    // SSL Certificates Table
    public const servermanagerv1_CERTIFICATES_TABLE = [
        'tablename' => 'certificates',
        'fields' => [
            'id' => 'id',
            'domain' => 'domain',
            'certificate_path' => 'certificate_path',
            'private_key_path' => 'private_key_path',
            'chain_path' => 'chain_path',
            'issuer' => 'issuer',
            'issued_at' => 'issued_at',
            'expires_at' => 'expires_at',
            'auto_renew' => 'auto_renew',
            'last_renewed_at' => 'last_renewed_at',
            'renewal_attempts' => 'renewal_attempts',
            'status' => 'status',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    // System Snapshots Table
    public const servermanagerv1_SYSTEM_SNAPSHOTS_TABLE = [
        'tablename' => 'system_snapshots',
        'fields' => [
            'id' => 'id',
            'snapshot_type' => 'snapshot_type',
            'cpu_usage' => 'cpu_usage',
            'memory_total' => 'memory_total',
            'memory_used' => 'memory_used',
            'memory_free' => 'memory_free',
            'disk_total' => 'disk_total',
            'disk_used' => 'disk_used',
            'disk_free' => 'disk_free',
            'load_average' => 'load_average',
            'process_count' => 'process_count',
            'network_info' => 'network_info',
            'service_status' => 'service_status',
            'created_at' => 'created_at'
        ]
    ];

    // File Access Logs Table
    public const servermanagerv1_FILE_ACCESS_LOGS_TABLE = [
        'tablename' => 'file_access_logs',
        'fields' => [
            'id' => 'id',
            'action' => 'action',
            'file_path' => 'file_path',
            'file_size' => 'file_size',
            'file_type' => 'file_type',
            'user_ip' => 'user_ip',
            'user_agent' => 'user_agent',
            'success' => 'success',
            'error_message' => 'error_message',
            'created_at' => 'created_at'
        ]
    ];

    // Predefined Scripts Table
    public const servermanagerv1_PREDEFINED_SCRIPTS_TABLE = [
        'tablename' => 'predefined_scripts',
        'fields' => [
            'id' => 'id',
            'script_name' => 'script_name',
            'script_category' => 'script_category',
            'description' => 'description',
            'command' => 'command',
            'arguments' => 'arguments',
            'working_directory' => 'working_directory',
            'timeout' => 'timeout',
            'requires_sudo' => 'requires_sudo',
            'is_enabled' => 'is_enabled',
            'created_at' => 'created_at',
            'updated_at' => 'updated_at'
        ]
    ];

    /**
     * Hardcoded to preserve the existing servermanagerv1_* table names; the
     * app_registry prefix for this app (server_manager_v1) does not match the
     * tables already created.
     */
    protected static function getTablePrefix(): string
    {
        return 'servermanagerv1';
    }

    public static function getAvailableTableKeys(): array
    {
        $prefix = static::getTablePrefix();
        return [
            "{$prefix}_NGINX_SITES_TABLE",
            "{$prefix}_EXECUTION_LOGS_TABLE",
            "{$prefix}_CERTIFICATES_TABLE",
            "{$prefix}_SYSTEM_SNAPSHOTS_TABLE",
            "{$prefix}_FILE_ACCESS_LOGS_TABLE",
            "{$prefix}_PREDEFINED_SCRIPTS_TABLE",
        ];
    }

    // Helper methods to get table names
    public static function getNginxSitesTable(): string
    {
        return static::getTableName('NGINX_SITES_TABLE');
    }

    public static function getExecutionLogsTable(): string
    {
        return static::getTableName('EXECUTION_LOGS_TABLE');
    }

    public static function getCertificatesTable(): string
    {
        return static::getTableName('CERTIFICATES_TABLE');
    }

    public static function getSystemSnapshotsTable(): string
    {
        return static::getTableName('SYSTEM_SNAPSHOTS_TABLE');
    }

    public static function getFileAccessLogsTable(): string
    {
        return static::getTableName('FILE_ACCESS_LOGS_TABLE');
    }

    public static function getPredefinedScriptsTable(): string
    {
        return static::getTableName('PREDEFINED_SCRIPTS_TABLE');
    }

    // Helper methods to get field names
    public static function getNginxSitesFields(): array
    {
        return static::getTableFields('NGINX_SITES_TABLE');
    }

    public static function getExecutionLogsFields(): array
    {
        return static::getTableFields('EXECUTION_LOGS_TABLE');
    }

    public static function getCertificatesFields(): array
    {
        return static::getTableFields('CERTIFICATES_TABLE');
    }

    public static function getSystemSnapshotsFields(): array
    {
        return static::getTableFields('SYSTEM_SNAPSHOTS_TABLE');
    }

    public static function getFileAccessLogsFields(): array
    {
        return static::getTableFields('FILE_ACCESS_LOGS_TABLE');
    }

    public static function getPredefinedScriptsFields(): array
    {
        return static::getTableFields('PREDEFINED_SCRIPTS_TABLE');
    }
}
