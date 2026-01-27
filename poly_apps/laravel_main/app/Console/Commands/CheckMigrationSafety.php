<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * 检查迁移文件安全性
 * 
 * 检查所有迁移文件是否符合安全原则：
 * 1. up()方法中不允许dropTable/dropIfExists
 * 2. up()方法中不允许dropColumn
 * 3. up()方法中不允许truncate/delete所有数据
 * 4. up()方法中应该使用hasTable检查
 * 5. up()方法中应该使用hasColumn检查
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
        
        // 显示结果
        $this->displayResults($results);
        
        // 生成报告
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
        
        // 提取up()方法内容
        if (preg_match('/public\s+function\s+up\(\)\s*:\s*void\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s', $content, $upMatch)) {
            $upContent = $upMatch[1];
            
            // 检查不允许的操作
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
            
            // 检查是否使用了hasTable
            if (!preg_match('/hasTable\s*\(/i', $upContent)) {
                $result['warnings'][] = 'Does not check hasTable() before creating/modifying table';
                if ($result['status'] === 'safe') {
                    $result['status'] = 'warning';
                }
            }
            
            // 检查是否使用了hasColumn（对于修改表的迁移）
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
