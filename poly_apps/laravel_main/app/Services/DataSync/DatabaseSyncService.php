<?php

namespace App\Services\DataSync;

use App\Services\Dashboard\DatabaseManagerService;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * PostgreSQL row synchronization. Table metadata comes from bulk catalog
 * queries (one round trip per kind per connection), so inventory cost is
 * O(tables) regardless of how many tables a connection holds.
 */
final class DatabaseSyncService
{
    public const CHUNK_ROWS = 500;
    public const CHUNK_JSON_BYTES = 4 * 1024 * 1024;
    private const CATALOG_TTL_SECONDS = 60;
    private const TEXT_COMPARED_TYPES = ['json', 'jsonb', 'xml', 'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle'];

    private static array $catalogs = [];

    public function inventory(?callable $shouldAbort = null): array
    {
        $inventory = [];

        foreach (DatabaseManagerService::physicalConnections() as $descriptor) {
            if ($shouldAbort !== null) {
                $shouldAbort();
            }
            $connectionName = (string) $descriptor['connection'];
            $catalog = $this->catalog($connectionName, true);
            $counts = $this->exactRowCounts($connectionName);
            $tables = [];

            foreach ($catalog as $tableName => $table) {
                $tables[$tableName] = [
                    'name' => $tableName,
                    'rows' => (int) ($counts[$tableName] ?? 0),
                    'columns' => $table['columns'],
                    'identity' => $table['identity'],
                ];
            }
            $inventory[] = [
                'key' => (string) $descriptor['key'],
                'connection' => $connectionName,
                'driver' => (string) $descriptor['driver'],
                'database' => (string) $descriptor['database'],
                'tables' => $this->orderTablesByDependencies($catalog, $tables),
            ];
        }

        return $inventory;
    }

    /**
     * Exact row counts for every table of every managed connection, keyed by
     * connection key then table name.
     */
    public function rowCounts(): array
    {
        $counts = [];

        foreach (DatabaseManagerService::physicalConnections() as $descriptor) {
            $counts[(string) $descriptor['key']] = $this->exactRowCounts((string) $descriptor['connection']);
        }

        return $counts;
    }

