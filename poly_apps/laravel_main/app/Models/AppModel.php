<?php

namespace App\Models;

use App\Providers\AppTablePrefixServiceProvider;
use App\Services\SafeMigrationHelper;
use Illuminate\Support\Facades\Schema;

abstract class AppModel extends Model
{
    protected ?string $appKey = null;
    protected ?string $appTableMapKey = null;
    protected ?string $appTableSuffix = null;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        if ($this->appTableMapKey !== null) {
            $this->setTable($this->appTableFromMapKey($this->appTableMapKey));
        } elseif ($this->appTableSuffix !== null) {
            $this->setAppTable($this->appTableSuffix);
        }
    }

    public function getConnectionName(): ?string
    {
        if ($this->appKey !== null) {
            return AppTablePrefixServiceProvider::getConnection($this->appKey);
        }

        return parent::getConnectionName();
    }

    protected function appTableFromMapKey(string $mapKey): string
    {
        return $this->appTable($mapKey);
    }

    protected function setAppTable(string $suffix): void
    {
        $this->setTable($this->appTable($suffix));
    }

    protected function appTable(string $suffix): string
    {
        return AppTablePrefixServiceProvider::buildTableName($this->appKey, $suffix);
    }

    public static function createRecord(array $attributes): static
    {
        return static::query()->create($attributes);
    }

    public static function findById(int|string $id): ?static
    {
        return static::query()->find($id);
    }

    public static function configuredTableExists(): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function configuredTableRowCount(): int
    {
        return static::configuredTableExists() ? static::query()->count() : 0;
    }

    /**
     * Align this model's table to the given structure via the canonical
     * SafeMigrationHelper engine (add-only, idempotent; reconciles drifted
     * indexes in place). Single plumbing shared by every per-sys:init
     * structure ensure: connection and table resolve from the model itself.
     *
     * @return array SafeMigrationHelper::alignTableStructureFromArray() result
     */
    public static function ensureTableAligned(array $tableStructure): array
    {
        $model = new static();

        return SafeMigrationHelper::alignTableStructureFromArray(
            $model->getConnectionName(),
            $model->getTable(),
            $tableStructure,
            [
                'shrink_columns' => false,
                'modify_columns' => true,
                'add_indexes' => true,
            ]
        );
    }
}
