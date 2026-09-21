<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Support;

use App\Providers\PathMapper;
use PDO;
use PDOException;
use SQLite3;
use Throwable;

/**
 * ECDICT offline dictionary (shared read-only SQLite).
 *
 * Reads the SAME physical database pycore serves through
 * pycore/pyutils/translator/dictionary.py:
 *   <wwwroot>/pycore_db/dictionaries/stardict.db   (ECDICT `stardict` table)
 * resolved via PathMapper::mapWebPath('wwwroot', ...) so the NTFS dual-boot
 * offset (/www/www vs /www) is handled by the single cross-language path map.
 *
 * The database is shared between the pycore service and this Laravel app.
 * Both ends only SELECT. When a concurrent access wins the SQLite lock,
 * the driver reports "database is locked" (SQLITE_BUSY): the lookup retries
 * IMMEDIATELY (bounded attempts, tiny backoff). If the lock persists the
 * result carries busy=true so the API layer can tell the caller to retry.
 *
 * Driver: pdo_sqlite is preferred; when the running PHP lacks it (e.g. an
 * older FrankenPHP static binary) the sqlite3 extension (SQLite3 class,
 * opened READONLY) is used instead.
 */
class EcdictDictionary
{
    /** Columns read when present (PRAGMA-detected, mirroring the pycore side). */
    private const ECDICT_COLUMNS = [
        'word', 'phonetic', 'definition', 'translation',
        'pos', 'collins', 'oxford', 'tag', 'bnc', 'frq', 'exchange',
    ];

    /** Targets ECDICT answers directly (translation column is Simplified Chinese). */
    private const ZH_TARGETS = ['zh', 'zh-cn', 'zh_cn', 'zh-hans', 'zh-hans-cn', 'chinese', 'cn', 'zh-chs'];
    private const EN_TARGETS = ['en', 'en-us', 'en-gb', 'english'];

    /** Immediate-retry policy for SQLITE_BUSY: up to 3 attempts, 0ms/50ms/150ms. */
    private const BUSY_MAX_ATTEMPTS = 3;
    private const BUSY_BACKOFF_US = [0, 50000, 150000];

    private static PDO|SQLite3|null $conn = null;
    private static bool $connectAttempted = false;
    /** @var string[] */
    private static array $columns = [];

    /** Absolute ECDICT SQLite path (env override wins, mirroring ECDICT_DB_PATH). */
    public static function dbPath(): string
    {
        $override = trim((string) getenv('ECDICT_DB_PATH'));
        if ($override !== '') {
            return $override;
        }
        return PathMapper::mapWebPath('wwwroot', 'pycore_db/dictionaries/stardict.db');
    }

    /** True when ANY sqlite driver and the database file are both present. */
    public static function available(): bool
    {
        return self::sqliteDriverAvailable() && is_file(self::dbPath());
    }

    public static function sqliteDriverAvailable(): bool
    {
        return self::pdoSqliteAvailable() || self::sqlite3ExtAvailable();
    }

    public static function pdoSqliteAvailable(): bool
    {
        return class_exists(PDO::class) && in_array('sqlite', PDO::getAvailableDrivers(), true);
    }

    public static function sqlite3ExtAvailable(): bool
    {
        return extension_loaded('sqlite3') && class_exists(SQLite3::class);
    }

    /**
     * Install/availability snapshot (same envelope as pycore dictionary_status).
     */
    public static function status(): array
    {
        $path = self::dbPath();
        $base = [
            'available' => false,
            'db_path' => $path,
            'entries' => 0,
        ];
        if (!self::sqliteDriverAvailable()) {
            $base['error'] = 'No SQLite driver is installed (pdo_sqlite / sqlite3)';
            return ['success' => true, 'busy' => false, 'ecdict' => $base];
        }
        if (!is_file($path)) {
            $base['error'] = 'ECDICT database not found (run install_dictionaries.sh)';
            return ['success' => true, 'busy' => false, 'ecdict' => $base];
        }
        $count = self::runWithBusyRetry(function () {
            $conn = self::connection();
            if ($conn === null) {
                return null;
            }
            $rows = self::selectAll($conn, 'SELECT COUNT(*) AS c FROM stardict');
            return isset($rows[0]) ? (int) $rows[0]['c'] : null;
        });
        if (is_array($count) && ($count['busy'] ?? false)) {
            return ['success' => false, 'busy' => true, 'ecdict' => $base];
        }
        $base['available'] = $count !== null;
        $base['entries'] = $count ?? 0;
        return ['success' => true, 'busy' => false, 'ecdict' => $base];
    }

