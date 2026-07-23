<?php

namespace App\Services;

use App\Support\OctaneSwooleCompatFixer;
use Illuminate\Console\Command;

class SystemDependencyInitializer
{
    public function __construct(private readonly Command $command)
    {
    }

    public function fixOctaneSwooleCompatibility(): void
    {
        $fixer = null;
        $result = [];

        if (!is_dir(base_path('vendor/laravel/octane'))) {
            $this->command->line('  <fg=yellow>⏭️  Laravel Octane not installed, skipping</>');
            return;
        }

        try {
            $fixer = new OctaneSwooleCompatFixer(base_path());
            $result = $fixer->run();

            if (($result['status'] ?? '') === 'skipped'
                && ($result['reason'] ?? '') === 'swoole_not_installed'
                && PHP_OS_FAMILY !== 'Windows') {
                $result = $this->ensureSwooleThenRefix($fixer);
            }

            $this->reportSwooleResult($result);
        } catch (\Throwable $e) {
            $this->command->warn('  ⚠️  Compatibility check error: ' . $e->getMessage());
        }
    }

    public function installChokidar(): void
    {
        $laravelPath = base_path();
        $isWindows = PHP_OS_FAMILY === 'Windows';
        $separator = $isWindows ? '\\' : '/';
        $chokidarPath = $laravelPath . $separator . 'node_modules' . $separator . 'chokidar';
        $nodeOutput = [];
        $pnpmOutput = [];
        $installOutput = [];
        $versionOutput = [];
        $testOutput = [];
        $nodeCode = 0;
        $pnpmCode = 0;
        $installCode = 0;
        $testCode = 0;
        $originalDir = null;
        $version = 'unknown';

        $this->command->line('  <fg=cyan>Checking Node.js and pnpm...</>');

        if ($isWindows) {
            exec('where node 2>NUL', $nodeOutput, $nodeCode);
            exec('where pnpm 2>NUL', $pnpmOutput, $pnpmCode);
        } else {
            exec('command -v node 2>&1', $nodeOutput, $nodeCode);
            exec('command -v pnpm 2>&1', $pnpmOutput, $pnpmCode);
        }

        if ($nodeCode !== 0 || $pnpmCode !== 0) {
            $missing = $nodeCode !== 0 ? 'Node.js' : 'pnpm';
            $this->command->warn("  ⚠️  {$missing} not found - hot-reload will not be available");
            return;
        }

        if (!is_dir($chokidarPath)) {
            $this->command->line('  <fg=cyan>Installing chokidar...</>');
            $originalDir = getcwd();

            try {
                chdir($laravelPath);
                exec('pnpm install --save-dev chokidar 2>&1', $installOutput, $installCode);
            } finally {
                if ($originalDir !== false) {
                    chdir($originalDir);
                }
            }

            if ($installCode !== 0) {
                $this->command->warn('  ⚠️  chokidar installation had issues:');
                foreach (array_slice($installOutput, -3) as $line) {
                    $this->command->line('     ' . $line);
                }
                return;
            }
        }

        exec('pnpm list chokidar --depth=0 2>&1', $versionOutput);
        foreach ($versionOutput as $line) {
            if (preg_match('/chokidar@([\d.]+)/i', $line, $matches)) {
                $version = 'chokidar@' . $matches[1];
                break;
            }
        }

        exec('node -e "require(\'chokidar\'); console.log(\'OK\')" 2>&1', $testOutput, $testCode);
        if ($testCode === 0 && trim($testOutput[0] ?? '') === 'OK') {
            $this->command->line("  ✅ chokidar ready: {$version}");
            return;
        }

        $this->command->warn('  ⚠️  chokidar exists but could not be loaded');
    }

    private function ensureSwooleThenRefix(OctaneSwooleCompatFixer $fixer): array
    {
        $repoRoot = dirname(base_path(), 2);
        $installScript = $repoRoot . '/scripts/shells/linux/debian/install_shells/32_install_swoole.sh';
        $exitCode = 0;

        if (!is_file($installScript)) {
            $this->command->warn("  ⚠️  Swoole installer missing: {$installScript}");
            return ['status' => 'skipped', 'reason' => 'swoole_not_installed'];
        }

        $this->command->line('  <fg=cyan>Swoole not installed -> running installer (may take several minutes)...</>');
        passthru('bash ' . escapeshellarg($installScript), $exitCode);

        if ($exitCode !== 0) {
            $this->command->warn("  ⚠️  Swoole installer exited with code {$exitCode}; Octane will be unavailable.");
            return ['status' => 'skipped', 'reason' => 'swoole_not_installed'];
        }

        return $fixer->run();
    }

    private function reportSwooleResult(array $result): void
    {
        $status = $result['status'] ?? 'unknown';
        $version = $result['swoole_version'] ?? 'unknown';
        $reason = $result['reason'] ?? 'unknown reason';

        match ($status) {
            'fixed' => $this->command->line("  ✅ Compatibility patch applied (Swoole {$version})"),
            'already_fixed' => $this->command->line("  ✓ Compatibility patch already applied (Swoole {$version})"),
            'compatible' => $this->command->line("  ✓ Swoole {$version} is compatible"),
            'skipped' => $this->command->line("  ⏭️  Compatibility check skipped: {$reason}"),
            default => $this->command->warn("  ⚠️  Unexpected Swoole compatibility status: {$status}"),
        };
    }
}
