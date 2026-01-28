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
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->tableName = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'word_groups');
    }

    public function up(): void
    {
        // This migration only adds columns and indexes to existing table
        $tableStructure = [
            'columns' => [
                'language' => [
                    'type' => 'string',
                    'length' => 10,
                    'nullable' => false,
                    'default' => 'en',
                    'after' => 'thumbnail_url',
                    'comment' => 'Language code (en, zh, ja, etc.)',
                ],
                'is_language_default' => [
                    'type' => 'boolean',
                    'nullable' => false,
                    'default' => false,
                    'after' => 'language',
                    'comment' => 'Is this the default group for this language',
                ],
            ],
            'indexes' => [
                [
                    'columns' => ['uid', 'language'],
                    'name' => 'idx_uid_language',
                ],
                [
                    'columns' => ['uid', 'language', 'is_language_default'],
                    'name' => 'idx_uid_language_default',
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
                $table->dropColumn(['language', 'is_language_default']);
            });
            
            $dbConnection = Schema::connection($this->connection)->getConnection();
            $dbConnection->statement('DROP INDEX IF EXISTS idx_uid_language');
            $dbConnection->statement('DROP INDEX IF EXISTS idx_uid_language_default');
        }
    }
};
