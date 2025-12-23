#!/usr/bin/env php
<?php

/**
 * Fix TTS Queue Unique Constraint
 *
 * Adds UNIQUE constraint to prevent duplicate tasks in queue
 *
 * Issue: appqyv1_tts_queue table is missing UNIQUE constraint on (task_type, content_hash, language)
 * This allows duplicate tasks to be inserted under race conditions
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== TTS Queue Unique Constraint Fix ===\n\n";

$connection = 'appqyv1';
$tableName = 'appqyv1_tts_queue';

try {
    // Check if table exists
    $tableExists = DB::connection($connection)
        ->select("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$tableName]);

    if (empty($tableExists)) {
        echo "❌ Table {$tableName} does not exist!\n";
        exit(1);
    }

    echo "✅ Table {$tableName} exists\n";

    // Check current table structure
    $tableInfo = DB::connection($connection)
        ->select("PRAGMA table_info({$tableName})");

    echo "\nCurrent columns:\n";
    foreach ($tableInfo as $column) {
        echo "  - {$column->name} ({$column->type})\n";
    }

    // Check if unique constraint already exists
    $indexes = DB::connection($connection)
        ->select("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=?", [$tableName]);

    $hasUniqueConstraint = false;
    echo "\nCurrent indexes:\n";
    foreach ($indexes as $index) {
        echo "  - " . ($index->sql ?? 'auto-index') . "\n";
        if (stripos($index->sql ?? '', 'unique_task') !== false) {
            $hasUniqueConstraint = true;
        }
    }

    if ($hasUniqueConstraint) {
        echo "\n✅ Unique constraint already exists. No action needed.\n";
        exit(0);
    }

    echo "\n⚠️  Unique constraint missing. Creating...\n";

    // Step 1: Remove duplicate tasks (keep oldest for each unique combination)
    echo "\nStep 1: Removing duplicate tasks...\n";

    $duplicates = DB::connection($connection)->select("
        SELECT task_type, content_hash, language, COUNT(*) as count
        FROM {$tableName}
        GROUP BY task_type, content_hash, language
        HAVING count > 1
    ");

    $duplicateCount = count($duplicates);
    echo "Found {$duplicateCount} groups of duplicates\n";

    if ($duplicateCount > 0) {
        // Keep the oldest task (lowest ID) for each unique combination
        DB::connection($connection)->statement("
            DELETE FROM {$tableName}
            WHERE id NOT IN (
                SELECT MIN(id)
                FROM {$tableName}
                GROUP BY task_type, content_hash, language
            )
        ");

        $deleted = DB::connection($connection)->select("SELECT changes() as deleted")[0]->deleted;
        echo "✅ Deleted {$deleted} duplicate tasks\n";
    } else {
        echo "✅ No duplicates found\n";
    }

    // Step 2: Create new table with unique constraint
    echo "\nStep 2: Creating new table with unique constraint...\n";

    DB::connection($connection)->statement("
        CREATE TABLE {$tableName}_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type VARCHAR NOT NULL DEFAULT 'word',
            content_text TEXT NOT NULL,
            content_hash VARCHAR(32) NOT NULL,
            language VARCHAR(10) NOT NULL,
            word TEXT NULL,
            word_md5 VARCHAR(32) NULL,
            status VARCHAR NOT NULL DEFAULT 'pending',
            priority INTEGER NOT NULL DEFAULT 0,
            retry_count INTEGER NOT NULL DEFAULT 0,
            error_message TEXT NULL,
            audio_path TEXT NULL,
            audio_files TEXT NULL,
            metadata TEXT NULL,
            requested_at DATETIME NULL,
            started_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at DATETIME NULL,
            updated_at DATETIME NULL,

            UNIQUE(task_type, content_hash, language)
        )
    ");

    echo "✅ Created new table with unique constraint\n";

    // Step 3: Copy data
    echo "\nStep 3: Copying data from old table...\n";

    DB::connection($connection)->statement("
        INSERT INTO {$tableName}_new
        SELECT * FROM {$tableName}
    ");

    $copiedRows = DB::connection($connection)->select("SELECT COUNT(*) as count FROM {$tableName}_new")[0]->count;
    echo "✅ Copied {$copiedRows} rows\n";

    // Step 4: Drop old table and rename new table
    echo "\nStep 4: Replacing old table...\n";

    DB::connection($connection)->statement("DROP TABLE {$tableName}");
    DB::connection($connection)->statement("ALTER TABLE {$tableName}_new RENAME TO {$tableName}");

    echo "✅ Replaced old table with new table\n";

    // Step 5: Create indexes
    echo "\nStep 5: Creating indexes...\n";

    DB::connection($connection)->statement("
        CREATE INDEX idx_queue_order ON {$tableName} (status, priority, created_at)
    ");

    DB::connection($connection)->statement("
        CREATE INDEX idx_type_status ON {$tableName} (task_type, status)
    ");

    DB::connection($connection)->statement("
        CREATE INDEX idx_content_hash ON {$tableName} (content_hash)
    ");

    echo "✅ Created indexes\n";

    // Verify
    echo "\nVerifying...\n";

    $finalIndexes = DB::connection($connection)
        ->select("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL", [$tableName]);

    foreach ($finalIndexes as $index) {
        echo "  ✓ " . $index->sql . "\n";
    }

    $finalCount = DB::connection($connection)->select("SELECT COUNT(*) as count FROM {$tableName}")[0]->count;
    echo "\n✅ Final row count: {$finalCount}\n";

    echo "\n=== SUCCESS ===\n";
    echo "Unique constraint added successfully!\n";
    echo "The queue now prevents duplicate tasks at database level.\n";

} catch (\Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
