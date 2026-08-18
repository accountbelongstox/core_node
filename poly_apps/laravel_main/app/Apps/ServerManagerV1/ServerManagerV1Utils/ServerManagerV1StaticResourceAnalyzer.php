<?php

namespace App\Apps\ServerManagerV1\ServerManagerV1Utils;

use App\Providers\PathMapper;
use Illuminate\Support\Facades\Cache;

/**
 * Scans laravel_db/static for file counts and sizes (audio, video, images, etc.).
 */
class ServerManagerV1StaticResourceAnalyzer
{
    private const SCAN_FILE_LIMIT = 100000;

    /** The full analyze() scan shells out to `du` per directory - cache the summary. */
    private const SUMMARY_CACHE_KEY = 'servermanager:static_resources_summary';

    private const SUMMARY_CACHE_TTL_SEC = 30;

    private const TYPE_EXTENSIONS = [
        'audio' => ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'],
        'video' => ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'ts'],
        'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp'],
        'document' => ['pdf', 'txt', 'json', 'epub', 'md', 'csv', 'xml', 'html'],
    ];

    /** Relative paths under static/ that vocabulary & media features use. */
    private const KNOWN_SUBDIRS = [
        'app_qy_v1/audio' => 'Word & sentence audio',
        'app_qy_v1/word_images' => 'Word images',
        'app_qy_v1/covers' => 'Library covers',
        'app_qy_v1/posters' => 'Posters',
        'app_qy_v1/post_images' => 'Post images',
        'app_qy_v1/post_videos' => 'Post videos',
        'media' => 'Media clips & AI audio',
    ];

    public function analyze(): array
    {
        return Cache::remember(self::SUMMARY_CACHE_KEY, self::SUMMARY_CACHE_TTL_SEC, function () {
            $summary = $this->analyzeUncached();
            $summary['generated_at'] = now()->toIso8601String();
            return $summary;
        });
    }

    private function analyzeUncached(): array
    {
        $basePath = PathMapper::getStaticPath();
        $dataDir = PathMapper::mapWebPath('laravel_data_dir');

        if (!$basePath || !is_dir($basePath)) {
            return [
                'base_path' => $basePath,
                'exists' => false,
                'total_size_bytes' => 0,
                'total_size_human' => '0 B',
                'total_files' => 0,
                'total_directories' => 0,
                'truncated' => false,
                'by_type' => $this->emptyTypeBuckets(),
                'by_subdirectory' => [],
                'laravel_data_dir' => $dataDir,
                'laravel_data_dir_size_bytes' => 0,
                'laravel_data_dir_size_human' => '0 B',
                'static_percent_of_data_dir' => 0,
            ];
        }

        $totalSizeBytes = $this->directorySizeBytes($basePath);
        $dataDirSizeBytes = is_dir($dataDir) ? $this->directorySizeBytes($dataDir) : 0;

        $walk = $this->walkFiles($basePath);

        $bySubdir = [];
        foreach (self::KNOWN_SUBDIRS as $relative => $label) {
            $full = $basePath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relative);
            $exists = is_dir($full);
            $sizeBytes = $exists ? $this->directorySizeBytes($full) : 0;
            $bySubdir[] = [
                'path' => $relative,
                'label' => $label,
                'exists' => $exists,
                'files' => $exists ? $this->countFilesUnder($full) : 0,
                'size_bytes' => $sizeBytes,
                'size_human' => ServerManagerV1Utils::formatFileSize($sizeBytes),
            ];
        }

        $staticPercent = $dataDirSizeBytes > 0
            ? round(($totalSizeBytes / $dataDirSizeBytes) * 100, 1)
            : 0;

        $dataDirBreakdown = $this->analyzeDataDirBreakdown($dataDir, $basePath, $totalSizeBytes);

        return [
            'base_path' => $basePath,
            'exists' => true,
            'total_size_bytes' => $totalSizeBytes,
            'total_size_human' => ServerManagerV1Utils::formatFileSize($totalSizeBytes),
            'total_files' => $walk['total_files'],
            'total_directories' => $walk['total_directories'],
            'truncated' => $walk['truncated'],
            'by_type' => $walk['by_type'],
            'by_subdirectory' => $bySubdir,
            'laravel_data_dir' => $dataDir,
            'laravel_data_dir_size_bytes' => $dataDirSizeBytes,
            'laravel_data_dir_size_human' => ServerManagerV1Utils::formatFileSize($dataDirSizeBytes),
            'static_percent_of_data_dir' => $staticPercent,
            'data_dir_breakdown' => $dataDirBreakdown['items'],
            'data_dir_accounted_bytes' => $dataDirBreakdown['accounted_bytes'],
            'data_dir_accounted_human' => ServerManagerV1Utils::formatFileSize($dataDirBreakdown['accounted_bytes']),
            'data_dir_unaccounted_bytes' => $dataDirBreakdown['unaccounted_bytes'],
            'data_dir_unaccounted_human' => ServerManagerV1Utils::formatFileSize($dataDirBreakdown['unaccounted_bytes']),
        ];
    }

    /**
     * Paginated flat file list under a static subdirectory (search + sort).
     */
    public function listFiles(
        string $relativePath,
        string $query = '',
        string $sort = 'name',
        string $order = 'asc',
        int $page = 1,
        int $perPage = 100
    ): array {
        $basePath = PathMapper::getStaticPath();
        $safePath = $this->resolveSafeStaticPath($relativePath);

        if (!$basePath || !$safePath || !is_dir($safePath)) {
            return [
                'path' => $relativePath,
                'exists' => false,
                'total' => 0,
                'page' => $page,
                'per_page' => $perPage,
                'sort' => $sort,
                'order' => $order,
                'q' => $query,
                'files' => [],
            ];
        }

        $perPage = max(10, min(500, $perPage));
        $page = max(1, $page);
        $query = trim($query);

        $files = $this->collectFilesFlat($safePath, $relativePath);

        if ($query !== '') {
            $needle = strtolower($query);
            $files = array_values(array_filter($files, function ($file) use ($needle) {
                return str_contains(strtolower($file['name']), $needle)
                    || str_contains(strtolower($file['path']), $needle);
            }));
        }

        $allowedSort = ['name', 'size', 'modified'];
        if (!in_array($sort, $allowedSort, true)) {
            $sort = 'name';
        }
        $order = strtolower($order) === 'desc' ? 'desc' : 'asc';

        usort($files, function ($a, $b) use ($sort, $order) {
            $cmp = match ($sort) {
                'size' => $a['size_bytes'] <=> $b['size_bytes'],
                'modified' => strcmp($a['modified'] ?? '', $b['modified'] ?? ''),
                default => strcasecmp($a['name'], $b['name']),
            };
            return $order === 'desc' ? -$cmp : $cmp;
        });

        $total = count($files);
        $offset = ($page - 1) * $perPage;
        $pageFiles = array_slice($files, $offset, $perPage);

        return [
            'path' => $relativePath,
            'exists' => true,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
            'sort' => $sort,
            'order' => $order,
            'q' => $query,
            'files' => $pageFiles,
        ];
    }

    private function analyzeDataDirBreakdown(string $dataDir, string $staticPath, int $staticSizeBytes): array
    {
        if (!$dataDir || !is_dir($dataDir)) {
            return ['items' => [], 'accounted_bytes' => 0, 'unaccounted_bytes' => 0];
        }

        $totalDirBytes = $this->directorySizeBytes($dataDir);

        $candidates = [
            ['key' => 'static', 'label' => 'Static resources (static/)', 'path' => $staticPath, 'is_file' => false],
            ['key' => 'database', 'label' => 'SQLite database', 'path' => $dataDir . '/database.sqlite', 'is_file' => true],
            ['key' => 'external_data', 'label' => 'External data', 'path' => $dataDir . '/external_data', 'is_file' => false],
            ['key' => 'avatars', 'label' => 'Avatars', 'path' => PathMapper::getLaravelAvatarsDir(), 'is_file' => false],
            ['key' => 'uploads', 'label' => 'Uploads', 'path' => PathMapper::getLaravelUploadsDir(), 'is_file' => false],
            ['key' => 'cache', 'label' => 'Cache', 'path' => PathMapper::getLaravelCacheDir(), 'is_file' => false],
            ['key' => 'logs', 'label' => 'Logs', 'path' => PathMapper::getLaravelLogsDir(), 'is_file' => false],
            ['key' => 'tts_data', 'label' => 'Legacy TTS data', 'path' => PathMapper::getTTSDataDir(), 'is_file' => false],
            ['key' => 'sessions', 'label' => 'Sessions', 'path' => PathMapper::getLaravelSessionsDir(), 'is_file' => false],
            ['key' => 'tmp', 'label' => 'Temp files', 'path' => PathMapper::getLaravelTmpDir(), 'is_file' => false],
        ];

        $items = [];
        $accounted = 0;
        $seenPaths = [];

        foreach ($candidates as $candidate) {
            $path = $candidate['path'];
            if (!$path || isset($seenPaths[$path])) {
                continue;
            }
            $seenPaths[$path] = true;

            $exists = !empty($candidate['is_file']) ? is_file($path) : is_dir($path);
            if (!$exists) {
                continue;
            }

            $sizeBytes = !empty($candidate['is_file']) ? (int) filesize($path) : $this->directorySizeBytes($path);
            if ($candidate['key'] === 'static') {
                $sizeBytes = $staticSizeBytes;
            }

            $accounted += $sizeBytes;
            $items[] = [
                'key' => $candidate['key'],
                'label' => $candidate['label'],
                'path' => $path,
                'exists' => true,
                'size_bytes' => $sizeBytes,
                'size_human' => ServerManagerV1Utils::formatFileSize($sizeBytes),
            ];
        }

        // Top-level entries not already accounted for
        try {
            foreach (scandir($dataDir) as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $full = $dataDir . DIRECTORY_SEPARATOR . $entry;
                if (isset($seenPaths[$full])) {
                    continue;
                }
                $sizeBytes = is_file($full) ? (int) filesize($full) : $this->directorySizeBytes($full);
                if ($sizeBytes <= 0) {
                    continue;
                }
                $accounted += $sizeBytes;
                $items[] = [
                    'key' => 'other_' . $entry,
                    'label' => $entry,
                    'path' => $full,
                    'exists' => true,
                    'size_bytes' => $sizeBytes,
                    'size_human' => ServerManagerV1Utils::formatFileSize($sizeBytes),
                ];
            }
        } catch (\Throwable $e) {
            // ignore scan errors
        }

        usort($items, fn ($a, $b) => $b['size_bytes'] <=> $a['size_bytes']);

        return [
            'items' => $items,
            'accounted_bytes' => min($accounted, $totalDirBytes),
            'unaccounted_bytes' => max(0, $totalDirBytes - min($accounted, $totalDirBytes)),
        ];
    }

    private function resolveSafeStaticPath(string $relativePath): ?string
    {
        $basePath = PathMapper::getStaticPath();
        if (!$basePath || !is_dir($basePath)) {
            return null;
        }

        $relativePath = trim(str_replace('\\', '/', $relativePath), '/');
        $fullPath = $basePath . ($relativePath !== '' ? DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath) : '');

        $realBase = realpath($basePath);
        $realFull = realpath($fullPath);

        if (!$realBase || !$realFull || !str_starts_with($realFull, $realBase)) {
            return null;
        }

        return $realFull;
    }

    /** @return list<array{name:string,path:string,size_bytes:int,size_human:string,modified:string,extension:string}> */
    private function collectFilesFlat(string $absoluteDir, string $relativePrefix): array
    {
        $files = [];
        $realBase = realpath(PathMapper::getStaticPath()) ?: '';

        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($absoluteDir, \FilesystemIterator::SKIP_DOTS)
            );

            foreach ($iterator as $item) {
                if (!$item->isFile()) {
                    continue;
                }

                $fullPath = $item->getPathname();
                $realFull = realpath($fullPath) ?: $fullPath;
                $relFromStatic = $realBase !== ''
                    ? ltrim(str_replace('\\', '/', substr($realFull, strlen($realBase))), '/')
                    : basename($fullPath);
                $sizeBytes = (int) $item->getSize();
                $ext = strtolower(pathinfo($item->getFilename(), PATHINFO_EXTENSION));

                $files[] = [
                    'name' => $item->getFilename(),
                    'path' => $relFromStatic,
                    'size_bytes' => $sizeBytes,
                    'size_human' => ServerManagerV1Utils::formatFileSize($sizeBytes),
                    'modified' => date('Y-m-d H:i:s', $item->getMTime()),
                    'extension' => $ext,
                ];
            }
        } catch (\Throwable $e) {
            return [];
        }

        return $files;
    }

    private function emptyTypeBuckets(): array
    {
        $buckets = [];
        foreach (array_keys(self::TYPE_EXTENSIONS) as $type) {
            $buckets[$type] = ['count' => 0, 'size_bytes' => 0, 'size_human' => '0 B'];
        }
        $buckets['other'] = ['count' => 0, 'size_bytes' => 0, 'size_human' => '0 B'];
        return $buckets;
    }

    private function walkFiles(string $rootPath): array
    {
        $byType = $this->emptyTypeBuckets();
        $totalFiles = 0;
        $totalDirectories = 0;
        $truncated = false;

        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($rootPath, \FilesystemIterator::SKIP_DOTS),
                \RecursiveIteratorIterator::SELF_FIRST
            );

            foreach ($iterator as $item) {
                if ($item->isDir()) {
                    $totalDirectories++;
                    continue;
                }

                $totalFiles++;
                if ($totalFiles > self::SCAN_FILE_LIMIT) {
                    $truncated = true;
                    break;
                }

                $size = $item->getSize();
                $ext = strtolower(pathinfo($item->getFilename(), PATHINFO_EXTENSION));
                $category = $this->resolveCategory($ext);

                $byType[$category]['count']++;
                $byType[$category]['size_bytes'] += $size;
            }
        } catch (\Throwable $e) {
            // Partial results are still useful for the dashboard.
        }

        foreach ($byType as $key => $bucket) {
            $byType[$key]['size_human'] = ServerManagerV1Utils::formatFileSize($bucket['size_bytes']);
        }

        return [
            'total_files' => min($totalFiles, self::SCAN_FILE_LIMIT),
            'total_directories' => $totalDirectories,
            'truncated' => $truncated,
            'by_type' => $byType,
        ];
    }

    private function resolveCategory(string $ext): string
    {
        foreach (self::TYPE_EXTENSIONS as $type => $extensions) {
            if (in_array($ext, $extensions, true)) {
                return $type;
            }
        }
        return 'other';
    }

    private function directorySizeBytes(string $path): int
    {
        if (!is_dir($path)) {
            return 0;
        }

        $result = ServerManagerV1Utils::executeCommand('du', ['-sb', $path]);
        if ($result['success']) {
            $parts = explode("\t", trim($result['output']));
            return (int) ($parts[0] ?? 0);
        }

        return 0;
    }

    private function countFilesUnder(string $path): int
    {
        $count = 0;
        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($path, \FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iterator as $item) {
                if ($item->isFile()) {
                    $count++;
                }
            }
        } catch (\Throwable $e) {
            return 0;
        }
        return $count;
    }
}
