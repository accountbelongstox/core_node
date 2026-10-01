<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Models\Model;

class MediaIngestPayload
{
    public function fillMissing(Model $model, array $incoming): bool
    {
        $changed = false;

        foreach ($incoming as $column => $value) {
            if ($this->isEmpty($value) || !$this->isEmpty($model->getAttribute($column))) {
                continue;
            }
            $model->setAttribute($column, $value);
            $changed = true;
        }

        return $changed;
    }

    public function isEmpty(mixed $value): bool
    {
        return $value === null
            || (is_string($value) && trim($value) === '')
            || (is_array($value) && $value === [])
            || $value === 0
            || $value === 0.0;
    }

    public function pick(array $data, array $allowed): array
    {
        $result = [];

        foreach ($allowed as $key) {
            if (array_key_exists($key, $data)) {
                $result[$key] = $data[$key];
            }
        }

        return $result;
    }

    public function normalizeLanguage(string $language): string
    {
        return AppQyV1TableMaps::normalizeLangCode($language);
    }
}
