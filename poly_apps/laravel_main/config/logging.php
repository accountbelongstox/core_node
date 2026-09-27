<?php

use App\Constants\LaravelConfig;
use App\Providers\PathMapper;
use Monolog\Handler\NullHandler;
use Monolog\Handler\StreamHandler;
use Monolog\Processor\PsrLogMessageProcessor;

$laravelLogPath = PathMapper::mapWebPath('logs', 'laravel.log');

return [

    /*
    |--------------------------------------------------------------------------
    | Default Log Channel
    |--------------------------------------------------------------------------
    |
    | This option defines the default log channel that is utilized to write
    | messages to your logs. The value provided here should match one of
    | the channels present in the list of "channels" configured below.
    |
    */

    'default' => 'stack',

    /*
    |--------------------------------------------------------------------------
    | Deprecations Log Channel
    |--------------------------------------------------------------------------
    |
    | This option controls the log channel that should be used to log warnings
    | regarding deprecated PHP and library features. This allows you to get
    | your application ready for upcoming major versions of dependencies.
    |
    */

    'deprecations' => [
        'channel' => 'single',
        'trace' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Log Channels
    |--------------------------------------------------------------------------
    |
    | Here you may configure the log channels for your application. Laravel
    | utilizes the Monolog PHP logging library, which includes a variety
    | of powerful log handlers and formatters that you're free to use.
    |
    | Available drivers: "single", "daily", "slack", "syslog",
    |                    "errorlog", "monolog", "custom", "stack"
    |
    */

    'channels' => [

        'stack' => [
            'driver' => 'stack',
            // Daily rotation bounds the live log (the unrotated single file
            // reached 6.9 GB under the worker-restart fatal loop). Readers
            // resolve the active file through LaravelLogTailService, which
            // handles both layouts.
            'channels' => ['daily'],
            'ignore_exceptions' => false,
        ],

        'single' => [
            'driver' => 'single',
            'path' => $laravelLogPath,
            'level' => LaravelConfig::LOG_LEVEL,
            'replace_placeholders' => true,
        ],

        'daily' => [
            // Custom factory channel: a rotating daily handler that caps its
            // own files by size and sweeps aged/oversized rotations before
            // every write (the stock daily driver only bounds file count).
            'driver' => 'custom',
            'via' => \App\Logging\CreateSizeCappedDailyLogger::class,
            'path' => $laravelLogPath,
            // Routine INFO chatter (timer ticks, request noise) is suppressed;
            // warnings and errors remain.
            'level' => LaravelConfig::LOG_LEVEL,
            'max_files' => 7,
            'replace_placeholders' => true,
        ],

        'stderr' => [
            'driver' => 'monolog',
            'level' => 'info',
            'handler' => StreamHandler::class,
            'handler_with' => [
                'stream' => 'php://stderr',
            ],
            'formatter' => null,
            'processors' => [PsrLogMessageProcessor::class],
        ],

        'null' => [
            'driver' => 'monolog',
            'handler' => NullHandler::class,
        ],

        'emergency' => [
            'path' => $laravelLogPath,
        ],

    ],

];
