<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait BuildsModelPagination
{
    protected static function paginateQuery(
        Builder $query,
        string $resultKey,
        int $page,
        int $perPage,
        array $columns = ['*']
    ): array {
        $paginator = $query->paginate($perPage, $columns, 'page', $page);

        return [
            $resultKey => $paginator,
            'total' => $paginator->total(),
        ];
    }
}
