<?php

namespace App\Services\Dashboard;

use App\Apps\ServerManagerV1\ServerManagerV1Utils\ServerManagerV1Utils;
use Carbon\Carbon;

/**
 * Finds the newest modification time among laravel_main source files.
 *
 * Uses a short-lived shell scan (GNU find on Linux, PowerShell on Windows) scoped
 * to code directories and skipping vendor/cache/node_modules/static trees.
 */
class LaravelCodeLastModifiedService
{
    private const SCAN_TIMEOUT_SEC = 3;

    /** Relative roots under base_path() that hold application code. */
    private const SCAN_DIRS = [
        'app',
        'config',
        'routes',
        'database/migrations',
        'bootstrap',
        'scripts',
    ];

    /** Path fragments that must never contribute to the result. */
    private const EXCLUDE_MARKERS = [
        'vendor',
        'node_modules',
        'storage',
        'bootstrap/cache',
        'bootstrap\\cache',
        'public',
        'init_data',
        'laravel_db',
        '.git',
        'seed_data',
        'development-guides',
    ];

    /** Source-like extensions only (skip images, logs, sqlite dumps, etc.). */
    private const CODE_EXTENSIONS = ['php', 'ts', 'tsx', 'js', 'vue', 'sh', 'ps1'];

    /**
     * @return array{
     *   last_modified_at: string|null,
     *   last_modified_unix: int|null,
     *   latest_file: string|null,
     *   scanned_at: string,
     *   scan_ms: int,
     *   method: string
     * }
     */
    public function probe(): array
    {
        $base = base_path();
        $started = microtime(true);

        if (PHP_OS_FAMILY === 'Windows') {
            $hit = $this->probeWindows($base);
            $method = 'powershell';
        } else {
            $hit = $this->probeUnix($base);
            $method = $hit !== null ? 'find' : 'php_fallback';
        }

        if ($hit === null) {
            $hit = $this->probePhpFallback($base);
            $method = 'php_fallback';
        }

        $scanMs = (int) round((microtime(true) - $started) * 1000);
        $payload = [
            'last_modified_at' => null,
            'last_modified_unix' => null,
            'latest_file' => null,
            'scanned_at' => now()->toIso8601String(),
            'scan_ms' => $scanMs,
            'method' => $method,
        ];

        if ($hit === null) {
            return $payload;
        }

        $payload['last_modified_unix'] = $hit['mtime'];
        $payload['last_modified_at'] = Carbon::createFromTimestamp($hit['mtime'])
            ->timezone(config('app.timezone'))
            ->toIso8601String();
        $payload['latest_file'] = $this->toRelativePath($base, $hit['path']);

        return $payload;
    }

    /**
     * @return array{mtime:int,path:string}|null
     */
    private function probeUnix(string $base): ?array
    {
        $roots = [];
        foreach (self::SCAN_DIRS as $dir) {
            $full = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $dir);
            if (is_dir($full)) {
                $roots[] = $full;
            }
        }

        if ($roots === []) {
            return null;
        }

        $nameExpr = ['('];
        foreach (self::CODE_EXTENSIONS as $index => $ext) {
            if ($index > 0) {
                $nameExpr[] = '-o';
            }
            $nameExpr[] = '-name';
            $nameExpr[] = '*.' . $ext;
        }
        $nameExpr[] = ')';

        $args = array_merge(
            $roots,
            ['-type', 'f'],
            $nameExpr,
            ['!', '-path', '*/bootstrap/cache/*']
        );

        foreach (self::EXCLUDE_MARKERS as $marker) {
            $normalized = str_replace('\\', '/', $marker);
            $args[] = '!';
            $args[] = '-path';
            $args[] = '*/' . $normalized . '/*';
        }

        $args[] = '-printf';
        $args[] = '%T@ %p\n';

        $result = ServerManagerV1Utils::executeCommand('find', $args, self::SCAN_TIMEOUT_SEC);

        if (!$result['success'] || trim($result['output']) === '') {
            return null;
        }

        $bestMtime = null;
        $bestPath = null;

        foreach (explode("\n", trim($result['output'])) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $space = strpos($line, ' ');
            if ($space === false) {
                continue;
            }

            $mtime = (int) floor((float) substr($line, 0, $space));
            $path = substr($line, $space + 1);

            if ($bestMtime === null || $mtime > $bestMtime) {
                $bestMtime = $mtime;
                $bestPath = $path;
            }
        }

