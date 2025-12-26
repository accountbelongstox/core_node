#!/usr/bin/env php
<?php

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1UnifiedTTSQueueService;

echo "=== FORCE DEDUPLICATION NOW ===\n\n";

$service = new AppQyV1UnifiedTTSQueueService();

// Force deduplication
$result = $service->deduplicateQueue(true);

echo "Results:\n";
echo "  Success: " . ($result['success'] ? 'Yes' : 'No') . "\n";
echo "  Duplicates found: {$result['duplicates_found']}\n";
echo "  Tasks deleted: {$result['deleted']}\n";

if (isset($result['skipped'])) {
    echo "  Skipped: {$result['reason']}\n";
}

echo "\n=== DONE ===\n";
