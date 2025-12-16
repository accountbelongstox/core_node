<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Backend Task Queue System Check ===" . PHP_EOL;
echo PHP_EOL;

echo "[1] Scanning all language dictionaries..." . PHP_EOL;
try {
    $available = App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService::scanAvailableLanguages();
    echo "Available languages: " . implode(', ', $available) . PHP_EOL;
    echo "Count: " . count($available) . " out of 91 supported" . PHP_EOL;
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
echo PHP_EOL;

echo "[2] Checking existing dictionary tables..." . PHP_EOL;
$tables = DB::select("SELECT name FROM sqlite_master WHERE type='table'");
$dictTables = [];
foreach ($tables as $table) {
    if (strpos($table->name, 'dictionar') !== false) {
        $dictTables[] = $table->name;
    }
}
echo "Dictionary tables found: " . count($dictTables) . PHP_EOL;
foreach ($dictTables as $tableName) {
    $count = DB::table($tableName)->count();
    if ($count > 0) {
        echo "  - " . $tableName . ": " . $count . " words" . PHP_EOL;
    }
}
echo PHP_EOL;

echo "[3] Current task queue status..." . PHP_EOL;
$tasks = App\Models\GlobalTask::all();
echo "Total tasks in queue: " . $tasks->count() . PHP_EOL;

if ($tasks->count() > 0) {
    echo PHP_EOL;
    echo "Task details:" . PHP_EOL;
    foreach ($tasks as $task) {
        echo "  - Task: " . $task->task_type . " | Status: " . $task->status . PHP_EOL;
        if (isset($task->payload['language'])) {
            echo "    Language: " . $task->payload['language'] . " | Words: " . $task->payload['word_count'] . PHP_EOL;
        }
    }
}
