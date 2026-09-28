<?php

namespace App\Models\Concerns;

use Illuminate\Support\Facades\Schema;

trait QueriesDiffIdPages
{
    public function diffIdTableExists(): bool
    {
        return Schema::connection($this->getConnectionName())->hasTable($this->getTable());
    }

    public function diffIdUpperBound(): int
    {
        return (int) ($this->newQuery()->max('id') ?? 0);
    }

    public function diffIdsBetween(int $cursor, int $upperBound, int $limit): array
    {
        return $this->newQuery()
            ->where('id', '>', $cursor)
            ->where('id', '<=', $upperBound)
            ->orderBy('id')
            ->limit($limit)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();
    }
}
