#!/usr/bin/env php
<?php

/**
 * Reset Queue Priorities
 *
 * Resets all abnormally high priorities to normal range (0-100)
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== TTS Queue Priority Reset ===\n\n";

$connection = 'appqyv1';
$tableName = 'appqyv1_tts_queue';

try {
    // Check current priority distribution
    echo "Current priority distribution:\n";
    echo str_repeat('-', 60) . "\n";

    $stats = DB::connection($connection)->select("
        SELECT
            CASE
                WHEN priority <= 100 THEN '0-100 (Normal)'
                WHEN priority <= 1000 THEN '101-1000 (High)'
                WHEN priority <= 10000 THEN '1001-10000 (Very High)'
                ELSE '10000+ (Abnormal)'
            END as priority_range,
            COUNT(*) as count,
            MIN(priority) as min_priority,
            MAX(priority) as max_priority,
            AVG(priority) as avg_priority
        FROM {$tableName}
        WHERE status = 'pending'
        GROUP BY priority_range
        ORDER BY min_priority
    ");

    foreach ($stats as $stat) {
        echo sprintf(
            "  %-25s: %6d tasks (min: %10.0f, max: %10.0f, avg: %10.0f)\n",
            $stat->priority_range,
            $stat->count,
            $stat->min_priority,
            $stat->max_priority,
            $stat->avg_priority
        );
    }

    echo "\n";

    // Count tasks with abnormal priorities
    $abnormal = DB::connection($connection)->select("
        SELECT COUNT(*) as count FROM {$tableName}
        WHERE status = 'pending' AND priority > 100
    ")[0]->count;

    if ($abnormal == 0) {
        echo "✅ No abnormal priorities found. All priorities are in normal range (0-100).\n";
        exit(0);
    }

    echo "⚠️  Found {$abnormal} tasks with abnormal priorities (> 100)\n\n";

    // Reset all pending tasks to default priority of 30
    echo "Resetting all pending task priorities to 30 (timer-generated default)...\n";

    $updated = DB::connection($connection)->update("
        UPDATE {$tableName}
        SET priority = 30
        WHERE status = 'pending' AND priority > 100
    ");

    echo "✅ Reset {$updated} task priorities\n\n";

    // Verify
    echo "Verification:\n";
    echo str_repeat('-', 60) . "\n";

    $verifyStats = DB::connection($connection)->select("
        SELECT
            MIN(priority) as min_priority,
            MAX(priority) as max_priority,
            AVG(priority) as avg_priority,
            COUNT(*) as count
        FROM {$tableName}
        WHERE status = 'pending'
    ")[0];

    echo sprintf("  Total pending tasks: %d\n", $verifyStats->count);
    echo sprintf("  Min priority: %.0f\n", $verifyStats->min_priority);
    echo sprintf("  Max priority: %.0f\n", $verifyStats->max_priority);
    echo sprintf("  Avg priority: %.2f\n", $verifyStats->avg_priority);

    echo "\n=== SUCCESS ===\n";
    echo "All priorities normalized to reasonable range.\n";

} catch (\Exception $e) {
    echo "\n❌ ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
