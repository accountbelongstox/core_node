<?php

namespace App\Logging;

use Monolog\Formatter\LineFormatter;
use Monolog\Level;
use Monolog\Logger;
use Monolog\Processor\PsrLogMessageProcessor;

/**
 * Custom channel factory (config/logging.php `daily` channel). Mirrors
 * Laravel's daily driver wiring — rotating file, line formatter, optional
 * placeholder replacement — but installs the size-capped handler that prunes
 * its own directory before writing.
 */
final class CreateSizeCappedDailyLogger
{
    public function __invoke(array $config): Logger
    {
        $handler = new SizeCappedRotatingFileHandler(
            (string) $config['path'],
            (int) ($config['max_files'] ?? 7),
            Logger::toMonologLevel($config['level'] ?? Level::Warning),
            (bool) ($config['bubble'] ?? true),
            isset($config['permission']) ? (int) $config['permission'] : null,
            (bool) ($config['locking'] ?? false),
        );
        $handler->setFormatter(new LineFormatter(null, null, true, true));

        $processors = [];
        if ($config['replace_placeholders'] ?? false) {
            $processors[] = new PsrLogMessageProcessor();
        }

        return new Logger(
            (string) ($config['name'] ?? config('app.env', 'production')),
            [$handler],
            $processors,
        );
    }
}
