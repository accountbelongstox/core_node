<?php

namespace App\Apps\AppQyV1\AppQyV1Models\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Schema;

trait AppQyV1StudySourceQueries
{
    public static function studyMarkerColumnsReady(): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())
            ->hasColumn($model->getTable(), 'study_gen_status');
    }

    public static function studySourceCount(?string $search): int
    {
        return static::studySourceQuery($search)->count();
    }

    public static function studySourceRows(?string $search, int $offset, int $limit): Collection
    {
        $columns = static::STUDY_SOURCE_COLUMNS;

        if (static::studyMarkerColumnsReady()) {
            $columns[] = 'study_gen_status';
            $columns[] = 'study_gen_progress';
        }

        return static::studySourceQuery($search)
            ->select($columns)
            ->orderBy('id')
            ->offset($offset)
            ->limit($limit)
            ->get();
    }

    public static function sourceMetadata(string $sourceKey): mixed
    {
        return static::query()
            ->where(static::STUDY_SOURCE_KEY_COLUMN, $sourceKey)
            ->value('metadata');
    }

    public static function sourceLanguage(string $sourceKey): string
    {
        return (string) (static::query()
            ->where(static::STUDY_SOURCE_KEY_COLUMN, $sourceKey)
            ->value('language') ?? '');
    }

    public static function updateStudyMarker(string $sourceKey, array $attributes): int
    {
        return static::query()
            ->where(static::STUDY_SOURCE_KEY_COLUMN, $sourceKey)
            ->update($attributes);
    }

    private static function studySourceQuery(?string $search): Builder
    {
        $query = static::query();

        if ($search !== null && $search !== '') {
            $query->whereLike('title', "%{$search}%", caseSensitive: false);
        }

        return $query;
    }
}
