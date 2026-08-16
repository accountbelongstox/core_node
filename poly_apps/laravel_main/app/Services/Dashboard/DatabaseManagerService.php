<?php

namespace App\Services\Dashboard;

use App\Providers\AppTablePrefixServiceProvider;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Schema;

/**
 * PostgreSQL database management for the dashboard:
 * connection enumeration, status, table listing + browse, export/import, and
 * backup/restore. All credentials come from config (which reads RuntimeConfigurationStore),
 * never hardcoded; all backup artifacts live under PathMapper::getBackupDir().
 *
 * Security: connection names and table names are always validated against a live
 * whitelist (the configured poly connections and that connection's actual table
 * listing) before use, and shell tools are invoked via the Process facade with
 * array args (no shell string) and the password passed through PGPASSWORD --
 * never on argv.
 */
class DatabaseManagerService
{
    /** Sub-directory under the backup dir where dumps + manifests are stored. */
    private const BACKUP_SUBDIR = 'db-manager';

    // ---------------------------------------------------------------- connections

    /**
     * Enumerate the manageable databases: the main (default) database plus every
     * registered sub-app whose connection is actually configured and distinct.
     */
    public static function connections(): array
    {
        $out = [];
        $mainConn = (string) config('database.default');
        $out[] = self::descriptor('main', 'Core (main)', $mainConn, '', true);

        $seen = [$mainConn => true];
        foreach (AppTablePrefixServiceProvider::getAppKeys() as $appKey) {
            try {
                $conn = AppTablePrefixServiceProvider::getConnection($appKey);
            } catch (\Throwable $e) {
                continue;
            }
            if (isset($seen[$conn]) || !config("database.connections.{$conn}")) {
                continue;
            }
            $seen[$conn] = true;

            $name = $appKey;
            $prefix = '';
            try {
                $cfg = AppTablePrefixServiceProvider::getAppConfig($appKey);
                $name = $cfg['name'] ?? $appKey;
                $prefix = AppTablePrefixServiceProvider::getPrefix($appKey);
            } catch (\Throwable $e) {
                // fall back to the raw key
            }
            $out[] = self::descriptor($appKey, $name, $conn, $prefix, false);
        }

        return $out;
    }

    public static function physicalConnections(): array
    {
        $connections = [];
        $seen = [];

        foreach (self::connections() as $descriptor) {
            $identity = self::connectionIdentity((string) $descriptor['connection']);
            if (isset($seen[$identity])) {
                continue;
            }
            $seen[$identity] = true;
            $connections[] = $descriptor;
        }

        return $connections;
    }

    private static function connectionIdentity(string $connection): string
    {
        $config = (array) config("database.connections.{$connection}", []);
        $identity = [
            'driver' => $config['driver'] ?? null,
            'host' => $config['host'] ?? null,
            'port' => $config['port'] ?? null,
            'database' => $config['database'] ?? null,
            'schema' => $config['search_path'] ?? ($config['schema'] ?? null),
        ];

        return hash('sha256', (string) json_encode($identity, JSON_UNESCAPED_SLASHES));
    }

    private static function descriptor(string $key, string $name, string $conn, string $prefix, bool $isMain): array
    {
        $database = config("database.connections.{$conn}.database");

        return [
            'key' => $key,
            'name' => $name,
            'connection' => $conn,
            'driver' => 'pgsql',
            'database' => is_string($database) ? basename($database) : (string) $database,
            'is_main' => $isMain,
            'prefix' => $prefix,
        ];
    }

    /**
     * Validate a connection against the whitelist; returns its descriptor.
     * Accepts either the descriptor key or the Laravel connection name.
     */
    public static function resolve(string $connection): array
    {
        foreach (self::connections() as $desc) {
            if ($desc['connection'] === $connection || $desc['key'] === $connection) {
                return $desc;
            }
        }
        throw new \InvalidArgumentException("Unknown or unmanaged connection: {$connection}");
    }

    /** Normalize a descriptor key or connection name to the Laravel connection name. */
    public static function connectionName(string $keyOrConnection): string
    {
        return self::resolve($keyOrConnection)['connection'];
    }

