<?php

namespace App\Models;

use App\Providers\AppTablePrefixServiceProvider;
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
}
