<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Setting Up Test Data ===" . PHP_EOL;
echo PHP_EOL;

echo "[1] Checking database connections..." . PHP_EOL;
$connections = ['AppQyV1', 'appqyv1'];
$activeConnection = null;

foreach ($connections as $connName) {
    try {
        $conn = DB::connection($connName);
        $tables = $conn->select("SELECT name FROM sqlite_master WHERE type='table'");
        echo "  Connection '{$connName}': " . count($tables) . " tables" . PHP_EOL;

        foreach ($tables as $table) {
            if (strpos($table->name, '_en_dictionar') !== false) {
                $activeConnection = $connName;
                echo "    Found English dictionary table: " . $table->name . PHP_EOL;
                break 2;
            }
        }
    } catch (\Exception $e) {
        echo "  Connection '{$connName}': Error - " . $e->getMessage() . PHP_EOL;
    }
}

if (!$activeConnection) {
    echo PHP_EOL;
    echo "ERROR: No English dictionary table found!" . PHP_EOL;
    echo "Running migration..." . PHP_EOL;

    exec("php artisan migrate --database=appqyv1 2>&1", $output, $returnCode);
    echo implode(PHP_EOL, $output) . PHP_EOL;

    if ($returnCode !== 0) {
        echo "Migration failed!" . PHP_EOL;
        exit(1);
    }

    $activeConnection = 'appqyv1';
}

echo PHP_EOL;
echo "[2] Adding test words to dictionaries..." . PHP_EOL;

$testData = [
    'english' => ['apple', 'banana', 'computer', 'mountain', 'river', 'desert', 'forest', 'ocean', 'algorithm', 'network', 'database', 'server', 'security', 'system', 'worker', 'task', 'queue', 'language', 'translation', 'dictionary'],
    'japanese' => ['こんにちは', 'ありがとう', 'さようなら', 'おはよう', 'おやすみ', '日本', '言語', '単語', '翻訳', '辞書'],
    'korean' => ['안녕하세요', '감사합니다', '안녕히가세요', '좋은아침', '잘자요', '한국', '언어', '단어', '번역', '사전'],
];

foreach ($testData as $language => $words) {
    try {
        $result = App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService::addWords($language, $words);
        echo "  {$language}: Added {$result['added']} words" . PHP_EOL;
    } catch (\Exception $e) {
        echo "  {$language}: Error - " . $e->getMessage() . PHP_EOL;
    }
}

echo PHP_EOL;
echo "[3] Triggering automatic task creation..." . PHP_EOL;
$timerTask = new App\Services\TimerTasks\AppQyV1DictionaryTranslationTask();
$timerTask->exec();

echo PHP_EOL;
echo "[4] Verifying task queue..." . PHP_EOL;
$taskCount = App\Models\GlobalTask::count();
echo "Total tasks created: " . $taskCount . PHP_EOL;

if ($taskCount > 0) {
    $tasks = App\Models\GlobalTask::take(5)->get();
    foreach ($tasks as $task) {
        echo "  - " . $task->task_type . " | " . $task->payload['language'] . " | " . $task->payload['word_count'] . " words" . PHP_EOL;
    }
}

echo PHP_EOL;
echo "✓ Setup completed!" . PHP_EOL;
