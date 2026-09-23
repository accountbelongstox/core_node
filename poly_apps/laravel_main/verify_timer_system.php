<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Octane Timer System Verification ===" . PHP_EOL;
echo PHP_EOL;

echo "[1] Checking Provider Registration..." . PHP_EOL;
$providers = $app->getLoadedProviders();
if (isset($providers['App\\Providers\\OctaneTimerServiceProvider'])) {
    echo "✓ OctaneTimerServiceProvider is registered" . PHP_EOL;
} else {
    echo "✗ OctaneTimerServiceProvider NOT registered" . PHP_EOL;
}
echo PHP_EOL;

echo "[2] Checking Timer Task Directory..." . PHP_EOL;
$tasksDir = __DIR__ . '/app/Services/TimerTasks';
if (is_dir($tasksDir)) {
    echo "✓ Tasks directory exists: {$tasksDir}" . PHP_EOL;
    $files = glob($tasksDir . '/*.php');
    echo "  Found " . count($files) . " PHP files" . PHP_EOL;
    foreach ($files as $file) {
        $className = basename($file, '.php');
        if (!in_array($className, ['OctaneTimerTaskInterface', 'OctaneTimerTaskAbstract'])) {
            echo "    - {$className}" . PHP_EOL;
        }
    }
} else {
    echo "✗ Tasks directory NOT found" . PHP_EOL;
}
echo PHP_EOL;

echo "[3] Checking DictLaneQueueCenter (replaces the retired scan timer tasks)..." . PHP_EOL;
$taskClass = 'App\\Services\\QueueCenter\\DictLane\\DictLaneQueueCenter';
if (class_exists($taskClass)) {
    echo "✓ Class exists: {$taskClass}" . PHP_EOL;
    $catalogClass = 'App\\Services\\QueueCenter\\DictLane\\DictLaneCatalog';
    if (class_exists($catalogClass)) {
        echo "  - Lanes: " . implode(', ', $catalogClass::lanes()) . PHP_EOL;
    } else {
        echo "  ✗ Class NOT found: {$catalogClass}" . PHP_EOL;
    }
} else {
    echo "✗ Class NOT found: {$taskClass}" . PHP_EOL;
}
echo PHP_EOL;

echo "[4] Checking Dictionary Statistics..." . PHP_EOL;
try {
    $stats = App\Apps\AppQyV1\AppQyV1Services\AppQyV1DictionaryService::getAllLanguageStatistics();
    echo "✓ Statistics retrieved successfully" . PHP_EOL;
    echo "  Available languages: " . count($stats) . PHP_EOL;

    foreach ($stats as $langCode => $langStats) {
        if ($langStats['untranslated'] > 0) {
            echo "  - {$langCode}: {$langStats['untranslated']} untranslated words (total: {$langStats['total_words']})" . PHP_EOL;
        }
    }

    if (empty($stats)) {
        echo "  ✗ No languages with data found!" . PHP_EOL;
    }
} catch (\Exception $e) {
    echo "✗ Error getting statistics: " . $e->getMessage() . PHP_EOL;
}
echo PHP_EOL;

echo "[5] Octane Configuration..." . PHP_EOL;
$octaneServer = config('octane.server');
echo "  Server: " . ($octaneServer ?? 'NOT SET') . PHP_EOL;

$tables = config('octane.tables');
if (isset($tables['timer_state:1'])) {
    echo "  ✓ timer_state table configured" . PHP_EOL;
} else {
    echo "  ✗ timer_state table NOT configured" . PHP_EOL;
}

if (isset($tables['timer_tasks:100'])) {
    echo "  ✓ timer_tasks table configured" . PHP_EOL;
} else {
    echo "  ✗ timer_tasks table NOT configured" . PHP_EOL;
}
echo PHP_EOL;

echo "=== Verification Complete ===" . PHP_EOL;
