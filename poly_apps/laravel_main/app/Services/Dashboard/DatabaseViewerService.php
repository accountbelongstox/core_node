<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Services\Dashboard;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DatabaseViewerService
{
    /** @var string */
    protected $connection;

    public function __construct(?string $connection = null)
    {
        $this->connection = $connection ?? config('database.default');
    }

    public function setConnection(string $connection): self
    {
        $this->connection = $connection;
        return $this;
    }

    /**
     * @return array<int, string>
     */
    public function getTables(): array
    {
        // ONE driver-agnostic path: Laravel's native getTableListing() works on
        // sqlite / pgsql / mysql (no SHOW TABLES / pg_tables / sqlite_master).
        // $schemaQualified=false yields bare names on pgsql ("x", not
        // "public.x"); sort to preserve the previous ORDER BY ordering.
        $tables = Schema::connection($this->connection)->getTableListing(null, false);
        sort($tables);
        return $tables;
    }

    /**
     * @return array<int, array{name: string, type: string, nullable: string, key: string, default: string|null, extra: string}>
     */
    public function getTableStructure(string $table): array
    {
        // ONE driver-agnostic path via Laravel's native Schema builder.
        // getColumns() -> ['name','type','type_name','nullable'(bool),'default',
        // 'auto_increment'(bool),...]; getIndexes() supplies the primary-key
        // flag. No SHOW COLUMNS / information_schema / PRAGMA. The returned
        // shape (name/type/nullable[YES|NO]/key[PRI|'']/default/extra) is
        // preserved for existing callers.
        $schema = Schema::connection($this->connection);

        $primaryKeyColumns = [];
        foreach ($schema->getIndexes($table) as $index) {
            if (!empty($index['primary'])) {
                $primaryKeyColumns = $index['columns'] ?? [];
                break;
            }
        }

        $result = [];
        foreach ($schema->getColumns($table) as $col) {
            $result[] = [
                'name' => $col['name'],
                'type' => $col['type'] ?? ($col['type_name'] ?? ''),
                'nullable' => empty($col['nullable']) ? 'NO' : 'YES',
                'key' => in_array($col['name'], $primaryKeyColumns, true) ? 'PRI' : '',
                'default' => $col['default'] ?? null,
                'extra' => !empty($col['auto_increment']) ? 'auto_increment' : '',
            ];
        }
        return $result;
    }

    /**
     * @return array{data: array, total: int, per_page: int, current_page: int, last_page: int}
     */
    public function getTableData(string $table, int $page = 1, int $perPage = 20): array
    {
        $perPage = max(1, min(100, $perPage));
        $query = DB::connection($this->connection)->table($table);
        $total = $query->count();
        $data = $query->offset(($page - 1) * $perPage)->limit($perPage)->get()
            ->map(fn ($row) => array_map([$this, 'sanitizeValue'], (array) $row))
            ->all();
        return [
            'data' => $data,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => (int) ceil($total / $perPage),
        ];
    }

    /**
     * Make a raw cell JSON-safe: pgsql bytea arrives as a PHP stream resource,
     * and serialized cache payloads may contain non-UTF-8 bytes that would make
     * response()->json() throw "Malformed UTF-8 characters".
     *
     * @param mixed $value
     * @return mixed
     */
    protected function sanitizeValue($value)
    {
        if (is_resource($value)) {
            $value = stream_get_contents($value);
        }
        if (is_string($value) && !mb_check_encoding($value, 'UTF-8')) {
            return '0x' . bin2hex(substr($value, 0, 256)) . (strlen($value) > 256 ? '…' : '');
        }
        return $value;
    }
}
