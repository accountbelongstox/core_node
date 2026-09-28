<?php

namespace App\Utils;

use Illuminate\Support\Facades\Facade;
use Illuminate\Support\Facades\Log;

// Logging that survives the pre-boot context: the 175 provisioning probes only
// require vendor/autoload.php + bootstrap/app.php, where neither the Log alias
// nor the facade root is registered (kernel boot registers both). Without a
// booted application every call is a no-op instead of a fatal
// "Class Log not found" / "A facade root has not been set".
class SafeLogger
{
    public static function info(string $message, array $context = []): void
    {
        self::write('info', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::write('warning', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('error', $message, $context);
    }

    private static function write(string $level, string $message, array $context): void
    {
        try {
            if (Facade::getFacadeApplication() === null) {
                return;
            }
            Log::$level($message, $context);
        } catch (\Throwable $e) {
            // Logging must never break the provisioning/runtime caller.
        }
    }
}
