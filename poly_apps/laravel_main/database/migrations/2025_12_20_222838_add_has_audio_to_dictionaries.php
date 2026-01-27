<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use App\Services\SafeMigrationHelper;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

return new class extends Migration
{
    protected $connection;
    protected $appKey;
    protected $prefix;
    
    public function __construct()
    {
        $this->appKey = AppKeys::APPQYV1;
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->prefix = AppTablePrefixServiceProvider::getPrefix($this->appKey);
    }

    public function up(): void
    {
        // Get all dictionary table names
        $pattern = $this->prefix . '_%_dictionaries';
        $tables = DB::connection($this->connection)
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?", [$pattern]);

        foreach ($tables as $table) {
            $tableName = $table->name;
            
            // Define structure for adding has_audio column
            $tableStructure = [
                'columns' => [
                    'has_audio' => [
                        'type' => 'integer',
                        'nullable' => false,
                        'default' => 0,
                    ],
                ],
            ];
            
            // Align table structure (adds has_audio if missing)
            SafeMigrationHelper::alignTableStructureFromArray(
                $this->connection,
                $tableName,
                $tableStructure,
                [
                    'shrink_columns' => false,
                    'modify_columns' => true,
                    'add_indexes' => false,
                ]
            );
            
            // Update has_audio based on existing tts_files if column exists
            $columns = DB::connection($this->connection)->select("PRAGMA table_info({$tableName})");
            $hasTtsFilesColumn = false;
            foreach ($columns as $column) {
                if ($column->name === 'tts_files') {
                    $hasTtsFilesColumn = true;
                    break;
                }
            }
            
            if ($hasTtsFilesColumn) {
                DB::connection($this->connection)->statement(
                    "UPDATE {$tableName} SET has_audio = 1 WHERE tts_files IS NOT NULL AND tts_files != '' AND tts_files != '[]'"
                );
            }
        }
    }

    public function down(): void
    {
        // SQLite doesn't support DROP COLUMN directly
        // For safety, we skip rollback (column will remain)
        $pattern = $this->prefix . '_%_dictionaries';
        $tables = DB::connection($this->connection)
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?", [$pattern]);
        
        foreach ($tables as $table) {
            $tableName = $table->name;
            // SQLite limitation: cannot drop column, so we leave it
        }
    }
};
