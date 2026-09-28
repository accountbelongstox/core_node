<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

trait BindsAppQyV1LanguageTable
{
    abstract protected static function resolveLanguageTable(string $language): string;

    public function bindLanguage(string $language): static
    {
        $this->setTable(static::resolveLanguageTable($language));

        return $this;
    }

    public static function for(string $language): static
    {
        return (new static())->bindLanguage($language);
    }

    public static function onLang(string $language): Builder
    {
        return static::for($language)->newQuery();
    }

    public static function tableExists(string $language): bool
    {
        $model = static::for($language);

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function tableRowCount(string $language): int
    {
        return static::tableExists($language) ? static::onLang($language)->count() : 0;
    }

    public static function totalRowCount(array $languages): int
    {
        $model = new static();
        $connection = $model->getConnection();
        $existingTables = array_fill_keys(
            $connection->getSchemaBuilder()->getTableListing(null, false),
            true
        );
        $aggregateQuery = null;
        $table = '';
        $tableQuery = null;

        foreach ($languages as $language) {
            $table = static::resolveLanguageTable((string) $language);
            if (!isset($existingTables[$table])) {
                continue;
            }

            $tableQuery = $connection->table($table)->selectRaw('COUNT(*) AS aggregate');
            if ($aggregateQuery === null) {
                $aggregateQuery = $tableQuery;
            } else {
                $aggregateQuery->unionAll($tableQuery);
            }
        }

        if ($aggregateQuery === null) {
            return 0;
        }

        return (int) $connection->query()
            ->fromSub($aggregateQuery, 'language_row_counts')
            ->sum('aggregate');
    }
}
