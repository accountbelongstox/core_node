<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Get all dictionary table names
        $tables = DB::connection('appqyv1')
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_qy_v1_%_dictionaries'");

        foreach ($tables as $table) {
            $tableName = $table->name;

            // Check if column already exists
            $columns = DB::connection('appqyv1')->select("PRAGMA table_info({$tableName})");
            $hasColumn = false;

            foreach ($columns as $column) {
                if ($column->name === 'has_audio') {
                    $hasColumn = true;
                    break;
                }
            }

            if (!$hasColumn) {
                // Add has_audio column
                DB::connection('appqyv1')->statement(
                    "ALTER TABLE {$tableName} ADD COLUMN has_audio INTEGER DEFAULT 0"
                );

                // Check if tts_files column exists before updating
                $hasTtsFilesColumn = false;
                foreach ($columns as $column) {
                    if ($column->name === 'tts_files') {
                        $hasTtsFilesColumn = true;
                        break;
                    }
                }

                // Update has_audio based on existing tts_files if column exists
                if ($hasTtsFilesColumn) {
                    DB::connection('appqyv1')->statement(
                        "UPDATE {$tableName} SET has_audio = 1 WHERE tts_files IS NOT NULL AND tts_files != '' AND tts_files != '[]'"
                    );
                }

                echo "Added has_audio column to {$tableName}\n";
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Get all dictionary table names
        $tables = DB::connection('appqyv1')
            ->select("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'app_qy_v1_%_dictionaries'");

        foreach ($tables as $table) {
            $tableName = $table->name;

            // SQLite doesn't support DROP COLUMN directly, would need to recreate table
            // For now, just leave the column (safer for rollback)
            echo "Skipping rollback for {$tableName} (SQLite limitation)\n";
        }
    }
};
