<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class OctaneHotReloadCommand extends Command
{
    protected $signature = 'octane:hot-reload
                            {--interval=3 : File check interval in seconds}
                            {--dirs= : Directories to watch (comma-separated, default: app,config,routes,database,resources)}
                            {--extensions= : File extensions to watch (comma-separated, default: php,env,blade.php,json,yaml,yml)}';

    protected $description = 'Monitor Laravel files and auto-reload Octane on changes (development only)';

    private array $watchDirs = ['app', 'config', 'routes', 'database', 'resources'];
    private array $ignoreDirs = ['vendor', 'node_modules', 'storage', 'public', 'bootstrap/cache', '.git'];
    private array $watchExtensions = ['.php', '.env', '.blade.php', '.json', '.yaml', '.yml'];
    private int $checkInterval = 3;
    private array $fileHashes = [];
    private int $lastRestartTime = 0;
    private int $debounceSeconds = 2;

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('Hot reload is a development-only feature!');
            $this->warn('For production, use the standard 48h auto-restart timer.');
            return 1;
        }

        $this->checkInterval = (int) $this->option('interval');

        if ($dirs = $this->option('dirs')) {
            $this->watchDirs = array_map('trim', explode(',', $dirs));
        }

        if ($exts = $this->option('extensions')) {
            $this->watchExtensions = array_map(function($ext) {
                return '.' . ltrim(trim($ext), '.');
            }, explode(',', $exts));
        }

        $this->info('==========================================================');
        $this->info('Laravel Octane Hot Reload - Development Mode');
        $this->info('==========================================================');
        $this->info('Laravel Root: ' . base_path());
        $this->info('Watching: ' . implode(', ', $this->watchDirs));
        $this->info('Extensions: ' . implode(', ', $this->watchExtensions));
        $this->info('Check Interval: ' . $this->checkInterval . 's');
        $this->info('Ignored: ' . implode(', ', $this->ignoreDirs));
        $this->info('==========================================================');
        $this->info('');

        $this->info('Performing initial file scan...');
        $this->scanAllFiles();
        $this->info('Initial scan complete. Monitoring ' . count($this->fileHashes) . ' files.');
        $this->info('');

        $this->info('Hot reload started. Press Ctrl+C to stop.');
        $this->info('');

        $this->monitorFiles();

        return 0;
    }

    private function scanAllFiles(): void
    {
        $this->fileHashes = [];

        foreach ($this->watchDirs as $dir) {
            $fullPath = base_path($dir);

            if (!is_dir($fullPath)) {
                continue;
            }

            $this->scanDirectory($fullPath);
        }

        $envFile = base_path('.env');
        if (file_exists($envFile)) {
            $this->fileHashes[$envFile] = md5_file($envFile);
        }
    }

    private function scanDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($directory, \RecursiveDirectoryIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }

            $filePath = $file->getPathname();

            if ($this->shouldIgnoreFile($filePath)) {
                continue;
            }

            if ($this->shouldWatchFile($filePath)) {
                $this->fileHashes[$filePath] = md5_file($filePath);
            }
        }
    }

    private function shouldIgnoreFile(string $filepath): bool
    {
        $relativePath = str_replace(base_path() . DIRECTORY_SEPARATOR, '', $filepath);

        foreach ($this->ignoreDirs as $ignoreDir) {
            if (str_starts_with($relativePath, $ignoreDir . DIRECTORY_SEPARATOR) ||
                str_contains($relativePath, DIRECTORY_SEPARATOR . $ignoreDir . DIRECTORY_SEPARATOR)) {
                return true;
            }
        }

        return false;
    }

    private function shouldWatchFile(string $filepath): bool
    {
        foreach ($this->watchExtensions as $ext) {
            if (str_ends_with($filepath, $ext)) {
                return true;
            }
        }

        if (basename($filepath) === '.env') {
            return true;
        }

        return false;
    }

    private function monitorFiles(): void
    {
        while (true) {
            sleep($this->checkInterval);

            $changes = $this->detectChanges();

            if (!empty($changes)) {
                $this->handleChanges($changes);
            }
        }
    }

    private function detectChanges(): array
    {
        $changes = [
            'modified' => [],
            'added' => [],
            'deleted' => []
        ];

        $currentFiles = [];

        foreach ($this->watchDirs as $dir) {
            $fullPath = base_path($dir);

            if (!is_dir($fullPath)) {
                continue;
            }

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($fullPath, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if (!$file->isFile()) {
                    continue;
                }

                $filePath = $file->getPathname();

                if ($this->shouldIgnoreFile($filePath)) {
                    continue;
                }

                if (!$this->shouldWatchFile($filePath)) {
                    continue;
                }

                $currentFiles[$filePath] = true;
                $currentHash = md5_file($filePath);

                if (!isset($this->fileHashes[$filePath])) {
                    $changes['added'][] = $filePath;
                    $this->fileHashes[$filePath] = $currentHash;
                } elseif ($this->fileHashes[$filePath] !== $currentHash) {
                    $changes['modified'][] = $filePath;
                    $this->fileHashes[$filePath] = $currentHash;
                }
            }
        }

        $envFile = base_path('.env');
        if (file_exists($envFile)) {
            $currentFiles[$envFile] = true;
            $currentHash = md5_file($envFile);

            if (!isset($this->fileHashes[$envFile])) {
                $changes['added'][] = $envFile;
                $this->fileHashes[$envFile] = $currentHash;
            } elseif ($this->fileHashes[$envFile] !== $currentHash) {
                $changes['modified'][] = $envFile;
                $this->fileHashes[$envFile] = $currentHash;
            }
        }

        foreach ($this->fileHashes as $filepath => $hash) {
            if (!isset($currentFiles[$filepath])) {
                $changes['deleted'][] = $filepath;
                unset($this->fileHashes[$filepath]);
            }
        }

        return $changes;
    }

    private function handleChanges(array $changes): void
    {
        $currentTime = time();

        if ($currentTime - $this->lastRestartTime < $this->debounceSeconds) {
            return;
        }

        $changeCount = count($changes['modified']) + count($changes['added']) + count($changes['deleted']);

        if ($changeCount === 0) {
            return;
        }

        $phpModified = array_filter($changes['modified'], fn($file) => str_ends_with($file, '.php'));
        $phpAdded = array_filter($changes['added'], fn($file) => str_ends_with($file, '.php'));
        $phpDeleted = array_filter($changes['deleted'], fn($file) => str_ends_with($file, '.php'));
        $phpChangeCount = count($phpModified) + count($phpAdded) + count($phpDeleted);

        $this->warn('');
        $this->warn('[' . date('Y-m-d H:i:s') . '] Detected ' . $changeCount . ' file change(s) (' . $phpChangeCount . ' PHP files)');

        foreach ($changes['modified'] as $file) {
            $isPhp = str_ends_with($file, '.php');
            $this->line('  Modified: ' . $this->getRelativePath($file) . ($isPhp ? ' [PHP]' : ''));
        }

        foreach ($changes['added'] as $file) {
            $isPhp = str_ends_with($file, '.php');
            $this->line('  Added: ' . $this->getRelativePath($file) . ($isPhp ? ' [PHP]' : ''));
        }

        foreach ($changes['deleted'] as $file) {
            $isPhp = str_ends_with($file, '.php');
            $this->line('  Deleted: ' . $this->getRelativePath($file) . ($isPhp ? ' [PHP]' : ''));
        }

        if ($phpChangeCount === 0) {
            $this->info('No PHP files changed, skipping reload.');
            $this->info('');
            return;
        }

        $this->info('Reloading Octane services...');

        if ($this->restartOctaneServices()) {
            $this->info('✓ Octane services reloaded successfully');
            $this->lastRestartTime = $currentTime;
        } else {
            $this->error('✗ Failed to reload Octane services');
        }

        $this->info('');
    }

    private function getRelativePath(string $filepath): string
    {
        return str_replace(base_path() . DIRECTORY_SEPARATOR, '', $filepath);
    }

    private function restartOctaneServices(): bool
    {
        try {
            $output = [];
            $returnCode = 0;

            exec('systemctl list-units --type=service --state=running 2>/dev/null | grep -E "(app-manager-laravel|octane-poly-)" | awk \'{print $1}\'', $output, $returnCode);

            if (empty($output)) {
                $this->warn('No Octane worker services found');
                return false;
            }

            $successCount = 0;
            $failCount = 0;

            foreach ($output as $serviceLine) {
                $serviceLine = trim($serviceLine);

                if (empty($serviceLine)) {
                    continue;
                }

                if (!preg_match('/^(app-manager-laravel[^\s.]+|octane-poly-\d+)\.service$/', $serviceLine, $matches)) {
                    continue;
                }

                $serviceName = $matches[1];

                $restartOutput = [];
                $restartCode = 0;

                exec("sudo systemctl restart {$serviceName} 2>&1", $restartOutput, $restartCode);

                if ($restartCode === 0) {
                    $this->line("  ✓ Restarted {$serviceName}");
                    $successCount++;
                } else {
                    $this->error("  ✗ Failed to restart {$serviceName}: " . implode("\n", $restartOutput));
                    $failCount++;
                }
            }

            return $successCount > 0;

        } catch (\Exception $e) {
            $this->error('Exception during restart: ' . $e->getMessage());
            return false;
        }
    }
}
