<?php

namespace App\PassiveQueue;

use App\PassiveQueue\Jobs\PassiveQueueJobInterface;
use Illuminate\Support\Facades\Log;

class PassiveQueue
{
    protected static bool $runnerScheduled = false;

    public static function dispatch(string $jobClass, array $payload = [], int $delaySeconds = 0): void
    {
        if (!is_subclass_of($jobClass, PassiveQueueJobInterface::class)) {
            throw new \InvalidArgumentException("Passive queue job {$jobClass} must implement PassiveQueueJobInterface");
        }

        PassiveQueueJob::query()->create([
            'job_class' => $jobClass,
            'payload' => $payload,
            'status' => 'pending',
            'available_at' => now()->addSeconds($delaySeconds),
        ]);

        self::triggerRunner();
    }

    public static function triggerRunner(): void
    {
        if (self::$runnerScheduled) {
            return;
        }

        self::$runnerScheduled = true;

        if (class_exists('\Swoole\Event')) {
            \Swoole\Event::defer(function () {
                self::$runnerScheduled = false;
                self::runUntilEmpty();
            });
            return;
        }

        register_shutdown_function(function () {
            self::$runnerScheduled = false;
            self::runUntilEmpty();
        });
    }

    public static function runUntilEmpty(): void
    {
        if (!self::isApplicationReady()) {
            return;
        }

        while (true) {
            $job = null;

            \DB::connection()->transaction(function () use (&$job) {
                $job = PassiveQueueJob::query()
                    ->where('status', 'pending')
                    ->where(function ($query) {
                        $query->whereNull('available_at')
                            ->orWhere('available_at', '<=', now());
                    })
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->first();

                if ($job) {
                    $job->status = 'processing';
                    $job->attempts++;
                    $job->started_at = now();
                    $job->save();
                }
            }, 1);

            if (!$job) {
                break;
            }

            try {
                /** @var PassiveQueueJobInterface $handler */
                $handler = app($job->job_class);
                $handler->handle($job->payload ?? []);

                $job->status = 'completed';
                $job->error_message = null;
            } catch (\Throwable $e) {
                $job->status = 'failed';
                $job->error_message = $e->getMessage();
                Log::error('[PassiveQueue] Job failed', [
                    'job' => $job->job_class,
                    'payload' => $job->payload,
                    'error' => $e->getMessage(),
                ]);
            }

            $job->finished_at = now();
            $job->save();
        }

        if (PassiveQueueJob::query()->where('status', 'pending')->exists()) {
            self::triggerRunner();
        }
    }

    private static function isApplicationReady(): bool
    {
        try {
            if (!function_exists('app')) {
                return false;
            }

            $app = app();
            if (!$app) {
                return false;
            }

            if (method_exists($app, 'hasBeenBootstrapped') && !$app->hasBeenBootstrapped()) {
                return false;
            }

            return $app->bound('config') && $app->bound('db');
        } catch (\Throwable $e) {
            return false;
        }
    }
}