    /**
     * Rich entry for $word (same field names as the pycore dictionary_lookup
     * route so one UI adapter serves both ends). busy=true signals a SQLite
     * lock race that outlasted the immediate retries — the caller should retry.
     *
     * @return array<string,mixed>
     */
    public static function lookup(string $word): array
    {
        $word = trim($word);
        $empty = self::emptyEntry($word);
        if ($word === '') {
            $empty['error'] = 'word is required';
            return $empty;
        }
        if (!self::available()) {
            $empty['error'] = 'ECDICT database is not installed';
            return $empty;
        }

        $row = self::runWithBusyRetry(function () use ($word) {
            $conn = self::connection();
            if ($conn === null) {
                return null;
            }
            $cols = array_values(array_intersect(self::ECDICT_COLUMNS, self::$columns));
            if (empty($cols)) {
                return null;
            }
            $sql = 'SELECT ' . implode(', ', $cols)
                . ' FROM stardict WHERE word = :word COLLATE NOCASE LIMIT 1';
            $rows = self::selectAll($conn, $sql, [':word' => $word]);
            return $rows[0] ?? null;
        });

        if (is_array($row) && ($row['busy'] ?? false)) {
            $empty['busy'] = true;
            $empty['error'] = 'ECDICT database is locked by a concurrent process; retry immediately';
            return $empty;
        }
        if (!is_array($row)) {
            return $empty;
        }

        $tag = trim((string) ($row['tag'] ?? ''));
        return [
            'success' => true,
            'busy' => false,
            'word' => (string) ($row['word'] ?? $word),
            'found' => true,
            'translation' => trim((string) ($row['translation'] ?? '')),
            'definition' => trim((string) ($row['definition'] ?? '')),
            'phonetic' => trim((string) ($row['phonetic'] ?? '')),
            'pos' => trim((string) ($row['pos'] ?? '')),
            'tags' => $tag === '' ? [] : preg_split('/\s+/', $tag),
            'collins' => (int) ($row['collins'] ?? 0),
            'oxford' => (bool) ($row['oxford'] ?? false),
            'bnc' => (int) ($row['bnc'] ?? 0),
            'frq' => (int) ($row['frq'] ?? 0),
            'exchange' => trim((string) ($row['exchange'] ?? '')),
            'source' => 'ecdict',
        ];
    }

    /**
     * Single-language answer for $target (Chinese from the translation column,
     * English from the definition). null on miss / unsupported target.
     */
    public static function translate(string $word, string $target): ?string
    {
        $entry = self::lookup($word);
        if (($entry['busy'] ?? false) || !($entry['found'] ?? false)) {
            return null;
        }
        $targetNorm = strtolower(trim($target));
        if (in_array($targetNorm, self::ZH_TARGETS, true)) {
            $text = (string) $entry['translation'];
        } elseif (in_array($targetNorm, self::EN_TARGETS, true)) {
            $text = (string) $entry['definition'];
        } else {
            return null;
        }
        $text = trim($text);
        if ($text === '') {
            return null;
        }
        $parts = array_filter(array_map('trim', preg_split('/\r?\n/', $text)));
        return implode('; ', $parts);
    }

    /**
     * Prefix suggestions for the search box (same envelope as the pycore
     * dictionary_match route): up to $limit words starting with $prefix
     * (case-insensitive), most frequent first (COCA frq then BNC), each with
     * its first zh sense. busy=true signals a persistent lock race.
     *
     * @return array<string,mixed>
     */
    public static function match(string $prefix, int $limit = 20): array
    {
        $prefix = trim($prefix);
        $result = ['success' => true, 'busy' => false, 'prefix' => $prefix, 'items' => []];
        if ($prefix === '') {
            return $result;
        }
        if (!self::available()) {
            $result['error'] = 'ECDICT database is not installed';
            return $result;
        }
        $limit = max(1, min($limit, 50));
        $like = strtr($prefix, ['\\' => '\\\\', '%' => '\\%', '_' => '\\_']) . '%';
        $rows = self::runWithBusyRetry(function () use ($like, $limit) {
            $conn = self::connection();
            if ($conn === null) {
                return null;
            }
            return self::selectAll(
                $conn,
                "SELECT word, translation, frq, bnc FROM stardict"
                . " WHERE word LIKE :pfx ESCAPE '\\' COLLATE NOCASE"
                . " ORDER BY (COALESCE(frq, 0) = 0), COALESCE(frq, 0),"
                . " (COALESCE(bnc, 0) = 0), COALESCE(bnc, 0), word LIMIT :lim",
                [':pfx' => $like, ':lim' => $limit]
            );
        });
        if (is_array($rows) && ($rows['busy'] ?? false)) {
            $result['busy'] = true;
            $result['error'] = 'ECDICT database is locked by a concurrent process; retry immediately';
            return $result;
        }
        if (!is_array($rows)) {
            return $result;
        }
        foreach ($rows as $row) {
            $firstSense = '';
            foreach (preg_split('/\r?\n/', (string) ($row['translation'] ?? '')) as $line) {
                $line = trim((string) $line);
                if ($line !== '') {
                    $firstSense = $line;
                    break;
                }
            }
            $result['items'][] = [
                'word' => (string) ($row['word'] ?? ''),
                'translation' => $firstSense,
                'frq' => (int) ($row['frq'] ?? 0),
                'bnc' => (int) ($row['bnc'] ?? 0),
            ];
        }
        return $result;
    }

