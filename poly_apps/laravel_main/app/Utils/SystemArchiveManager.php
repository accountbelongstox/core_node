<?php

namespace App\Utils;

use Illuminate\Support\Facades\Process;

final class SystemArchiveManager
{
    private const CANDIDATES = ['7z', '7zz', '7za', '7zr'];
    private const WINDOWS_PATHS = [
        'C:\\Program Files\\7-Zip\\7z.exe',
        'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        'D:\\applications\\7-Zip\\7z.exe',
    ];
    private static bool $resolved = false;
    private static ?string $resolvedExecutable = null;

    public static function available(): bool
    {
        return self::executable() !== null;
    }

    public static function executable(): ?string
    {
        if (self::$resolved) {
            return self::$resolvedExecutable;
        }

        $candidates = PHP_OS_FAMILY === 'Windows'
            ? array_merge(self::WINDOWS_PATHS, self::CANDIDATES)
            : self::CANDIDATES;

        foreach ($candidates as $candidate) {
            if (str_contains($candidate, DIRECTORY_SEPARATOR) && !FileSystemManager::isFile($candidate)) {
                continue;
            }
            try {
                $result = Process::timeout(10)->run([$candidate, 'i']);
            } catch (\Throwable) {
                continue;
            }
            if ($result->successful()) {
                self::$resolved = true;
                self::$resolvedExecutable = $candidate;
                return self::$resolvedExecutable;
            }
        }

        self::$resolved = true;
        return self::$resolvedExecutable;
    }

    public static function create7z(string $rootPath, array $relativePaths, string $archivePath): array
    {
        $executable = self::executable();
        $listPath = $archivePath . '.files.txt';
        $normalizedPaths = [];

        if ($executable === null) {
            throw new \RuntimeException('System 7-Zip is not available.');
        }

        foreach ($relativePaths as $relativePath) {
            $normalizedPaths[] = self::sanitizeRelativePath((string) $relativePath);
        }

        FileSystemManager::ensureDirectoryExists(dirname($archivePath));
        FileSystemManager::writeFile($listPath, implode(PHP_EOL, $normalizedPaths));
        $result = Process::path($rootPath)->timeout(3600)->run([
            $executable,
            'a',
            '-t7z',
            '-mx=5',
            '-spf-',
            '-y',
            $archivePath,
            '@' . $listPath,
        ]);
        if (!$result->successful()) {
            throw new \RuntimeException('7-Zip archive creation failed: ' . trim($result->errorOutput() ?: $result->output()));
        }

        return [
            'path' => $archivePath,
            'files' => count($normalizedPaths),
            'size' => (int) FileSystemManager::filesize($archivePath),
            'sha256' => (string) FileSystemManager::hashFile($archivePath),
        ];
    }

    public static function extract7z(string $archivePath, string $destinationPath): int
    {
        $executable = self::executable();

        if ($executable === null) {
            throw new \RuntimeException('System 7-Zip is not available.');
        }

        $listResult = Process::timeout(300)->run([$executable, 'l', '-slt', $archivePath]);
        if (!$listResult->successful()) {
            throw new \RuntimeException('7-Zip archive listing failed.');
        }
        $entryCount = self::validateListing($listResult->output());

        FileSystemManager::ensureDirectoryExists($destinationPath);
        $extractResult = Process::timeout(3600)->run([
            $executable,
            'x',
            $archivePath,
            '-o' . $destinationPath,
            '-spf-',
            '-y',
        ]);
        if (!$extractResult->successful()) {
            throw new \RuntimeException('7-Zip extraction failed: ' . trim($extractResult->errorOutput() ?: $extractResult->output()));
        }

        FileSystemManager::fixPermissionsRecursive($destinationPath);
        return $entryCount;
    }

    public static function sanitizeRelativePath(string $path): string
    {
        $normalized = str_replace('\\', '/', $path);
        $segments = explode('/', $normalized);

        if (
            $normalized === ''
            || str_starts_with($normalized, '/')
            || preg_match('/^[A-Za-z]:\//', $normalized) === 1
            || in_array('..', $segments, true)
        ) {
            throw new \InvalidArgumentException('Invalid relative archive path.');
        }

        foreach ($segments as $segment) {
            $baseName = strtoupper((string) pathinfo($segment, PATHINFO_FILENAME));
            if (
                $segment === ''
                || $segment === '.'
                || preg_match('/[\x00-\x1F<>:"|?*]/u', $segment) === 1
                || str_ends_with($segment, '.')
                || str_ends_with($segment, ' ')
                || preg_match('/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/', $baseName) === 1
            ) {
                throw new \InvalidArgumentException('Resource path is not portable across supported operating systems.');
            }
        }

        return $normalized;
    }

    private static function validateListing(string $listing): int
    {
        $lines = preg_split('/\R/', $listing) ?: [];
        $entriesStarted = false;
        $entryCount = 0;

        foreach ($lines as $line) {
            if (str_starts_with($line, '----------')) {
                $entriesStarted = true;
                continue;
            }
            if (!$entriesStarted || !str_starts_with($line, 'Path = ')) {
                continue;
            }
            self::sanitizeRelativePath(substr($line, 7));
            $entryCount++;
        }

        return $entryCount;
    }
}