    // -------------------------------------------------------------------- status

    /** Status for one connection: reachability, driver, size, table count, version. */
    public static function status(string $connection): array
    {
        $desc = self::resolve($connection);
        $driver = $desc['driver'];
        $reachable = false;
        $size = null;
        $tableCount = 0;
        $version = null;

        try {
            $db = DB::connection($connection);
            $db->getPdo();
            $reachable = true;
            $version = (string) $db->getPdo()->getAttribute(\PDO::ATTR_SERVER_VERSION);
            $tableCount = count(Schema::connection($connection)->getTableListing());
            $size = self::databaseSizeBytes($connection);
        } catch (\Throwable $e) {
            // unreachable -> defaults
        }

        return [
            'connection' => $connection,
            'driver' => $driver,
            'database' => $desc['database'],
            'reachable' => $reachable,
            'size_bytes' => $size,
            'size_human' => self::humanSize($size),
            'table_count' => $tableCount,
            'server_version' => $version,
        ];
    }

    /** PostgreSQL database size in bytes; null when unavailable. */
    private static function databaseSizeBytes(string $connection): ?int
    {
        try {
            $row = DB::connection($connection)->selectOne('SELECT pg_database_size(current_database()) AS size');
            return $row ? (int) $row->size : null;
        } catch (\Throwable $e) {
            // ignore
        }
        return null;
    }

    // -------------------------------------------------------------------- tables

    /** List tables with row counts; flags app (prefixed) tables vs framework tables. */
    public static function tables(string $connection): array
    {
        $desc = self::resolve($connection);
        $prefix = $desc['prefix'];
        $names = Schema::connection($connection)->getTableListing();
        sort($names);

        // Best-effort per-table "last activity" timestamps: one
        // cheap pg_stat_user_tables scan. Vacuum/analyze times trail writes,
        // so GREATEST of them is a usable write-recency proxy — PostgreSQL has
        // no exact per-table modification timestamp. Null for never-touched
        // tables; the dashboard uses it for sorting only.
        $activity = [];
        try {
            $statRows = DB::connection($connection)->select(
                'SELECT relname, GREATEST(last_vacuum, last_autovacuum, last_analyze, last_autoanalyze) AS activity_at'
                . ' FROM pg_stat_user_tables'
            );
            foreach ($statRows as $statRow) {
                $activity[$statRow->relname] = $statRow->activity_at;
            }
        } catch (\Throwable $e) {
            // stats unavailable -> all activity_at stay null
        }

        $tables = [];
        foreach ($names as $raw) {
            $name = self::bareName($raw);
            $rows = 0;
            try {
                $rows = (int) DB::connection($connection)->table($name)->count();
            } catch (\Throwable $e) {
                $rows = -1; // count failed (e.g. permission); surface as unknown
            }
            $tables[] = [
                'name' => $name,
                'rows' => $rows,
                'is_app_table' => $prefix !== '' && str_starts_with($name, $prefix . '_'),
                'activity_at' => $activity[$name] ?? null,
            ];
        }

        return $tables;
    }

    public static function structure(string $connection, string $table): array
    {
        // Shape is aligned with the (merged) db-viewer: nullable as YES|NO,
        // key=PRI for primary-key columns, extra=auto_increment. The dashboard
        // renders one schema grid for both features.
        self::assertTable($connection, $table);
        $schema = Schema::connection($connection);
        $columns = $schema->getColumns($table);

        $primaryKeyColumns = [];
        foreach ($schema->getIndexes($table) as $index) {
            if (!empty($index['primary'])) {
                $primaryKeyColumns = $index['columns'] ?? [];
                break;
            }
        }

        return array_map(static function ($c) use ($primaryKeyColumns) {
            $name = $c['name'] ?? '';
            return [
                'name' => $name,
                'type' => $c['type_name'] ?? ($c['type'] ?? ''),
                'nullable' => empty($c['nullable']) ? 'NO' : 'YES',
                'key' => in_array($name, $primaryKeyColumns, true) ? 'PRI' : '',
                'default' => $c['default'] ?? null,
                'extra' => !empty($c['auto_increment']) ? 'auto_increment' : '',
            ];
        }, $columns);
    }

