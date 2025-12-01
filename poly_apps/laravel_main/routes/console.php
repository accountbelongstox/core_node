<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###


use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Log;
use App\Services\TimerTasks\OctaneTimerTaskInterface;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('mcpv1:placeholder-cleanup')->daily()->at('03:00');

$tasksDirectory = app_path('Services/TimerTasks');
$tasksNamespace = 'App\\Services\\TimerTasks\\';

if (is_dir($tasksDirectory)) {
    $files = glob($tasksDirectory . '/*.php');

    foreach ($files as $file) {
        $className = basename($file, '.php');

        if (in_array($className, ['OctaneTimerTaskInterface', 'OctaneTimerTaskAbstract'])) {
            continue;
        }

        $fullClassName = $tasksNamespace . $className;

        if (!class_exists($fullClassName)) {
            continue;
        }

        $implements = class_implements($fullClassName);
        if (!isset($implements[OctaneTimerTaskInterface::class])) {
            continue;
        }

        try {
            $task = new $fullClassName();

            if (!$task->isEnabled()) {
                Log::debug('Schedule: Task disabled, skipping', [
                    'task' => $task->getName(),
                    'class' => $className
                ]);
                continue;
            }

            $interval = $task->getInterval();
            $taskName = $task->getName();

            $scheduleCallback = function () use ($task, $taskName) {
                try {
                    $task->exec();
                } catch (\Throwable $e) {
                    Log::error('Schedule: Task execution failed', [
                        'task' => $taskName,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString()
                    ]);
                }
            };

            $scheduledTask = match ($interval) {
                1 => Schedule::call($scheduleCallback)->everySecond(),
                2 => Schedule::call($scheduleCallback)->everyTwoSeconds(),
                5 => Schedule::call($scheduleCallback)->everyFiveSeconds(),
                10 => Schedule::call($scheduleCallback)->everyTenSeconds(),
                15 => Schedule::call($scheduleCallback)->everyFifteenSeconds(),
                30 => Schedule::call($scheduleCallback)->everyThirtySeconds(),
                60 => Schedule::call($scheduleCallback)->everyMinute(),
                default => Schedule::call($scheduleCallback)->cron("*/{$interval} * * * * *"),
            };

            $scheduledTask->name($taskName)->withoutOverlapping($interval);

            Log::info('Schedule: Task registered', [
                'task' => $taskName,
                'class' => $className,
                'interval' => $interval . 's'
            ]);

        } catch (\Throwable $e) {
            Log::error('Schedule: Failed to register task', [
                'class' => $className,
                'error' => $e->getMessage()
            ]);
        }
    }
}
