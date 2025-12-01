<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only
// 2. Never execute, create, or modify test code
// 3. Never create or update documentation (*.md)
// 4. Never write summaries during development or thinking process
// 5. Do not modify these rules
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Support;

/**
 * Octane/Swoole Compatibility Fixer
 *
 * PHP Version: 8.5 (Upgraded from 8.4)
 * Swoole Version: 6.x (Compiled from master for PHP 8.5 compatibility)
 *
 * Purpose: Fix Laravel Octane v2.13.x compatibility with Swoole 6.x
 *
 * Background:
 * - Swoole 6.x changed task event callback signature (BREAKING CHANGE)
 * - Swoole 5.x: task(Server $server, int $taskId, int $fromWorkerId, $data)
 * - Swoole 6.x: task(Server $server, Server\Task $task)
 * - Laravel Octane v2.13.x uses Swoole 5.x signature -> TypeError with Swoole 6.x
 *
 * Solution:
 * - Patch vendor/laravel/octane/bin/swoole-server to handle both signatures
 * - This allows use of Swoole 6.x (required for PHP 8.5) until Octane is upgraded
 *
 * Integration Points:
 * 1. scripts/deploy.sh - Called after vendor installation
 * 2. php artisan sys:init - Called during system initialization
 * 3. servermanager:xxx commands - Called before any ServerManager operations
 *
 * Usage:
 * - From Laravel: (new OctaneSwooleCompatFixer())->run()
 * - Standalone CLI: php app/Support/OctaneSwooleCompatFixer.php /path/to/laravel
 * - From Shell: php app/Support/OctaneSwooleCompatFixer.php
 *
 * Version: 1.0.0
 */

class OctaneSwooleCompatFixer
{
    private const PATCH_MARKER = 'Fixed for Swoole 6.x compatibility';
    private const SWOOLE_REQUIRED_MAJOR = 5;
    private const SWOOLE_INCOMPATIBLE_MAJOR = 6;

    private $laravelRoot;
    private $swooleServerFile;
    private $output = [];

    public function __construct($laravelRoot = null)
    {
        $this->laravelRoot = $laravelRoot ?? $this->detectLaravelRoot();

        if (!$this->laravelRoot) {
            throw new RuntimeException('Laravel root directory not found');
        }

        $this->swooleServerFile = $this->laravelRoot . '/vendor/laravel/octane/bin/swoole-server';
    }

    /**
     * Main execution method
     */
    public function run()
    {
        $this->log('[OCTANE_FIX] Checking Octane/Swoole compatibility...');
        $this->log('[OCTANE_FIX] Laravel root: ' . $this->laravelRoot);

        // Check if Octane is installed
        if (!file_exists($this->swooleServerFile)) {
            $this->log('[OCTANE_FIX] Laravel Octane not installed, skipping');
            return ['status' => 'skipped', 'reason' => 'octane_not_installed'];
        }

        // Get Swoole version
        $swooleVersion = $this->getSwooleVersion();
        if (!$swooleVersion) {
            $this->log('[OCTANE_FIX] Swoole not installed, skipping');
            return ['status' => 'skipped', 'reason' => 'swoole_not_installed'];
        }

        $this->log('[OCTANE_FIX] Swoole version: ' . $swooleVersion);

        $swooleMajor = (int) explode('.', $swooleVersion)[0];

        // Check if fix is needed
        if ($swooleMajor === self::SWOOLE_INCOMPATIBLE_MAJOR) {
            $this->log('[OCTANE_FIX] Swoole 6.x detected - incompatible with Octane v2.13.x');

            if ($this->isPatchApplied()) {
                $this->log('[OCTANE_FIX] ✓ Compatibility patch already applied');
                return ['status' => 'already_fixed', 'swoole_version' => $swooleVersion];
            }

            $this->log('[OCTANE_FIX] Applying compatibility patch...');

            if ($this->applyPatch()) {
                $this->log('[OCTANE_FIX] ✓ Compatibility patch applied successfully');
                $this->log('');
                $this->log('Recommended long-term solutions:');
                $this->log('  1. Upgrade Laravel Octane: composer update laravel/octane');
                $this->log('  2. OR downgrade Swoole to 5.x: pecl uninstall swoole && pecl install swoole-5.1.3');

                return ['status' => 'fixed', 'swoole_version' => $swooleVersion];
            } else {
                $this->log('[OCTANE_FIX] ✗ Failed to apply patch');
                return ['status' => 'error', 'reason' => 'patch_failed'];
            }
        } elseif ($swooleMajor === self::SWOOLE_REQUIRED_MAJOR) {
            $this->log('[OCTANE_FIX] ✓ Swoole 5.x - compatible with Octane v2.13.x');
            return ['status' => 'compatible', 'swoole_version' => $swooleVersion];
        } else {
            $this->log('[OCTANE_FIX] Unknown Swoole version compatibility');
            return ['status' => 'unknown', 'swoole_version' => $swooleVersion];
        }
    }