    public static function data(string $connection, string $table, int $page, int $perPage): array
    {
        self::assertTable($connection, $table);
        // Generous cap: the dashboard browses 1000 rows per page by default
        // (user-adjustable); 5000 bounds worst-case payloads.
        $perPage = max(1, min(5000, $perPage));
        $page = max(1, $page);

        $query = DB::connection($connection)->table($table);
        $total = (int) $query->count();
        $rows = $query->forPage($page, $perPage)->get()
            ->map(static fn ($row) => array_map([self::class, 'sanitizeCell'], (array) $row))
            ->all();

        return [
            'data' => $rows,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => (int) max(1, (int) ceil($total / $perPage)),
        ];
    }

    // -------------------------------------------------------------- export/import

    /**
     * Export a whole PostgreSQL table to CSV or JSON.
     * Returns [filename, mimeType, content].
     */
    public static function export(string $connection, string $table, string $format): array
    {
        self::assertTable($connection, $table);
        $format = strtolower($format) === 'json' ? 'json' : 'csv';
        $stamp = self::timestamp();

        $rows = DB::connection($connection)->table($table)->get();
        $arr = $rows->map(static fn ($r) => (array) $r)->all();

        if ($format === 'json') {
            return [
                "{$table}_{$stamp}.json",
                'application/json',
                json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            ];
        }

        $fh = fopen('php://temp', 'r+');
        $headers = !empty($arr) ? array_keys($arr[0]) : self::structureColumnNames($connection, $table);
        fputcsv($fh, $headers);
        foreach ($arr as $row) {
            $line = [];
            foreach ($headers as $h) {
                $v = $row[$h] ?? '';
                $line[] = is_scalar($v) || $v === null ? $v : json_encode($v, JSON_UNESCAPED_UNICODE);
            }
            fputcsv($fh, $line);
        }
        rewind($fh);
        $csv = stream_get_contents($fh);
        fclose($fh);

        return ["{$table}_{$stamp}.csv", 'text/csv', $csv];
    }

    /**
     * Import rows from a CSV/JSON file into a table. mode=append keeps existing
     * rows; mode=replace deletes existing rows first (explicit, destructive --
     * never the default). Returns [imported, skipped]. Idempotency note: this only
     * touches DATA, never the table structure.
     */
    public static function import(string $connection, string $table, string $tmpPath, string $format, string $mode): array
    {
        self::assertTable($connection, $table);
        $format = strtolower($format) === 'json' ? 'json' : 'csv';
        $mode = $mode === 'replace' ? 'replace' : 'append';

        $rows = $format === 'json'
            ? self::parseJsonFile($tmpPath)
            : self::parseCsvFile($tmpPath);

        $columns = self::structureColumnNames($connection, $table);
        $allowed = array_flip($columns);

        $db = DB::connection($connection);
        $imported = 0;
        $skipped = 0;

        $db->transaction(function () use ($db, $table, $rows, $allowed, $mode, &$imported, &$skipped) {
            if ($mode === 'replace') {
                $db->table($table)->delete();
            }
            foreach (array_chunk($rows, 500) as $chunk) {
                $batch = [];
                foreach ($chunk as $row) {
                    $row = array_intersect_key((array) $row, $allowed);
                    if (empty($row)) {
                        $skipped++;
                        continue;
                    }
                    $batch[] = $row;
                }
                if (!empty($batch)) {
                    $db->table($table)->insert($batch);
                    $imported += count($batch);
                }
            }
        });

        return ['imported' => $imported, 'skipped' => $skipped];
    }

    // -------------------------------------------------------------- backup/restore