    public function readChunk(string $connectionKey, string $table, int $offset): array
    {
        $connection = DatabaseManagerService::connectionName($connectionKey);
        $meta = $this->table($connection, $table);
        $query = DB::connection($connection)->table($table)->select($meta['writable']);

        foreach ($meta['identity'] as $column) {
            $query->orderBy($column);
        }
        if ($meta['identity'] === []) {
            $query->orderByRaw('ctid');
        }

        $fetchedRows = $query->offset(max(0, $offset))->limit(self::CHUNK_ROWS)->get()
            ->map(fn (object $row): array => $this->encodeRow((array) $row))
            ->all();
        $rows = [];
        $jsonBytes = 2;

        foreach ($fetchedRows as $row) {
            $rowBytes = strlen((string) json_encode($row, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            if ($rows !== [] && $jsonBytes + $rowBytes > self::CHUNK_JSON_BYTES) {
                break;
            }
            $rows[] = $row;
            $jsonBytes += $rowBytes;
        }

        return [
            'rows' => $rows,
            'offset' => $offset,
            'next_offset' => $offset + count($rows),
            'done' => count($rows) === count($fetchedRows) && count($fetchedRows) < self::CHUNK_ROWS,
            'identity' => $meta['identity'],
        ];
    }

    /**
     * Idempotent merge of one row chunk. When the chunk as a whole violates a
     * constraint (e.g. a secondary unique key or a missing parent row), rows
     * are applied one by one and only the conflicting rows are skipped.
     */
    public function applyDiff(string $connectionKey, string $table, array $rows): array
    {
        $connection = DatabaseManagerService::connectionName($connectionKey);
        $meta = $this->table($connection, $table);
        $allowed = array_flip($meta['writable']);
        $database = DB::connection($connection);
        $decodedRows = [];
        $conflicts = [];

        foreach ($rows as $encodedRow) {
            $row = array_intersect_key($this->decodeRow((array) $encodedRow), $allowed);
            if ($row !== []) {
                $decodedRows[] = $row;
            }
        }

        try {
            $counters = $this->applyRows($database, $table, $decodedRows, $meta);
            $applied = $decodedRows;
        } catch (QueryException) {
            $counters = ['inserted' => 0, 'updated' => 0, 'unchanged' => 0];
            $applied = [];
            foreach ($decodedRows as $row) {
                try {
                    foreach ($this->applyRows($database, $table, [$row], $meta) as $counter => $value) {
                        $counters[$counter] += $value;
                    }
                    $applied[] = $row;
                } catch (QueryException $exception) {
                    $conflicts[] = mb_substr(strtok($exception->getMessage(), "\n"), 0, 240);
                }
            }
        }

        $counters['verified'] = 0;
        $appliedRows = $this->rowsByIdentity($database, $table, $applied, $meta['identity']);
        foreach ($applied as $row) {
            $identityValues = $this->identityValues($row, $meta['identity']);
            $verified = $identityValues === []
                ? $this->exactRowQuery($database, $table, $row, $meta['types'])->exists()
                : (($stored = $appliedRows[$this->identityKey($identityValues)] ?? null) !== null
                    && $this->rowHash($stored, $meta['types']) === $this->rowHash($row, $meta['types']));
            if (!$verified) {
                throw new \RuntimeException("Row verification failed after apply: {$connectionKey}.{$table}");
            }
            $counters['verified']++;
        }

        return $counters + [
            'conflicts' => count($conflicts),
            'conflict_samples' => array_slice(array_values(array_unique($conflicts)), 0, 3),
            'received' => count($rows),
        ];
    }

    private function applyRows(Connection $database, string $table, array $rows, array $meta): array
    {
        $identity = $meta['identity'];
        $types = $meta['types'];
        $counters = ['inserted' => 0, 'updated' => 0, 'unchanged' => 0];

        $database->transaction(function () use ($database, $table, $rows, $identity, $types, &$counters): void {
            $identityRows = [];
            $rowsWithoutIdentity = [];

            foreach ($rows as $row) {
                if ($this->identityValues($row, $identity) === []) {
                    $rowsWithoutIdentity[] = $row;
                } else {
                    $identityRows[] = $row;
                }
            }

            if ($identityRows !== []) {
                $existingRows = $this->rowsByIdentity($database, $table, $identityRows, $identity);
                $changedRows = [];

                foreach ($identityRows as $row) {
                    $existing = $existingRows[$this->identityKey($this->identityValues($row, $identity))] ?? null;
                    if ($existing === null) {
                        $counters['inserted']++;
                        $changedRows[] = $row;
                    } elseif ($this->rowHash($existing, $types) === $this->rowHash($row, $types)) {
                        $counters['unchanged']++;
                    } else {
                        $counters['updated']++;
                        $changedRows[] = $row;
                    }
                }

                foreach ($this->groupByColumns($changedRows) as $group) {
                    $updateColumns = array_values(array_diff(array_keys($group[0]), $identity));
                    if ($updateColumns === []) {
                        $database->table($table)->insertOrIgnore($group);
                    } else {
                        $database->table($table)->upsert($group, $identity, $updateColumns);
                    }
                }
            }

            foreach ($rowsWithoutIdentity as $row) {
                if ($this->exactRowQuery($database, $table, $row, $types)->exists()) {
                    $counters['unchanged']++;
                    continue;
                }
                $database->table($table)->insert($row);
                $counters['inserted']++;
            }
        });

        return $counters;
    }

    /**
     * Moves every serial/identity sequence of the table past the current
     * maximum so rows inserted later on this node do not collide.
     */
    public function advanceSequence(string $connectionKey, string $table): void
    {
        $connection = DatabaseManagerService::connectionName($connectionKey);
        $meta = $this->table($connection, $table);
        $database = DB::connection($connection);

        foreach ($meta['sequenced'] as $column) {
            $sequenceName = $database->selectOne(
                'SELECT pg_get_serial_sequence(?, ?) AS sequence_name',
                [$this->qualifiedName($database, $table), $column]
            )?->sequence_name;
            if ($sequenceName === null) {
                continue;
            }
            $maximum = $database->table($table)->max($column);
            if ($maximum === null || !is_numeric($maximum)) {
                continue;
            }
            $database->select('SELECT setval(?, GREATEST(?, (SELECT last_value FROM ' . $sequenceName . ')), true)', [
                $sequenceName,
                (int) $maximum,
            ]);
        }
    }

    public function hasTable(string $connectionKey, string $table): bool
    {
        return isset($this->catalog(DatabaseManagerService::connectionName($connectionKey))[$table]);
    }

    private function table(string $connection, string $table): array
    {
        $catalog = $this->catalog($connection);
        if (!isset($catalog[$table])) {
            $catalog = $this->catalog($connection, true);
        }

        return $catalog[$table] ?? throw new \InvalidArgumentException("Unknown table: {$connection}.{$table}");
    }

    /**
     * Columns, identity, sequences, and foreign-key parents for every base
     * table in the connection's current schema.
     */
    private function catalog(string $connection, bool $refresh = false): array
    {
        $cached = self::$catalogs[$connection] ?? null;
        if (!$refresh && $cached !== null && $cached['expires'] > time()) {
            return $cached['tables'];
        }

        $database = DB::connection($connection);
        $tables = [];

        foreach ($database->select(
            "SELECT c.relname AS table_name, a.attname AS name, t.typname AS type,
                NOT a.attnotnull AS nullable, a.attgenerated <> '' AS generated,
                (a.attidentity <> '' OR COALESCE(pg_get_expr(d.adbin, d.adrelid), '') LIKE 'nextval(%') AS sequenced
             FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_type t ON t.oid = a.atttypid
             LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
             WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p') AND NOT c.relispartition
               AND a.attnum > 0 AND NOT a.attisdropped
             ORDER BY c.relname, a.attnum"
        ) as $column) {
            $tableName = (string) $column->table_name;
            $tables[$tableName] ??= [
                'columns' => [],
                'writable' => [],
                'types' => [],
                'sequenced' => [],
                'identity' => [],
                'parents' => [],
            ];
            $tables[$tableName]['columns'][] = [
                'name' => (string) $column->name,
                'type' => (string) $column->type,
                'nullable' => $column->nullable ? 'YES' : 'NO',
                'extra' => $column->generated ? 'generated' : ($column->sequenced ? 'auto_increment' : ''),
            ];
            $tables[$tableName]['types'][(string) $column->name] = strtolower((string) $column->type);
            if (!$column->generated) {
                $tables[$tableName]['writable'][] = (string) $column->name;
            }
            if ($column->sequenced) {
                $tables[$tableName]['sequenced'][] = (string) $column->name;
            }
        }

        $uniqueIndexes = [];
        foreach ($database->select(
            "SELECT t.relname AS table_name, i.relname AS index_name, ix.indisprimary AS is_primary,
                array_to_string(ARRAY(
                    SELECT a.attname FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                    ORDER BY k.ord
                ), ',') AS columns
             FROM pg_index ix
             JOIN pg_class t ON t.oid = ix.indrelid
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE n.nspname = current_schema() AND (ix.indisprimary OR ix.indisunique)
               AND ix.indpred IS NULL AND ix.indexprs IS NULL AND ix.indisvalid
             ORDER BY t.relname, ix.indisprimary DESC, i.relname"
        ) as $index) {
            $tableName = (string) $index->table_name;
            $columns = array_values(array_filter(explode(',', (string) $index->columns), 'strlen'));
            if (!isset($tables[$tableName]) || $columns === [] || isset($uniqueIndexes[$tableName])) {
                continue;
            }
            $uniqueIndexes[$tableName] = true;
            $tables[$tableName]['identity'] = $columns;
        }

        foreach ($database->select(
            "SELECT DISTINCT t.relname AS table_name, f.relname AS parent_name
             FROM pg_constraint c
             JOIN pg_class t ON t.oid = c.conrelid
             JOIN pg_class f ON f.oid = c.confrelid
             JOIN pg_namespace n ON n.oid = t.relnamespace
             WHERE c.contype = 'f' AND n.nspname = current_schema()"
        ) as $foreignKey) {
            $tableName = (string) $foreignKey->table_name;
            $parentName = (string) $foreignKey->parent_name;
            if (isset($tables[$tableName]) && $parentName !== $tableName) {
                $tables[$tableName]['parents'][$parentName] = true;
            }
        }

        ksort($tables);
        self::$catalogs[$connection] = ['expires' => time() + self::CATALOG_TTL_SECONDS, 'tables' => $tables];
        return $tables;
    }

    private function exactRowCounts(string $connection): array
    {
        $counts = [];

        foreach (DB::connection($connection)->select(
            "SELECT c.relname AS table_name,
                (xpath('/row/c/text()', query_to_xml(
                    format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname), false, true, ''
                )))[1]::text::bigint AS row_count
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = current_schema() AND c.relkind IN ('r', 'p') AND NOT c.relispartition"
        ) as $row) {
            $counts[(string) $row->table_name] = (int) $row->row_count;
        }

        return $counts;
    }

    private function qualifiedName(Connection $database, string $table): string
    {
        $schema = (string) ($database->selectOne('SELECT current_schema() AS schema_name')?->schema_name ?? 'public');
        return '"' . str_replace('"', '""', $schema) . '"."' . str_replace('"', '""', $table) . '"';
    }

    private function exactRowQuery(Connection $database, string $table, array $row, array $types): Builder
    {
        $query = $database->table($table);

        foreach ($row as $column => $value) {
            if ($value === null) {
                $query->whereNull($column);
            } elseif (in_array($types[$column] ?? '', self::TEXT_COMPARED_TYPES, true)) {
                $query->whereRaw($database->getQueryGrammar()->wrap($column) . '::text = ?', [(string) $value]);
            } else {
                $query->where($column, $value);
            }
        }

        return $query;
    }

    /**
     * Upsert needs one column list per statement; rows missing a column
     * (e.g. encoded differently) are grouped separately.
     */
    private function groupByColumns(array $rows): array
    {
        $groups = [];

        foreach ($rows as $row) {
            $groups[implode("\0", array_keys($row))][] = $row;
        }

        return array_values($groups);
    }

    private function rowsByIdentity(Connection $database, string $table, array $rows, array $identity): array
    {
        $identityRows = array_values(array_filter(
            $rows,
            fn (array $row): bool => $this->identityValues($row, $identity) !== []
        ));
        $mapped = [];

        if ($identityRows === []) {
            return $mapped;
        }

        $query = $database->table($table);
        if (count($identity) === 1) {
            $query->whereIn($identity[0], array_map(static fn (array $row): mixed => $row[$identity[0]], $identityRows));
        } else {
            $query->where(function (Builder $outer) use ($identityRows, $identity): void {
                foreach ($identityRows as $row) {
                    $outer->orWhere(function (Builder $inner) use ($row, $identity): void {
                        foreach ($this->identityValues($row, $identity) as $column => $value) {
                            $inner->where($column, $value);
                        }
                    });
                }
            });
        }

        foreach ($query->get() as $record) {
            $recordRow = (array) $record;
            $identityValues = $this->identityValues($recordRow, $identity);
            if ($identityValues !== []) {
                $mapped[$this->identityKey($identityValues)] = $recordRow;
            }
        }

        return $mapped;
    }

    private function identityKey(array $identityValues): string
    {
        ksort($identityValues);
        $normalized = array_map(static fn (mixed $value): mixed => is_int($value) || is_float($value) ? (string) $value : $value, $identityValues);
        return hash('sha256', (string) json_encode($this->encodeRow($normalized), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    private function identityValues(array $row, array $identity): array
    {
        if ($identity === []) {
            return [];
        }
        $values = array_intersect_key($row, array_flip($identity));

        if (count($values) !== count($identity) || in_array(null, $values, true)) {
            return [];
        }

        return $values;
    }

    private function encodeRow(array $row): array
    {
        foreach ($row as $key => $value) {
            if (is_resource($value)) {
                $row[$key] = ['__data_sync_binary' => base64_encode((string) stream_get_contents($value))];
                continue;
            }
            if (is_string($value) && !mb_check_encoding($value, 'UTF-8')) {
                $row[$key] = ['__data_sync_binary' => base64_encode($value)];
            }
        }

        return $row;
    }

    private function decodeRow(array $row): array
    {
        foreach ($row as $key => $value) {
            if (is_array($value) && isset($value['__data_sync_binary'])) {
                $decoded = base64_decode((string) $value['__data_sync_binary'], true);
                if ($decoded === false) {
                    throw new \InvalidArgumentException('Database row contains an invalid binary value.');
                }
                $row[$key] = $decoded;
            }
        }

        return $row;
    }

    private function orderTablesByDependencies(array $catalog, array $tables): array
    {
        $ordered = [];
        $remaining = $tables;

        while ($remaining !== []) {
            $progressed = false;
            foreach ($remaining as $tableName => $table) {
                $parents = array_keys($catalog[$tableName]['parents'] ?? []);
                $unresolved = array_filter(
                    $parents,
                    static fn (string $parent): bool => isset($remaining[$parent])
                );
                if ($unresolved !== []) {
                    continue;
                }
                $ordered[$tableName] = $table;
                unset($remaining[$tableName]);
                $progressed = true;
            }
            if (!$progressed) {
                $ordered += $remaining;
                break;
            }
        }

        return array_values($ordered);
    }

    private function rowHash(array $row, array $types): string
    {
        foreach ($row as $column => $value) {
            $type = $types[$column] ?? '';
            if (is_string($value) && in_array($type, ['json', 'jsonb'], true)) {
                try {
                    $row[$column] = $this->canonicalizeJson(json_decode($value, true, 512, JSON_THROW_ON_ERROR));
                } catch (\JsonException) {
                    $row[$column] = $value;
                }
            } elseif ($type === 'bytea' && is_string($value)) {
                $row[$column] = ['__data_sync_binary' => base64_encode($value)];
            } elseif (is_int($value) || is_float($value)) {
                $row[$column] = (string) $value;
            }
        }
        ksort($row);
        return hash('sha256', (string) json_encode($this->encodeRow($row), JSON_UNESCAPED_SLASHES));
    }

    private function canonicalizeJson(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value);
        }
        foreach ($value as $key => $item) {
            $value[$key] = $this->canonicalizeJson($item);
        }
        return $value;
    }
}
