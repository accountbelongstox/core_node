<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $tableName;
    
    public function __construct()
    {
        $this->appKey = AppKeys::BANKV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = 'bankv1_user_data_submissions';
    }

    public function up(): void
    {
        // This migration only adds columns to existing table
        $tableStructure = [
            'columns' => [
                'complete_user_profile' => [
                    'type' => 'json',
                    'nullable' => true,
                    'after' => 'additional_data',
                ],
                'global_app_data' => [
                    'type' => 'json',
                    'nullable' => true,
                    'after' => 'complete_user_profile',
                ],
                'app_state' => [
                    'type' => 'json',
                    'nullable' => true,
                    'after' => 'global_app_data',
                ],
            ],
        ];
        
        SafeMigrationHelper::alignTableStructureFromArray(
            $this->connection,
            $this->tableName,
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
        if (Schema::connection($this->connection)->hasTable($this->tableName)) {
            Schema::connection($this->connection)->table($this->tableName, function (\Illuminate\Database\Schema\Blueprint $table) {
                $columnsToRemove = [];
                if (Schema::connection($this->connection)->hasColumn($this->tableName, 'complete_user_profile')) {
                    $columnsToRemove[] = 'complete_user_profile';
                }
                if (Schema::connection($this->connection)->hasColumn($this->tableName, 'global_app_data')) {
                    $columnsToRemove[] = 'global_app_data';
                }
                if (Schema::connection($this->connection)->hasColumn($this->tableName, 'app_state')) {
                    $columnsToRemove[] = 'app_state';
                }
                if (!empty($columnsToRemove)) {
                    $table->dropColumn($columnsToRemove);
                }
            });
        }
    }
};
