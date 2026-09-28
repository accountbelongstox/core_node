<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class CheckMigrationSafety extends Command
{
    protected $signature = 'migration:check-safety';
    protected $description = 'Reject migrations that drop or rebuild tables';

    public function handle(): int
    {
        $migrationsPath = database_path('migrations');
        $files = File::glob($migrationsPath . '/*.php');
        $results = [];
        $totalFiles = count($files);
        $safeCount = 0;
        $warningCount = 0;
        $errorCount = 0;

        sort($files);
        $this->info('Checking migration files for safety compliance...');
        $this->newLine();

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
        
        $this->displayResults($results);
        $this->newLine();
        $this->info("Summary: {$safeCount} safe, {$warningCount} warnings, {$errorCount} errors out of {$totalFiles} files");

        return $errorCount > 0 ? Command::FAILURE : Command::SUCCESS;
    }

    private function checkMigrationFile(string $filePath): array
    {
        $fileName = basename($filePath);
        $content = File::get($filePath);
        $upContent = $this->extractUpMethodBody($content);
        $calledMethods = $upContent === null ? [] : $this->calledMethods($upContent);
        $blockedMethods = [
            'drop',
            'dropifexists',
            'dropalltables',
            'dropallviews',
            'dropalltypes',
            'dropdatabase',
            'dropdatabaseifexists',
            'truncate',
        ];
        $result = [
            'file' => $fileName,
            'status' => 'safe',
            'issues' => [],
            'warnings' => [],
        ];
        if ($upContent === null) {
            $result['status'] = 'warning';
            $result['warnings'][] = 'Could not find up() method';
            return $result;
        }

        foreach ($blockedMethods as $method) {
            if (in_array($method, $calledMethods, true)) {
                $result['status'] = 'error';
                $result['issues'][] = "Contains destructive {$method}() in up()";
            }
        }

        if ($this->containsDestructiveTableSql($upContent)) {
            $result['status'] = 'error';
            $result['issues'][] = 'Contains destructive raw table SQL in up()';
        }

        $columnAdjustmentMethods = ['change', 'dropcolumn', 'renamecolumn'];
        if (array_intersect($columnAdjustmentMethods, $calledMethods)
            && !in_array('hascolumn', $calledMethods, true)) {
            $result['status'] = 'error';
            $result['issues'][] = 'Column adjustment is not guarded by hasColumn()';
        }

        if ((in_array('create', $calledMethods, true) || in_array('table', $calledMethods, true))
            && !in_array('hastable', $calledMethods, true)) {
            $result['warnings'][] = 'Table operation is not guarded by hasTable()';
            if ($result['status'] === 'safe') {
                $result['status'] = 'warning';
            }
        }

        return $result;
    }

    private function extractUpMethodBody(string $content): ?string
    {
        $tokens = token_get_all($content);
        $tokenCount = count($tokens);
        $methodFound = false;
        $bodyStarted = false;
        $braceDepth = 0;
        $body = '';
        $index = 0;
        $lookahead = 0;

        for ($index = 0; $index < $tokenCount; $index++) {
            $token = $tokens[$index];

            if (!$methodFound && is_array($token) && $token[0] === T_FUNCTION) {
                for ($lookahead = $index + 1; $lookahead < $tokenCount; $lookahead++) {
                    $next = $tokens[$lookahead];
                    if (is_array($next) && in_array($next[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                        continue;
                    }
                    if ($next === '&') {
                        continue;
                    }
                    if (is_array($next) && $next[0] === T_STRING && strtolower($next[1]) === 'up') {
                        $methodFound = true;
                        $index = $lookahead;
                    }
                    break;
                }
                continue;
            }

            if (!$methodFound) {
                continue;
            }

            if (!$bodyStarted) {
                if ($token === '{') {
                    $bodyStarted = true;
                    $braceDepth = 1;
                }
                continue;
            }

            if ($token === '{') {
                $braceDepth++;
            } elseif ($token === '}') {
                $braceDepth--;
                if ($braceDepth === 0) {
                    return $body;
                }
            }

            $body .= is_array($token) ? $token[1] : $token;
        }

        return null;
    }

    private function calledMethods(string $content): array
    {
        $tokens = token_get_all('<?php ' . $content);
        $methods = [];
        $index = 0;
        $previousIndex = 0;

        foreach ($tokens as $index => $token) {
            if (!is_array($token) || $token[0] !== T_STRING) {
                continue;
            }

            for ($previousIndex = $index - 1; $previousIndex >= 0; $previousIndex--) {
                $previous = $tokens[$previousIndex];
                if (is_array($previous) && in_array($previous[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
                    continue;
                }
                if (is_array($previous) && in_array($previous[0], [T_OBJECT_OPERATOR, T_DOUBLE_COLON], true)) {
                    $methods[] = strtolower($token[1]);
                }
                break;
            }
        }

        return array_values(array_unique($methods));
    }

    private function containsDestructiveTableSql(string $content): bool
    {
        $tokens = token_get_all('<?php ' . $content);
        $destructiveSqlPattern = '/\b(?:drop|truncate)\s+table\b/i';
        $token = null;

        foreach ($tokens as $token) {
            if (!is_array($token)
                || !in_array($token[0], [T_CONSTANT_ENCAPSED_STRING, T_ENCAPSED_AND_WHITESPACE], true)) {
                continue;
            }

            if (preg_match($destructiveSqlPattern, $token[1]) === 1) {
                return true;
            }
        }

        return false;
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
}
