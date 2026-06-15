<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
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

    /**
     * Driver-agnostic enumeration of dictionary tables (works on sqlite + pgsql).
     *
     * @return array<int, string>
     */
    private function dictionaryTableNames(): array
    {
        $suffix = '_dictionaries';
        $tableNames = Schema::connection($this->connection)->getTableListing();

        // Normalize possibly schema-qualified names (pgsql may return
        // "public.table") so the prefix/suffix match works on every driver.
        $tableNames = array_map(static function ($name) {
            $pos = strrpos($name, '.');
            return $pos === false ? $name : substr($name, $pos + 1);
        }, $tableNames);

        return array_values(array_filter($tableNames, function ($name) use ($suffix) {
            return str_starts_with($name, $this->prefix . '_') && str_ends_with($name, $suffix);
        }));
    }

    public function up(): void
    {
        // Get all dictionary table names
        foreach ($this->dictionaryTableNames() as $tableName) {

            // Define structure for adding has_audio column
            $tableStructure = [
                'columns' => [
                    // BOOLEAN (not integer): the backfill below sets has_audio = true,
                    // and every reader treats it as a boolean. An integer column would
                    // make `SET has_audio = true` error on pgsql.
                    'has_audio' => [
                        'type' => 'boolean',
                        'nullable' => false,
                        'default' => false,
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
            $hasTtsFilesColumn = Schema::connection($this->connection)->hasColumn($tableName, 'tts_files');

            if ($hasTtsFilesColumn) {
                // Use boolean literals so this is valid on a pgsql BOOLEAN column too
                // (SET has_audio = 1 errors on pgsql); true/false also works on sqlite.
                DB::connection($this->connection)->statement(
                    "UPDATE {$tableName} SET has_audio = true WHERE tts_files IS NOT NULL AND tts_files != '' AND tts_files != '[]'"
                );
            }
        }
    }

    public function down(): void
    {
        // SQLite doesn't support DROP COLUMN directly
        // For safety, we skip rollback (column will remain)
        foreach ($this->dictionaryTableNames() as $tableName) {
            // SQLite limitation: cannot drop column, so we leave it
        }
    }
};