    /**
     * Create a PostgreSQL custom-format backup with pg_dump.
     * A sidecar {id}.meta.json manifest records the metadata.
     */
    public static function backup(string $connection): array
    {
        $desc = self::resolve($connection);
        $driver = $desc['driver'];
        $dir = self::backupDir();
        $id = $connection . '_' . self::timestamp();

        $file = "{$dir}/{$id}.dump";
        $cfg = self::pgParams($connection);
        $res = Process::timeout(3600)->env(['PGPASSWORD' => $cfg['password']])->run([
            'pg_dump', '-h', $cfg['host'], '-p', (string) $cfg['port'], '-U', $cfg['user'],
            '-d', $cfg['database'], '-Fc', '-f', $file,
        ]);
        if (!$res->successful()) {
            throw new \RuntimeException('pg_dump failed: ' . trim($res->errorOutput() ?: $res->output()));
        }

        $meta = [
            'id' => $id,
            'file' => basename($file),
            'connection' => $connection,
            'driver' => $driver,
            'database' => $desc['database'],
            'size_bytes' => FileSystemManager::isFile($file) ? (int) FileSystemManager::filesize($file) : 0,
            'created_at' => self::nowIso(),
            'directory' => $dir,
        ];
        FileSystemManager::writeFile("{$dir}/{$id}.meta.json", (string) json_encode($meta, JSON_PRETTY_PRINT));

        $meta['size_human'] = self::humanSize($meta['size_bytes']);
        return $meta;
    }

