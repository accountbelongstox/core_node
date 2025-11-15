<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1TablesMaps;

class ServerManagerV1TablesMaps
{
    // Nginx Sites Table
    public const NGINX_SITES_TABLE = [
        'table_name' => 'servermanagerv1_nginx_sites',
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
    public const EXECUTION_LOGS_TABLE = [
        'table_name' => 'servermanagerv1_execution_logs',
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
    public const CERTIFICATES_TABLE = [
        'table_name' => 'servermanagerv1_certificates',
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
    public const SYSTEM_SNAPSHOTS_TABLE = [
        'table_name' => 'servermanagerv1_system_snapshots',
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
    public const FILE_ACCESS_LOGS_TABLE = [
        'table_name' => 'servermanagerv1_file_access_logs',
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
    public const PREDEFINED_SCRIPTS_TABLE = [
        'table_name' => 'servermanagerv1_predefined_scripts',
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
    
    // Helper methods to get table names
    public static function getNginxSitesTable(): string
    {
        return self::NGINX_SITES_TABLE['table_name'];
    }
    
    public static function getExecutionLogsTable(): string
    {
        return self::EXECUTION_LOGS_TABLE['table_name'];
    }
    
    public static function getCertificatesTable(): string
    {
        return self::CERTIFICATES_TABLE['table_name'];
    }
    
    public static function getSystemSnapshotsTable(): string
    {
        return self::SYSTEM_SNAPSHOTS_TABLE['table_name'];
    }
    
    public static function getFileAccessLogsTable(): string
    {
        return self::FILE_ACCESS_LOGS_TABLE['table_name'];
    }
    
    public static function getPredefinedScriptsTable(): string
    {
        return self::PREDEFINED_SCRIPTS_TABLE['table_name'];
    }
    
    // Helper methods to get field names
    public static function getNginxSitesFields(): array
    {
        return self::NGINX_SITES_TABLE['fields'];
    }
    
    public static function getExecutionLogsFields(): array
    {
        return self::EXECUTION_LOGS_TABLE['fields'];
    }
    
    public static function getCertificatesFields(): array
    {
        return self::CERTIFICATES_TABLE['fields'];
    }
    
    public static function getSystemSnapshotsFields(): array
    {
        return self::SYSTEM_SNAPSHOTS_TABLE['fields'];
    }
    
    public static function getFileAccessLogsFields(): array
    {
        return self::FILE_ACCESS_LOGS_TABLE['fields'];
    }
    
    public static function getPredefinedScriptsFields(): array
    {
        return self::PREDEFINED_SCRIPTS_TABLE['fields'];
    }
}
