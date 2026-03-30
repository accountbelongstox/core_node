<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
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
        $driver = DB::connection($this->connection)->getDriverName();
        if ($driver === 'mysql') {
            $result = DB::connection($this->connection)
                ->select('SHOW TABLES');
            $key = 'Tables_in_' . DB::connection($this->connection)->getDatabaseName();
            return array_map(fn ($row) => $row->{$key}, $result);
        }
        if ($driver === 'pgsql') {
            $rows = DB::connection($this->connection)
                ->select("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
            return array_map(fn ($row) => $row->tablename, $rows);
        }
        if ($driver === 'sqlite') {
            $rows = DB::connection($this->connection)
                ->select("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
            return array_map(fn ($row) => $row->name, $rows);
        }
        return Schema::connection($this->connection)->getTableListing();
    }

    /**
     * @return array<int, array{name: string, type: string, nullable: string, key: string, default: string|null, extra: string}>
     */
    public function getTableStructure(string $table): array
    {
        $driver = DB::connection($this->connection)->getDriverName();
        if ($driver === 'mysql') {
            $columns = DB::connection($this->connection)->select("SHOW COLUMNS FROM `{$table}`");
            return array_map(function ($col) {
                return [
                    'name' => $col->Field,
                    'type' => $col->Type,
                    'nullable' => $col->Null,
                    'key' => $col->Key ?? '',
                    'default' => $col->Default,
                    'extra' => $col->Extra ?? '',
                ];
            }, $columns);
        }
        if ($driver === 'pgsql') {
            $columns = DB::connection($this->connection)->select(
                "SELECT column_name AS name, data_type AS type, is_nullable AS nullable, column_default AS default
                 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = ?
                 ORDER BY ordinal_position",
                [$table]
            );
            return array_map(function ($col) {
                return [
                    'name' => $col->name,
                    'type' => $col->type,
                    'nullable' => $col->nullable,
                    'key' => '',
                    'default' => $col->default,
                    'extra' => '',
                ];
            }, $columns);
        }
        if ($driver === 'sqlite') {
            $columns = DB::connection($this->connection)->select("PRAGMA table_info(`{$table}`)");
            return array_map(function ($col) {
                return [
                    'name' => $col->name,
                    'type' => $col->type ?? '',
                    'nullable' => $col->notnull ? 'NO' : 'YES',
                    'key' => $col->pk ? 'PRI' : '',
                    'default' => $col->dflt_value ?? null,
                    'extra' => '',
                ];
            }, $columns);
        }
        $columns = Schema::connection($this->connection)->getColumnListing($table);
        $result = [];
        foreach ($columns as $name) {
            $result[] = [
                'name' => $name,
                'type' => '',
                'nullable' => '',
                'key' => '',
                'default' => null,
                'extra' => '',
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
        $data = $query->offset(($page - 1) * $perPage)->limit($perPage)->get();
        return [
            'data' => $data,
            'total' => $total,
            'per_page' => $perPage,
            'current_page' => $page,
            'last_page' => (int) ceil($total / $perPage),
        ];
    }
}
