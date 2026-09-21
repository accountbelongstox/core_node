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
 * PDO throws "database is locked" (SQLITE_BUSY): the lookup retries
 * IMMEDIATELY (bounded attempts, tiny backoff). If the lock persists the
 * result carries busy=true so the API layer can tell the caller to retry.
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

    private static ?PDO $conn = null;
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

    /** True when the PDO sqlite driver and the database file are both present. */
    public static function available(): bool
    {
        return self::pdoSqliteAvailable() && is_file(self::dbPath());
    }

    public static function pdoSqliteAvailable(): bool
    {
        return class_exists(PDO::class) && in_array('sqlite', PDO::getAvailableDrivers(), true);
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
        if (!self::pdoSqliteAvailable()) {
            $base['error'] = 'PDO sqlite driver is not installed';
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
            $stmt = $conn->query('SELECT COUNT(*) FROM stardict');
            return $stmt === false ? null : (int) $stmt->fetchColumn();
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
            $stmt = $conn->prepare($sql);
            if ($stmt === false) {
                return null;
            }
            $stmt->execute([':word' => $word]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row === false ? null : $row;
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
     * Shared read-only connection. query_only=ON guarantees this process can
     * never write the shared database; ATTR_TIMEOUT applies SQLite's own
     * busy-timeout before SQLITE_BUSY is raised (sqlite.org/c3ref/busy_timeout).
     */
    private static function connection(): ?PDO
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
        $conn = new PDO('sqlite:' . self::dbPath(), null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 2,
        ]);
        $conn->exec('PRAGMA query_only = ON');
        self::$columns = $conn
            ->query('PRAGMA table_info(stardict)')
            ->fetchAll(PDO::FETCH_COLUMN, 1);
        if (!in_array('word', self::$columns, true)) {
            self::$conn = null;
            return null;
        }
        self::$conn = $conn;
        return self::$conn;
    }

    /**
     * Run $fn, retrying IMMEDIATELY when SQLite reports a lock race
     * (SQLITE_BUSY "database is locked" / SQLITE_LOCKED). Returns
     * ['busy' => true] when the lock outlives every attempt; try-catch is
     * required here because PDO signals the busy state only via PDOException.
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
            } catch (PDOException $e) {
                if (!self::isBusyError($e) || $attempt === self::BUSY_MAX_ATTEMPTS - 1) {
                    if (!self::isBusyError($e)) {
                        throw $e;
                    }
                    return ['busy' => true];
                }
            }
        }
        return ['busy' => true];
    }

    /** SQLITE_BUSY (5) / SQLITE_LOCKED (6) detection from the PDO error info. */
    private static function isBusyError(PDOException $e): bool
    {
        $info = $e->errorInfo;
        if (is_array($info) && isset($info[1]) && in_array((int) $info[1], [5, 6], true)) {
            return true;
        }
        return stripos($e->getMessage(), 'locked') !== false;
    }
}
