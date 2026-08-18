<?php

namespace App\Services\DataSync;

use App\Services\Dashboard\DatabaseManagerService;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class DatabaseSyncService
{
    public const CHUNK_ROWS = 250;
    public const CHUNK_JSON_BYTES = 4 * 1024 * 1024;

    public function inventory(): array
    {
        $inventory = [];

        foreach (DatabaseManagerService::physicalConnections() as $descriptor) {
            $connectionKey = (string) $descriptor['key'];
            $connectionName = (string) $descriptor['connection'];
            $tables = [];
            foreach (DatabaseManagerService::tables($connectionName) as $table) {
                $tableName = (string) $table['name'];
                $tables[$tableName] = [
                    'name' => $tableName,
                    'rows' => (int) $table['rows'],
                    'columns' => DatabaseManagerService::structure($connectionName, $tableName),
                    'identity' => $this->identityColumns($connectionName, $tableName),
                ];
            }
            $tables = $this->orderTablesByDependencies($connectionName, $tables);
            $inventory[] = [
                'key' => $connectionKey,
                'connection' => $connectionName,
                'driver' => (string) $descriptor['driver'],
                'database' => (string) $descriptor['database'],
                'tables' => $tables,
            ];
        }

        return $inventory;
    }

    public function readChunk(string $connectionKey, string $table, int $offset): array
    {
        $connection = DatabaseManagerService::connectionName($connectionKey);
        DatabaseManagerService::structure($connection, $table);
        $identity = $this->identityColumns($connection, $table);
        $query = DB::connection($connection)->table($table);

        foreach ($identity as $column) {
            $query->orderBy($column);
        }
        if ($identity === []) {
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
            'identity' => $identity,
        ];
    }

    public function applyDiff(string $connectionKey, string $table, array $rows): array
    {
        $connection = DatabaseManagerService::connectionName($connectionKey);
        $structure = DatabaseManagerService::structure($connection, $table);
        $columns = Schema::connection($connection)->getColumnListing($table);
        $columnTypes = array_column($structure, 'type', 'name');
        $allowed = array_flip($columns);
        $identity = $this->identityColumns($connection, $table);
        $database = DB::connection($connection);
        $decodedRows = [];
        $inserted = 0;
        $updated = 0;
        $unchanged = 0;
        $verified = 0;

        foreach ($rows as $encodedRow) {
            $row = array_intersect_key($this->decodeRow((array) $encodedRow), $allowed);
            if ($row !== []) {
                $decodedRows[] = $row;
            }
        }

        $database->transaction(function () use (
            $database,
            $table,
            $decodedRows,
            $identity,
            $columnTypes,
            &$inserted,
            &$updated,
            &$unchanged
        ): void {
            $identityRows = [];
            $rowsWithoutIdentity = [];

            foreach ($decodedRows as $row) {
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
                    $identityKey = $this->identityKey($this->identityValues($row, $identity));
                    $existing = $existingRows[$identityKey] ?? null;
                    if ($existing === null) {
                        $inserted++;
                        $changedRows[] = $row;
                        continue;
                    }
                    if ($this->rowHash($existing, $columnTypes) === $this->rowHash($row, $columnTypes)) {
                        $unchanged++;
                        continue;
                    }
                    $updated++;
                    $changedRows[] = $row;
                }

                if ($changedRows !== []) {
                    $updateColumns = array_values(array_diff(array_keys($changedRows[0]), $identity));
                    if ($updateColumns === []) {
                        $database->table($table)->insertOrIgnore($changedRows);
                    } else {
                        $database->table($table)->upsert($changedRows, $identity, $updateColumns);
                    }
                }
            }

            foreach ($rowsWithoutIdentity as $row) {
                if ($database->table($table)->where($row)->exists()) {
                    $unchanged++;
                    continue;
                }
                $database->table($table)->insert($row);
                $inserted++;
            }
        });

        $appliedIdentityRows = $this->rowsByIdentity($database, $table, $decodedRows, $identity);
        foreach ($decodedRows as $row) {
            $identityValues = $this->identityValues($row, $identity);
            if ($identityValues === []) {
                if (!$database->table($table)->where($row)->exists()) {
                    throw new \RuntimeException("Receiver row verification failed: {$connectionKey}.{$table}");
                }
                $verified++;
                continue;
            }

            $applied = $appliedIdentityRows[$this->identityKey($identityValues)] ?? null;
            if ($applied === null || $this->rowHash($applied, $columnTypes) !== $this->rowHash($row, $columnTypes)) {
                throw new \RuntimeException("Receiver row verification failed: {$connectionKey}.{$table}");
            }
            $verified++;
        }

        return [
            'inserted' => $inserted,
            'updated' => $updated,
            'unchanged' => $unchanged,
            'verified' => $verified,
            'received' => count($rows),
        ];
    }

    private function rowsByIdentity(
        Connection $database,
        string $table,
        array $rows,
        array $identity
    ): array {
        $identityRows = array_values(array_filter(
            $rows,
            fn (array $row): bool => $this->identityValues($row, $identity) !== []
        ));
        $mapped = [];

        if ($identityRows === []) {
            return $mapped;
        }

        $records = $database->table($table)
            ->where(function (Builder $query) use ($identityRows, $identity): void {
                foreach ($identityRows as $row) {
                    $identityValues = $this->identityValues($row, $identity);
                    $query->orWhere(function (Builder $identityQuery) use ($identityValues): void {
                        foreach ($identityValues as $column => $value) {
                            $identityQuery->where($column, $value);
                        }
                    });
                }
            })
            ->get();

        foreach ($records as $record) {
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
        return hash('sha256', (string) json_encode(
            $this->encodeRow($identityValues),
            JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        ));
    }

    public function advanceSequence(string $connectionKey, string $table): void
    {
        $connection = DatabaseManagerService::connectionName($connectionKey);
        DatabaseManagerService::structure($connection, $table);
        $driver = DB::connection($connection)->getDriverName();
        $identity = $this->identityColumns($connection, $table);
        $column = count($identity) === 1 ? $identity[0] : null;

        if ($driver !== 'pgsql' || $column === null) {
            return;
        }

        $sequence = DB::connection($connection)->selectOne(
            'SELECT pg_get_serial_sequence(?, ?) AS sequence_name',
            [$table, $column]
        );
        $sequenceName = $sequence?->sequence_name;
        if ($sequenceName === null) {
            return;
        }

        $maximum = DB::connection($connection)->table($table)->max($column);
        DB::connection($connection)->select('SELECT setval(?, ?, ?)', [
            $sequenceName,
            max(1, (int) $maximum),
            $maximum !== null,
        ]);
    }

    private function identityColumns(string $connection, string $table): array
    {
        $indexes = Schema::connection($connection)->getIndexes($table);
        $uniqueIndexes = [];

        foreach ($indexes as $index) {
            if (!empty($index['primary'])) {
                return array_values($index['columns'] ?? []);
            }
        }
        foreach ($indexes as $index) {
            if (!empty($index['unique'])) {
                $uniqueIndexes[] = [
                    'name' => (string) ($index['name'] ?? ''),
                    'columns' => array_values($index['columns'] ?? []),
                ];
            }
        }
        usort($uniqueIndexes, static fn (array $left, array $right): int => strcmp(
            $left['name'] . ':' . implode(',', $left['columns']),
            $right['name'] . ':' . implode(',', $right['columns'])
        ));

        return $uniqueIndexes[0]['columns'] ?? [];
    }

    private function identityValues(array $row, array $identity): array
    {
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

    private function orderTablesByDependencies(string $connection, array $tables): array
    {
        $dependencies = [];
        $ordered = [];
        $remaining = $tables;

        foreach ($tables as $tableName => $table) {
            $dependencies[$tableName] = [];
            foreach (Schema::connection($connection)->getForeignKeys($tableName) as $foreignKey) {
                $foreignTable = $this->bareTableName((string) ($foreignKey['foreign_table'] ?? ''));
                if ($foreignTable !== $tableName && isset($tables[$foreignTable])) {
                    $dependencies[$tableName][$foreignTable] = true;
                }
            }
        }

        while ($remaining !== []) {
            $progressed = false;
            foreach ($remaining as $tableName => $table) {
                $unresolved = array_diff(array_keys($dependencies[$tableName]), array_keys($ordered));
                if ($unresolved !== []) {
                    continue;
                }
                $ordered[$tableName] = $table;
                unset($remaining[$tableName]);
                $progressed = true;
            }
            if (!$progressed) {
                foreach ($remaining as $tableName => $table) {
                    $ordered[$tableName] = $table;
                }
                break;
            }
        }

        return array_values($ordered);
    }

    private function bareTableName(string $table): string
    {
        $position = strrpos($table, '.');
        return $position === false ? $table : substr($table, $position + 1);
    }

    private function rowHash(array $row, array $columnTypes): string
    {
        foreach ($row as $column => $value) {
            $type = strtolower((string) ($columnTypes[$column] ?? ''));
            if (is_string($value) && in_array($type, ['json', 'jsonb'], true)) {
                try {
                    $row[$column] = $this->canonicalizeJson(json_decode($value, true, 512, JSON_THROW_ON_ERROR));
                } catch (\JsonException) {
                    $row[$column] = $value;
                }
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