    /** List backups (optionally filtered by connection), newest first. */
    public static function listBackups(?string $connection = null): array
    {
        $dir = self::backupDir();
        $out = [];
        foreach (FileSystemManager::scandir($dir) ?: [] as $entry) {
            if (!str_ends_with($entry, '.meta.json')) {
                continue;
            }
            $metaFile = $dir . DIRECTORY_SEPARATOR . $entry;
            $meta = json_decode((string) FileSystemManager::readFile($metaFile), true);
            if (!is_array($meta) || ($meta['driver'] ?? null) !== 'pgsql') {
                continue;
            }
            if ($connection !== null && ($meta['connection'] ?? null) !== $connection) {
                continue;
            }
            $meta['size_human'] = self::humanSize((int) ($meta['size_bytes'] ?? 0));
            $meta['directory'] = $dir;
            $out[] = $meta;
        }
        usort($out, static fn ($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
        return $out;
    }

    /**
     * Restore a PostgreSQL backup over its source database.
     */
    public static function restore(string $id): array
    {
        $meta = self::requireBackup($id);
        $connection = $meta['connection'];
        $dir = self::backupDir();
        $file = "{$dir}/" . $meta['file'];
        if (!FileSystemManager::isFile($file)) {
            throw new \RuntimeException('Backup artifact missing on disk.');
        }

        $cfg = self::pgParams($connection);
        $res = Process::timeout(3600)->env(['PGPASSWORD' => $cfg['password']])->run([
            'pg_restore', '--clean', '--if-exists', '--no-owner', '-h', $cfg['host'],
            '-p', (string) $cfg['port'], '-U', $cfg['user'], '-d', $cfg['database'], $file,
        ]);
        // pg_restore returns non-zero on benign warnings; treat real failure as
        // empty restore + stderr containing "error".
        if (!$res->successful() && stripos($res->errorOutput(), 'error:') !== false) {
            throw new \RuntimeException('pg_restore failed: ' . trim($res->errorOutput()));
        }

        return ['success' => true, 'message' => "Restored {$connection} from backup {$id}"];
    }

    public static function deleteBackup(string $id): void
    {
        $meta = self::requireBackup($id);
        $dir = self::backupDir();
        FileSystemManager::delete("{$dir}/" . $meta['file']);
        FileSystemManager::delete("{$dir}/{$id}.meta.json");
    }

    /** Absolute path of a backup artifact for download; validates the id. */
    public static function backupFilePath(string $id): string
    {
        $meta = self::requireBackup($id);
        $path = self::backupDir() . '/' . $meta['file'];
        if (!FileSystemManager::isFile($path)) {
            throw new \RuntimeException('Backup artifact missing on disk.');
        }
        return $path;
    }

    // -------------------------------------------------------------------- helpers

    private static function requireBackup(string $id): array
    {
        $id = self::sanitizeId($id);
        $metaPath = self::backupDir() . "/{$id}.meta.json";
        if (!FileSystemManager::isFile($metaPath)) {
            throw new \InvalidArgumentException("Unknown backup id: {$id}");
        }
        $meta = json_decode((string) FileSystemManager::readFile($metaPath), true);
        if (!is_array($meta)
            || empty($meta['file'])
            || empty($meta['connection'])
            || ($meta['driver'] ?? null) !== 'pgsql') {
            throw new \RuntimeException('Corrupt backup manifest.');
        }
        // Guard against path traversal in the recorded file name.
        $meta['file'] = basename((string) $meta['file']);
        return $meta;
    }

    private static function backupDir(): string
    {
        $dir = PathMapper::getBackupDir(self::BACKUP_SUBDIR);
        FileSystemManager::ensureDirectoryExists($dir, 0775);
        return rtrim($dir, '/\\');
    }

    /** PostgreSQL connection parameters resolved from runtime configuration. */
    private static function pgParams(string $connection): array
    {
        return [
            'host' => (string) config("database.connections.{$connection}.host", '127.0.0.1'),
            'port' => (string) config("database.connections.{$connection}.port", '5432'),
            'user' => (string) config("database.connections.{$connection}.username", 'postgres'),
            'password' => (string) config("database.connections.{$connection}.password", ''),
            'database' => (string) config("database.connections.{$connection}.database"),
        ];
    }

    private static function assertTable(string $connection, string $table): void
    {
        self::resolve($connection);
        $listing = array_map([self::class, 'bareName'], Schema::connection($connection)->getTableListing());
        if (!in_array($table, $listing, true)) {
            throw new \InvalidArgumentException("Unknown table '{$table}' on connection '{$connection}'.");
        }
    }

    /**
     * Make a raw cell JSON-safe: pgsql bytea arrives as a PHP stream resource,
     * and serialized payloads (e.g. the cache table) may contain non-UTF-8
     * bytes that would make response()->json() throw. Mirrors
     * DatabaseViewerService::sanitizeValue().
     *
     * @param mixed $value
     * @return mixed
     */
    private static function sanitizeCell($value)
    {
        if (is_resource($value)) {
            $value = stream_get_contents($value);
        }
        if (is_string($value) && !mb_check_encoding($value, 'UTF-8')) {
            return '0x' . bin2hex(substr($value, 0, 256)) . (strlen($value) > 256 ? '…' : '');
        }
        return $value;
    }

    private static function structureColumnNames(string $connection, string $table): array
    {
        return array_map(static fn ($c) => $c['name'] ?? '', Schema::connection($connection)->getColumns($table));
    }

    private static function parseCsvFile(string $path): array
    {
        $rows = [];
        $fh = fopen($path, 'r');
        if ($fh === false) {
            return $rows;
        }
        $headers = fgetcsv($fh);
        if ($headers === false) {
            fclose($fh);
            return $rows;
        }
        while (($line = fgetcsv($fh)) !== false) {
            $rows[] = array_combine($headers, array_pad($line, count($headers), null));
        }
        fclose($fh);
        return $rows;
    }

    private static function parseJsonFile(string $path): array
    {
        $data = json_decode((string) FileSystemManager::readFile($path), true);
        return is_array($data) ? $data : [];
    }

    /** Strip an optional schema qualifier (pgsql may return "public.table"). */
    private static function bareName(string $name): string
    {
        $pos = strrpos($name, '.');
        return $pos === false ? $name : substr($name, $pos + 1);
    }

    private static function sanitizeId(string $id): string
    {
        return preg_replace('/[^A-Za-z0-9_\-]/', '', $id) ?? '';
    }

    private static function timestamp(): string
    {
        return date('Ymd_His');
    }

    private static function nowIso(): string
    {
        return date('c');
    }

    private static function humanSize(?int $bytes): string
    {
        if ($bytes === null) {
            return '—';
        }
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        $val = (float) $bytes;
        while ($val >= 1024 && $i < count($units) - 1) {
            $val /= 1024;
            $i++;
        }
        return round($val, $i === 0 ? 0 : 2) . ' ' . $units[$i];
    }
}
