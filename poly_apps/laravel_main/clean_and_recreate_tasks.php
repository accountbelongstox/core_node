<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Cleaning Old Tasks and Creating New Ones ===" . PHP_EOL;
echo PHP_EOL;

echo "[1] Deleting old tasks with null words..." . PHP_EOL;
$deleted = App\Models\GlobalTask::where('task_type', 'dictionary_explanation')->delete();
echo "Deleted {$deleted} tasks" . PHP_EOL;
echo PHP_EOL;

echo "[2] Creating new tasks with correct format..." . PHP_EOL;
$timerTask = new App\Services\TimerTasks\AppQyV1DictionaryTranslationTask();
$timerTask->exec();
echo "Timer task executed" . PHP_EOL;
echo PHP_EOL;

echo "[3] Verifying new tasks..." . PHP_EOL;
$tasks = App\Models\GlobalTask::all();
echo "Total tasks: " . $tasks->count() . PHP_EOL;

foreach ($tasks as $task) {
    echo "  - Task: " . $task->task_type . PHP_EOL;
    echo "    Execution: " . $task->execution_type . PHP_EOL;
    echo "    Language: " . ($task->payload['language'] ?? 'N/A') . PHP_EOL;
    echo "    Words: " . ($task->payload['word_count'] ?? 'N/A') . PHP_EOL;
    if (isset($task->payload['words'][0]['word'])) {
        echo "    First word: " . $task->payload['words'][0]['word'] . PHP_EOL;
    }
    echo PHP_EOL;
}

echo "✓ Cleanup completed!" . PHP_EOL;
