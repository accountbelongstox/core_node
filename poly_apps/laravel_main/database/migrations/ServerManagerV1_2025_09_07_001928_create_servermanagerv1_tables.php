<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;

return new class extends Migration
{
    protected $connection = 'servermanagerv1';

    public function up(): void
    {
        $this->createNginxSitesTable();
        $this->createExecutionLogsTable();
        $this->createCertificatesTable();
        $this->createSystemSnapshotsTable();
        $this->createFileAccessLogsTable();
        $this->createPredefinedScriptsTable();
    }

    private function createNginxSitesTable(): void
    {
        $tableName = 'servermanagerv1_nginx_sites';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'site_name' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'domain' => ['type' => 'string', 'nullable' => false],
                'site_type' => ['type' => 'enum', 'values' => ['php', 'laravel', 'static', 'proxy'], 'nullable' => false],
                'document_root' => ['type' => 'string', 'nullable' => true],
                'php_version' => ['type' => 'string', 'nullable' => true],
                'ssl_enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'ssl_cert_path' => ['type' => 'string', 'nullable' => true],
                'ssl_key_path' => ['type' => 'string', 'nullable' => true],
                'proxy_pass' => ['type' => 'string', 'nullable' => true],
                'config_content' => ['type' => 'longText', 'nullable' => false],
                'is_enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createExecutionLogsTable(): void
    {
        $tableName = 'servermanagerv1_execution_logs';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'script_id' => ['type' => 'string', 'nullable' => false],
                'script_name' => ['type' => 'string', 'nullable' => false],
                'script_category' => ['type' => 'string', 'nullable' => false],
                'command' => ['type' => 'text', 'nullable' => false],
                'arguments' => ['type' => 'json', 'nullable' => true],
                'output' => ['type' => 'longText', 'nullable' => true],
                'error_output' => ['type' => 'longText', 'nullable' => true],
                'exit_code' => ['type' => 'integer', 'nullable' => false],
                'execution_time' => ['type' => 'float', 'nullable' => false],
                'memory_usage' => ['type' => 'bigInteger', 'nullable' => false],
                'user_ip' => ['type' => 'string', 'nullable' => false],
                'user_agent' => ['type' => 'string', 'nullable' => true],
                'started_at' => ['type' => 'timestamp', 'nullable' => false],
                'completed_at' => ['type' => 'timestamp', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['script_id']],
                ['columns' => ['started_at']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createCertificatesTable(): void
    {
        $tableName = 'servermanagerv1_certificates';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'domain' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'certificate_path' => ['type' => 'string', 'nullable' => false],
                'private_key_path' => ['type' => 'string', 'nullable' => false],
                'chain_path' => ['type' => 'string', 'nullable' => true],
                'issuer' => ['type' => 'string', 'nullable' => true],
                'issued_at' => ['type' => 'timestamp', 'nullable' => true],
                'expires_at' => ['type' => 'timestamp', 'nullable' => true],
                'auto_renew' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'last_renewed_at' => ['type' => 'timestamp', 'nullable' => true],
                'renewal_attempts' => ['type' => 'integer', 'nullable' => false, 'default' => 0],
                'status' => ['type' => 'enum', 'values' => ['active', 'expired', 'pending', 'failed'], 'nullable' => false],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['status']],
                ['columns' => ['expires_at']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createSystemSnapshotsTable(): void
    {
        $tableName = 'servermanagerv1_system_snapshots';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'snapshot_type' => ['type' => 'enum', 'values' => ['scheduled', 'manual', 'alert'], 'nullable' => false],
                'cpu_usage' => ['type' => 'float', 'nullable' => true],
                'memory_total' => ['type' => 'bigInteger', 'nullable' => true],
                'memory_used' => ['type' => 'bigInteger', 'nullable' => true],
                'memory_free' => ['type' => 'bigInteger', 'nullable' => true],
                'disk_total' => ['type' => 'bigInteger', 'nullable' => true],
                'disk_used' => ['type' => 'bigInteger', 'nullable' => true],
                'disk_free' => ['type' => 'bigInteger', 'nullable' => true],
                'load_average' => ['type' => 'json', 'nullable' => true],
                'process_count' => ['type' => 'integer', 'nullable' => true],
                'network_info' => ['type' => 'json', 'nullable' => true],
                'service_status' => ['type' => 'json', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['snapshot_type']],
                ['columns' => ['created_at']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createFileAccessLogsTable(): void
    {
        $tableName = 'servermanagerv1_file_access_logs';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'action' => ['type' => 'enum', 'values' => ['browse', 'download', 'preview', 'info'], 'nullable' => false],
                'file_path' => ['type' => 'text', 'nullable' => false],
                'file_size' => ['type' => 'bigInteger', 'nullable' => true],
                'file_type' => ['type' => 'string', 'nullable' => true],
                'user_ip' => ['type' => 'string', 'nullable' => false],
                'user_agent' => ['type' => 'string', 'nullable' => true],
                'success' => ['type' => 'boolean', 'nullable' => false],
                'error_message' => ['type' => 'text', 'nullable' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['action']],
                ['columns' => ['created_at']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    private function createPredefinedScriptsTable(): void
    {
        $tableName = 'servermanagerv1_predefined_scripts';
        $tableStructure = [
            'columns' => [
                'id' => ['type' => 'bigIncrements'],
                'script_name' => ['type' => 'string', 'nullable' => false, 'unique' => true],
                'script_category' => ['type' => 'string', 'nullable' => false],
                'description' => ['type' => 'text', 'nullable' => false],
                'command' => ['type' => 'text', 'nullable' => false],
                'arguments' => ['type' => 'json', 'nullable' => true],
                'working_directory' => ['type' => 'string', 'nullable' => true],
                'timeout' => ['type' => 'integer', 'nullable' => false, 'default' => 300],
                'requires_sudo' => ['type' => 'boolean', 'nullable' => false, 'default' => false],
                'is_enabled' => ['type' => 'boolean', 'nullable' => false, 'default' => true],
                'created_at' => ['type' => 'timestamp', 'nullable' => true],
                'updated_at' => ['type' => 'timestamp', 'nullable' => true],
            ],
            'indexes' => [
                ['columns' => ['script_category']],
                ['columns' => ['is_enabled']],
            ],
        ];

        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $tableName,
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('servermanagerv1_predefined_scripts');
        Schema::connection($this->connection)->dropIfExists('servermanagerv1_file_access_logs');
        Schema::connection($this->connection)->dropIfExists('servermanagerv1_system_snapshots');
        Schema::connection($this->connection)->dropIfExists('servermanagerv1_certificates');
        Schema::connection($this->connection)->dropIfExists('servermanagerv1_execution_logs');
        Schema::connection($this->connection)->dropIfExists('servermanagerv1_nginx_sites');
    }
};