        if ($bestMtime === null || $bestPath === null) {
            return null;
        }

        return ['mtime' => $bestMtime, 'path' => $bestPath];
    }

    /**
     * @return array{mtime:int,path:string}|null
     */
    private function probeWindows(string $base): ?array
    {
        $dirList = [];
        foreach (self::SCAN_DIRS as $dir) {
            $full = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $dir);
            if (is_dir($full)) {
                $dirList[] = str_replace("'", "''", $full);
            }
        }

        if ($dirList === []) {
            return null;
        }

        $includeList = implode(',', array_map(
            static fn (string $ext): string => "'*." . $ext . "'",
            self::CODE_EXTENSIONS
        ));
        $excludeList = implode(',', array_map(
            static fn (string $marker): string => "'*" . str_replace("'", "''", str_replace('/', '\\', $marker)) . "*'",
            self::EXCLUDE_MARKERS
        ));
        $dirLiteral = implode(',', array_map(static fn (string $p): string => "'" . $p . "'", $dirList));

        $script = '$exclude=@(' . $excludeList . ');'
            . '$items=Get-ChildItem -LiteralPath @(' . $dirLiteral . ') -Recurse -File -Include @(' . $includeList . ') -ErrorAction SilentlyContinue |'
            . 'Where-Object { $p=$_.FullName; -not ($exclude | Where-Object { $p -like $_ }) } |'
            . 'Sort-Object LastWriteTime -Descending | Select-Object -First 1;'
            . 'if ($null -eq $items) { exit 0 };'
            . '$ts=[DateTimeOffset]::new($items.LastWriteTime.ToUniversalTime()).ToUnixTimeSeconds();'
            . 'Write-Output (' . "'{0}|{1}'" . ' -f $ts, $items.FullName)';

        $result = ServerManagerV1Utils::executeCommand(
            'powershell',
            ['-NoProfile', '-NonInteractive', '-Command', $script],
            self::SCAN_TIMEOUT_SEC
        );

        if (trim($result['output']) === '') {
            return null;
        }

        $line = trim(explode("\n", trim($result['output']))[0]);
        $pipe = strpos($line, '|');
        if ($pipe === false) {
            return null;
        }

        $mtime = (int) substr($line, 0, $pipe);
        $path = substr($line, $pipe + 1);

        if ($mtime <= 0 || $path === '') {
            return null;
        }

        return ['mtime' => $mtime, 'path' => $path];
    }

    /**
     * @return array{mtime:int,path:string}|null
     */
    private function probePhpFallback(string $base): ?array
    {
        $bestMtime = null;
        $bestPath = null;

        foreach (self::SCAN_DIRS as $dir) {
            $fullDir = $base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $dir);
            if (!is_dir($fullDir)) {
                continue;
            }

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($fullDir, \RecursiveDirectoryIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $file) {
                if (!$file->isFile()) {
                    continue;
                }

                $path = $file->getPathname();
                if ($this->isExcludedPath($path)) {
                    continue;
                }

                $ext = strtolower($file->getExtension());
                if (!in_array($ext, self::CODE_EXTENSIONS, true)) {
                    continue;
                }

                $mtime = (int) $file->getMTime();
                if ($bestMtime === null || $mtime > $bestMtime) {
                    $bestMtime = $mtime;
                    $bestPath = $path;
                }
            }
        }

        if ($bestMtime === null || $bestPath === null) {
            return null;
        }

        return ['mtime' => $bestMtime, 'path' => $bestPath];
    }

    private function isExcludedPath(string $path): bool
    {
        $normalized = str_replace('\\', '/', strtolower($path));

        foreach (self::EXCLUDE_MARKERS as $marker) {
            $needle = '/' . strtolower(str_replace('\\', '/', $marker)) . '/';
            if (str_contains($normalized, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function toRelativePath(string $base, string $absolute): string
    {
        $baseReal = realpath($base);
        $fileReal = realpath($absolute);

        if ($baseReal === false || $fileReal === false) {
            return str_replace('\\', '/', $absolute);
        }

        $baseNorm = rtrim(str_replace('\\', '/', $baseReal), '/') . '/';
        $fileNorm = str_replace('\\', '/', $fileReal);

        if (str_starts_with($fileNorm, $baseNorm)) {
            return substr($fileNorm, strlen($baseNorm));
        }

        return $fileNorm;
    }
}
