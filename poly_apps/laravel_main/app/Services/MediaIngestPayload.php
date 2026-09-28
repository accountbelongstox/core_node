<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Models\Model;

class MediaIngestPayload
{
    public function legacyV3(
        string $sourceType,
        array $sourceData,
        array $sentences
    ): array {
        $primaryLanguage = isset($sourceData['language'])
            ? AppQyV1TableMaps::normalizeLangCode((string) $sourceData['language'])
            : '';
        $slots = [];
        $maxChapterIndex = 0;
        $chapters = [];

        foreach ($sentences as $sentence) {
            if (!is_array($sentence)) {
                continue;
            }

            $text = isset($sentence['text']) ? (string) $sentence['text'] : '';
            if ($this->isEmpty($text)) {
                continue;
            }

            $language = isset($sentence['language']) && $sentence['language'] !== ''
                ? AppQyV1TableMaps::normalizeLangCode((string) $sentence['language'])
                : $primaryLanguage;
            if ($language === '') {
                $language = 'en';
            }

            $chapterIndex = isset($sentence['chapter_index']) ? (int) $sentence['chapter_index'] : 0;
            $maxChapterIndex = max($maxChapterIndex, $chapterIndex);
            $slots[] = [
                'chapter_index' => $chapterIndex,
                'grain' => isset($sentence['grain'])
                    ? (string) $sentence['grain']
                    : ($sourceType === 'subtitle' ? 'cue' : 'sentence'),
                'seq' => isset($sentence['seq']) ? (int) $sentence['seq'] : 0,
                'primary_language' => $primaryLanguage !== '' ? $primaryLanguage : $language,
                'langs' => [$language => $text],
                'seg_index' => $sentence['seg_index'] ?? null,
                'sub_idx' => $sentence['sub_idx'] ?? null,
                'start_sec' => $sentence['start_sec'] ?? null,
                'end_sec' => $sentence['end_sec'] ?? null,
            ];
        }

        for ($index = 0; $index <= $maxChapterIndex; $index++) {
            $title = 'Chapter ' . ($index + 1);
            $chapters[] = [
                'chapter_index' => $index,
                'titles' => $primaryLanguage !== '' ? [$primaryLanguage => $title] : ['en' => $title],
            ];
        }

        return [$chapters, $slots];
    }

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