    /** Empty (not-found) entry envelope shared by every early return. */
    private static function emptyEntry(string $word): array
    {
        return [
            'success' => true,
            'busy' => false,
            'word' => $word,
            'found' => false,
            'translation' => '',
            'definition' => '',
            'phonetic' => '',
            'pos' => '',
            'tags' => [],
            'collins' => 0,
            'oxford' => false,
            'bnc' => 0,
            'frq' => 0,
            'exchange' => '',
            'source' => '',
        ];
    }

    /**
     * Shared read-only connection. PDO: query_only=ON guarantees this process
     * can never write the shared database; ATTR_TIMEOUT applies SQLite's own
     * busy-timeout before SQLITE_BUSY is raised (sqlite.org/c3ref/busy_timeout).
     * sqlite3-ext fallback: OPEN_READONLY + busyTimeout(2000).
     */
    private static function connection(): PDO|SQLite3|null
    {
        if (self::$conn !== null) {
            return self::$conn;
        }
        if (self::$connectAttempted) {
            return null;
        }
        self::$connectAttempted = true;
        if (!self::available()) {
            return null;
        }
        if (self::pdoSqliteAvailable()) {
            $conn = new PDO('sqlite:' . self::dbPath(), null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 2,
            ]);
            $conn->exec('PRAGMA query_only = ON');
        } else {
            $conn = new SQLite3(self::dbPath(), SQLITE3_OPEN_READONLY);
            $conn->busyTimeout(2000);
        }
        self::$columns = array_map(
            fn ($row) => (string) $row['name'],
            self::selectAll($conn, 'PRAGMA table_info(stardict)')
        );
        if (!in_array('word', self::$columns, true)) {
            self::$conn = null;
            return null;
        }
        self::$conn = $conn;
        return self::$conn;
    }

    /**
     * Fetch all rows as assoc arrays across both drivers. Named params use
     * ':key' placeholders on either side.
     *
     * @param array<string,mixed> $params
     * @return array<int,array<string,mixed>>
     */
    private static function selectAll(PDO|SQLite3 $conn, string $sql, array $params = []): array
    {
        if ($conn instanceof PDO) {
            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                return [];
            }
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return is_array($rows) ? $rows : [];
        }
        $stmt = $conn->prepare($sql);
        if ($stmt === false) {
            return [];
        }
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $rs = $stmt->execute();
        if ($rs === false) {
            return [];
        }
        $rows = [];
        while (($row = $rs->fetchArray(SQLITE3_ASSOC)) !== false) {
            $rows[] = $row;
        }
        return $rows;
    }

    /**
     * Run $fn, retrying IMMEDIATELY when SQLite reports a lock race
     * (SQLITE_BUSY "database is locked" / SQLITE_LOCKED). Returns
     * ['busy' => true] when the lock outlives every attempt; try-catch is
     * required here because both drivers signal the busy state only via
     * an exception (PDOException / Exception from SQLite3).
     *
     * @return mixed|array{busy:true}
     */
    private static function runWithBusyRetry(callable $fn)
    {
        for ($attempt = 0; $attempt < self::BUSY_MAX_ATTEMPTS; $attempt++) {
            $delay = self::BUSY_BACKOFF_US[$attempt] ?? 150000;
            if ($delay > 0) {
                usleep($delay);
            }
            try {
                return $fn();
            } catch (Throwable $e) {
                if (!self::isBusyError($e)) {
                    throw $e;
                }
                if ($attempt === self::BUSY_MAX_ATTEMPTS - 1) {
                    return ['busy' => true];
                }
            }
        }
        return ['busy' => true];
    }

    /** SQLITE_BUSY (5) / SQLITE_LOCKED (6) detection across both drivers. */
    private static function isBusyError(Throwable $e): bool
    {
        if ($e instanceof PDOException) {
            $info = $e->errorInfo;
            if (is_array($info) && isset($info[1]) && in_array((int) $info[1], [5, 6], true)) {
                return true;
            }
        }
        return stripos($e->getMessage(), 'locked') !== false;
    }
}
