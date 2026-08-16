<?php

namespace App\Services;

use Illuminate\Console\Command;

class SystemDependencyInitializer
{
    public function __construct(private readonly Command $command)
    {
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
}
