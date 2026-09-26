<?php

namespace App\Services;

use App\Services\TimerTasks\OctaneTimerTaskInterface;
use Illuminate\Contracts\Container\Container;
use Illuminate\Support\Facades\File;
use ReflectionClass;

final class OctaneTimerTaskCatalog
{
    private const TASKS_DIRECTORY = __DIR__ . '/TimerTasks';
    private const TASKS_NAMESPACE = 'App\\Services\\TimerTasks\\';

    public function __construct(private readonly Container $container)
    {
    }

    public function discover(bool $resolveEnabled = true): array
    {
        $tasks = [];
        $files = [];
        $className = '';
        $fullClassName = '';
        $reflection = null;
        $instance = null;

        if (!is_dir(self::TASKS_DIRECTORY)) {
            return $tasks;
        }

        $files = File::glob(self::TASKS_DIRECTORY . '/*.php');

        foreach ($files as $file) {
            $className = basename($file, '.php');
            $fullClassName = self::TASKS_NAMESPACE . $className;

            if (!class_exists($fullClassName)) {
                continue;
            }

            $reflection = new ReflectionClass($fullClassName);
            if ($reflection->isAbstract() || !$reflection->implementsInterface(OctaneTimerTaskInterface::class)) {
                continue;
            }

            try {
                $instance = $this->container->make($fullClassName);
                $tasks[] = [
                    'class' => $className,
                    'full_class' => $fullClassName,
                    'name' => $instance->getName(),
                    'interval' => $instance->getInterval(),
                    'enabled' => $resolveEnabled ? $instance->isEnabled() : null,
                    'execution_mode' => $instance->getExecutionMode(),
                    'file' => basename($file),
                    'instance' => $instance,
                ];
            } catch (\Throwable $exception) {
                $tasks[] = [
                    'class' => $className,
                    'full_class' => $fullClassName,
                    'name' => null,
                    'interval' => null,
                    'enabled' => false,
                    'error' => $exception->getMessage(),
                    'file' => basename($file),
                    'instance' => null,
                ];
            }
        }

        return $tasks;
    }

    public function descriptions(): array
    {
        $tasks = $this->discover(true);

        foreach ($tasks as &$task) {
            unset($task['instance']);
        }
        unset($task);

        return $tasks;
    }
}
