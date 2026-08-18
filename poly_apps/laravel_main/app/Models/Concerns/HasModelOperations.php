<?php

namespace App\Models\Concerns;

trait HasModelOperations
{
    public function saveRecord(array $options = []): bool
    {
        return $this->save($options);
    }

    public function updateRecord(array $attributes, array $options = []): bool
    {
        return $this->update($attributes, $options);
    }

    public function deleteRecord(): ?bool
    {
        return $this->delete();
    }

    public function refreshRecord(): static
    {
        return $this->refresh();
    }

    public function freshRecord(array|string $with = []): ?static
    {
        return $this->fresh($with);
    }

    public function loadRecordRelations(array|string $relations): static
    {
        return $this->load($relations);
    }

    public function loadMissingRecordRelations(array|string $relations): static
    {
        return $this->loadMissing($relations);
    }

    public function incrementRecord(string $column, int|float $amount = 1, array $extra = []): int
    {
        return $this->increment($column, $amount, $extra);
    }
}
