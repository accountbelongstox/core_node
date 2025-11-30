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


namespace App\Console\Commands;

use App\Helpers\ExternalStorageHelper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ExternalStorageCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'storage:external 
                            {action : Action to perform (create, validate, info, clean)}
                            {--type=* : Storage type(s) to operate on (upload, static, backup, cache, updates, logs, temp)}
                            {--force : Force operation without confirmation}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Manage external storage directories';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $action = $this->argument('action');
        $types = $this->option('type') ?: ['upload', 'static', 'backup', 'cache', 'updates', 'logs', 'temp'];

        switch ($action) {
            case 'create':
                $this->createDirectories($types);
                break;
            case 'validate':
                $this->validateDirectories($types);
                break;
            case 'info':
                $this->showInfo($types);
                break;
            case 'clean':
                $this->cleanDirectories($types);
                break;
            default:
                $this->error("Unknown action: {$action}");
                return 1;
        }

        return 0;
    }

    /**
     * Create external storage directories
     */
    private function createDirectories(array $types): void
    {
        $this->info('Creating external storage directories...');

        foreach ($types as $type) {
            try {
                $path = ExternalStorageHelper::getPath($type);
                $this->line("✓ {$type}: {$path}");
            } catch (\Exception $e) {
                $this->error("✗ {$type}: {$e->getMessage()}");
            }
        }

        $this->info('External storage directories created successfully!');
    }

    /**
     * Validate external storage directories
     */
    private function validateDirectories(array $types): void
    {
        $this->info('Validating external storage directories...');

        $validation = ExternalStorageHelper::validatePaths();
        $allValid = true;

        foreach ($types as $type) {
            if (!isset($validation[$type])) {
                $this->error("✗ {$type}: Not configured");
                $allValid = false;
                continue;
            }

            $result = $validation[$type];
            $status = $result['valid'] ? '✓' : '✗';
            $this->line("{$status} {$type}: {$result['path']}");

            if (!$result['exists']) {
                $this->line("  - Directory does not exist");
            }
            if (!$result['writable']) {
                $this->line("  - Directory is not writable");
            }
        }

        if ($allValid) {
            $this->info('All external storage directories are valid!');
        } else {
            $this->warn('Some external storage directories have issues.');
        }
    }

    /**
     * Show information about external storage
     */
    private function showInfo(array $types): void
    {
        $this->info('External Storage Information');
        $this->line('OS: ' . ExternalStorageHelper::getOS());
        $this->line('');

        foreach ($types as $type) {
            try {
                $path = ExternalStorageHelper::getPath($type);
                $exists = File::exists($path);
                $writable = is_writable($path);
                $size = $exists ? $this->formatSize($this->getDirectorySize($path)) : 'N/A';

                $this->line("{$type}:");
                $this->line("  Path: {$path}");
                $this->line("  Exists: " . ($exists ? 'Yes' : 'No'));
                $this->line("  Writable: " . ($writable ? 'Yes' : 'No'));
                $this->line("  Size: {$size}");
                $this->line('');
            } catch (\Exception $e) {
                $this->error("{$type}: {$e->getMessage()}");
            }
        }
    }

    /**
     * Clean external storage directories
     */
    private function cleanDirectories(array $types): void
    {
        if (!$this->option('force')) {
            if (!$this->confirm('This will delete all files in the specified directories. Are you sure?')) {
                $this->info('Operation cancelled.');
                return;
            }
        }

        $this->info('Cleaning external storage directories...');

        foreach ($types as $type) {
            try {
                $path = ExternalStorageHelper::getPath($type);
                
                if (File::exists($path)) {
                    $files = File::allFiles($path);
                    $count = count($files);
                    
                    foreach ($files as $file) {
                        File::delete($file->getPathname());
                    }
                    
                    $this->line("✓ {$type}: Deleted {$count} files from {$path}");
                } else {
                    $this->line("✓ {$type}: Directory does not exist ({$path})");
                }
            } catch (\Exception $e) {
                $this->error("✗ {$type}: {$e->getMessage()}");
            }
        }

        $this->info('External storage directories cleaned successfully!');
    }

    /**
     * Get directory size recursively
     */
    private function getDirectorySize(string $path): int
    {
        $size = 0;
        $files = File::allFiles($path);
        
        foreach ($files as $file) {
            $size += $file->getSize();
        }
        
        return $size;
    }

    /**
     * Format file size
     */
    private function formatSize(int $size): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $power = $size > 0 ? floor(log($size, 1024)) : 0;
        return number_format($size / pow(1024, $power), 2, '.', ',') . ' ' . $units[$power];
    }
} 