    /**
     * Get output log
     */
    public function getOutput()
    {
        return implode("\n", $this->output);
    }

    /**
     * Detect Laravel root directory
     */
    private function detectLaravelRoot()
    {
        $currentDir = getcwd();

        while ($currentDir !== '/') {
            if (file_exists($currentDir . '/artisan') && file_exists($currentDir . '/composer.json')) {
                return $currentDir;
            }
            $currentDir = dirname($currentDir);
        }

        return null;
    }

    /**
     * Get Swoole version
     */
    private function getSwooleVersion()
    {
        if (!extension_loaded('swoole')) {
            return null;
        }

        return phpversion('swoole');
    }

    /**
     * Check if patch is already applied
     */
    private function isPatchApplied()
    {
        if (!file_exists($this->swooleServerFile)) {
            return false;
        }

        $content = file_get_contents($this->swooleServerFile);
        return strpos($content, self::PATCH_MARKER) !== false;
    }

    /**
     * Apply the compatibility patch
     */
    private function applyPatch()
    {
        if (!file_exists($this->swooleServerFile)) {
            $this->log('[OCTANE_FIX] Error: swoole-server file not found');
            return false;
        }

        // Create backup
        $backupFile = $this->swooleServerFile . '.bak.' . date('Ymd_His');
        if (!copy($this->swooleServerFile, $backupFile)) {
            $this->log('[OCTANE_FIX] Error: failed to create backup');
            return false;
        }

        $content = file_get_contents($this->swooleServerFile);

        // Old pattern to replace (Swoole 5.x signature)
        $oldPattern = '/\$server->on\(\'task\', fn \(Server \$server, int \$taskId, int \$fromWorkerId, \$data\) =>\s+\$data === \'octane-tick\'\s+\? \$workerState->worker->handleTick\(\)\s+: \$workerState->worker->handleTask\(\$data\)\s+\);/s';

        // New pattern (Swoole 5.x and 6.x compatible)
        $newCode = <<<'PHP'
// Fixed for Swoole 6.x compatibility: task event signature changed
// Swoole 5.x: (Server $server, int $taskId, int $fromWorkerId, $data)
// Swoole 6.x: (Server $server, Server\Task $task)
$server->on('task', function (Server $server, $task) use ($workerState) {
    // Handle both Swoole 5.x and 6.x signatures
    if ($task instanceof Swoole\Server\Task) {
        // Swoole 6.x
        $data = $task->data;
    } else {
        // Swoole 5.x - $task is actually $taskId, need to get data from func_get_args()
        $args = func_get_args();
        $data = $args[3] ?? null;
    }

    return $data === 'octane-tick'
            ? $workerState->worker->handleTick()
            : $workerState->worker->handleTask($data);
});
PHP;

        $content = preg_replace($oldPattern, $newCode, $content);

        // Also fix finish event
        $content = preg_replace(
            '/\$server->on\(\'finish\', fn \(Server \$server, int \$taskId, \$result\) => \$result\);/',
            '$server->on(\'finish\', fn (Server $server, $taskIdOrResult, $result = null) => $result ?? $taskIdOrResult);',
            $content
        );

        if (file_put_contents($this->swooleServerFile, $content) !== false) {
            $this->log('[OCTANE_FIX] Backup created: ' . $backupFile);
            return true;
        } else {
            $this->log('[OCTANE_FIX] Error: failed to write patched file');
            // Restore backup
            copy($backupFile, $this->swooleServerFile);
            return false;
        }
    }

    /**
     * Log message
     */
    private function log($message)
    {
        $this->output[] = $message;
        if (php_sapi_name() === 'cli') {
            echo $message . "\n";
        }
    }
}

// CLI execution
if (php_sapi_name() === 'cli' && isset($argv) && basename($argv[0]) === 'OctaneSwooleCompatFixer.php') {
    $laravelRoot = $argv[1] ?? null;

    try {
        $fixer = new \App\Support\OctaneSwooleCompatFixer($laravelRoot);
        $result = $fixer->run();

        $exitCode = in_array($result['status'], ['fixed', 'already_fixed', 'compatible', 'skipped']) ? 0 : 1;
        exit($exitCode);
    } catch (\Exception $e) {
        echo '[OCTANE_FIX] Error: ' . $e->getMessage() . "\n";
        exit(1);
    }
}
