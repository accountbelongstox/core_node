<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Check migration file safety
 *
 * Checks whether all migration files comply with the safety principles:
 * 1. dropTable/dropIfExists is not allowed in the up() method
 * 2. dropColumn is not allowed in the up() method
 * 3. truncate/delete of all data is not allowed in the up() method
 * 4. hasTable check should be used in the up() method
 * 5. hasColumn check should be used in the up() method
 */
class CheckMigrationSafety extends Command
{
    protected $signature = 'migration:check-safety';
    protected $description = 'Check all migration files for safety compliance';

    public function handle()
    {
        $migrationsPath = database_path('migrations');
        $files = File::glob($migrationsPath . '/*.php');
        
        $this->info('Checking migration files for safety compliance...');
        $this->newLine();
        
        $results = [];
        $totalFiles = count($files);
        $safeCount = 0;
        $warningCount = 0;
        $errorCount = 0;
        
        foreach ($files as $file) {
            $fileName = basename($file);
            $result = $this->checkMigrationFile($file);
            $results[$fileName] = $result;
            
            if ($result['status'] === 'safe') {
                $safeCount++;
            } elseif ($result['status'] === 'warning') {
                $warningCount++;
            } else {
                $errorCount++;
            }
        }
        
        // Display the results
        $this->displayResults($results);

        // Generate the report
        $this->generateReport($results);
        
        $this->newLine();
        $this->info("Summary: {$safeCount} safe, {$warningCount} warnings, {$errorCount} errors out of {$totalFiles} files");
        
        return $errorCount > 0 ? 1 : 0;
    }
    
    private function checkMigrationFile(string $filePath): array
    {
        $fileName = basename($filePath);
        $content = File::get($filePath);
        
        $result = [
            'file' => $fileName,
            'status' => 'safe',
            'issues' => [],
            'warnings' => [],
        ];
        
        // Extract the up() method content
        if (preg_match('/public\s+function\s+up\(\)\s*:\s*void\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s', $content, $upMatch)) {
            $upContent = $upMatch[1];
            
            // Check for disallowed operations
            if (preg_match('/dropTable\s*\(|dropIfExists\s*\(/i', $upContent)) {
                $result['status'] = 'error';
                $result['issues'][] = 'Contains dropTable/dropIfExists in up() method';
            }
            
            if (preg_match('/dropColumn\s*\(/i', $upContent)) {
                $result['status'] = 'error';
                $result['issues'][] = 'Contains dropColumn in up() method';
            }
            
            if (preg_match('/truncate\s*\(/i', $upContent)) {
                $result['status'] = 'error';
                $result['issues'][] = 'Contains truncate in up() method';
            }
            
            // Check whether hasTable is used
            if (!preg_match('/hasTable\s*\(/i', $upContent)) {
                $result['warnings'][] = 'Does not check hasTable() before creating/modifying table';
                if ($result['status'] === 'safe') {
                    $result['status'] = 'warning';
                }
            }
            
            // Check whether hasColumn is used (for migrations that modify tables)
            if (preg_match('/table\s*\(/i', $upContent) && !preg_match('/hasColumn\s*\(/i', $upContent)) {
                $result['warnings'][] = 'Modifies table but does not check hasColumn()';
                if ($result['status'] === 'safe') {
                    $result['status'] = 'warning';
                }
            }
        } else {
            $result['warnings'][] = 'Could not find up() method';
            if ($result['status'] === 'safe') {
                $result['status'] = 'warning';
            }
        }
        
        return $result;
    }
    
    private function displayResults(array $results): void
    {
        $this->table(
            ['File', 'Status', 'Issues'],
            array_map(function ($result) {
                $statusIcon = match($result['status']) {
                    'safe' => '✅',
                    'warning' => '⚠️',
                    'error' => '❌',
                    default => '○'
                };
                
                $issues = array_merge($result['issues'], $result['warnings']);
                $issuesText = !empty($issues) ? implode('; ', $issues) : 'None';
                
                return [
                    $result['file'],
                    $statusIcon . ' ' . strtoupper($result['status']),
                    $issuesText
                ];
            }, $results)
        );
    }
    
    private function generateReport(array $results): void
    {
        $reportPath = base_path('MIGRATION_SAFETY_REPORT.md');
        $report = "# Migration Safety Report\n\n";
        $report .= "Generated: " . date('Y-m-d H:i:s') . "\n\n";
        
        $report .= "## Summary\n\n";
        $safeCount = count(array_filter($results, fn($r) => $r['status'] === 'safe'));
        $warningCount = count(array_filter($results, fn($r) => $r['status'] === 'warning'));
        $errorCount = count(array_filter($results, fn($r) => $r['status'] === 'error'));
        $totalCount = count($results);
        
        $report .= "- Total files: {$totalCount}\n";
        $report .= "- ✅ Safe: {$safeCount}\n";
        $report .= "- ⚠️  Warnings: {$warningCount}\n";
        $report .= "- ❌ Errors: {$errorCount}\n\n";
        
        $report .= "## Detailed Results\n\n";
        
        foreach ($results as $result) {
            $statusIcon = match($result['status']) {
                'safe' => '✅',
                'warning' => '⚠️',
                'error' => '❌',
                default => '○'
            };
            
            $report .= "### {$statusIcon} {$result['file']}\n\n";
            $report .= "**Status:** " . strtoupper($result['status']) . "\n\n";
            
            if (!empty($result['issues'])) {
                $report .= "**Issues:**\n";
                foreach ($result['issues'] as $issue) {
                    $report .= "- ❌ {$issue}\n";
                }
                $report .= "\n";
            }
            
            if (!empty($result['warnings'])) {
                $report .= "**Warnings:**\n";
                foreach ($result['warnings'] as $warning) {
                    $report .= "- ⚠️  {$warning}\n";
                }
                $report .= "\n";
            }
            
            if (empty($result['issues']) && empty($result['warnings'])) {
                $report .= "✅ No issues found\n\n";
            }
        }
        
        File::put($reportPath, $report);
        $this->info("Report generated: {$reportPath}");
    }
}
