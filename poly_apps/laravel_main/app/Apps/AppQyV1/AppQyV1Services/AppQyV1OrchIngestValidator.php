<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

/**
 * Linear validation of the heavy arrays of an orchestration ingest task
 * (sentences, resources, segments and their timelines).
 *
 * Laravel's wildcard rules (`segments.*.timeline.*.type`) flatten the whole
 * request into dot keys and match every rule against every key; a 3.5 MB
 * ingest with tens of thousands of timeline entries then spends tens of
 * seconds validating before any work is done. This validator visits each
 * element once and enforces the same constraints, reporting errors under the
 * same `tasks.<n>.<field>.<i>...` paths.
 */
final class AppQyV1OrchIngestValidator
{
    public const SENTENCE_LIMIT = 5000;
    public const RESOURCE_LIMIT = 2000;
    public const SEGMENT_LIMIT = 2000;

    private const TEXT_MAX = 16000;
    private const LANGUAGE_MAX = 20;
    private const STATUS_MAX = 32;
    private const ERROR_LIMIT = 100;
    private const SHA256_PATTERN = '/^[a-fA-F0-9]{64}$/';
    private const RESOURCE_KINDS = ['word', 'sentence', 'phrase'];

    /**
     * @param array<string,mixed> $task
     * @return array<string,array<int,string>> errors keyed by attribute path
     */
    public function validateTask(int $position, array $task): array
    {
        $errors = [];
        $prefix = 'tasks.' . $position;

        $this->items($errors, $task, 'sentences', $prefix, self::SENTENCE_LIMIT, function (array &$errors, array $item, string $path): void {
            $this->sentence($errors, $item, $path);
        });
        $this->items($errors, $task, 'resources', $prefix, self::RESOURCE_LIMIT, function (array &$errors, array $item, string $path): void {
            $this->resource($errors, $item, $path);
        });
        $this->items($errors, $task, 'segments', $prefix, self::SEGMENT_LIMIT, function (array &$errors, array $item, string $path): void {
            $this->segment($errors, $item, $path);
        });

        return $errors;
    }

    /** @param callable(array<string,array<int,string>>&,array<string,mixed>,string):void $each */
    private function items(array &$errors, array $task, string $field, string $prefix, int $limit, callable $each): void
    {
        $path = $prefix . '.' . $field;

        if (!array_key_exists($field, $task) || $task[$field] === null) {
            return;
        }
        if (!is_array($task[$field])) {
            $this->fail($errors, $path, 'validation.array');

            return;
        }
        if (count($task[$field]) > $limit) {
            $this->fail($errors, $path, 'validation.max.array', ['max' => $limit]);

            return;
        }
        foreach ($task[$field] as $index => $item) {
            if ($this->full($errors)) {
                return;
            }
            if (!is_array($item)) {
                $this->fail($errors, $path . '.' . $index, 'validation.array');
                continue;
            }
            $each($errors, $item, $path . '.' . $index);
        }
    }

    private function sentence(array &$errors, array $item, string $path): void
    {
        $this->requiredText($errors, $item, 'text', $path);
        $this->optionalString($errors, $item, 'language', $path, self::LANGUAGE_MAX);
        $this->optionalInteger($errors, $item, 'seq', $path);
        if (isset($item['languages']) && !is_array($item['languages'])) {
            $this->fail($errors, $path . '.languages', 'validation.array');
        }
    }

    private function resource(array &$errors, array $item, string $path): void
    {
        if (!isset($item['kind']) || $item['kind'] === '') {
            $this->fail($errors, $path . '.kind', 'validation.required');
        } elseif (!in_array($item['kind'], self::RESOURCE_KINDS, true)) {
            $this->fail($errors, $path . '.kind', 'validation.in');
        }
        $this->requiredText($errors, $item, 'text', $path);
        $this->optionalString($errors, $item, 'language', $path, self::LANGUAGE_MAX);
    }

    private function segment(array &$errors, array $item, string $path): void
    {
        $this->requiredInteger($errors, $item, 'index', $path, 0);
        if (!isset($item['sha256']) || $item['sha256'] === '') {
            $this->fail($errors, $path . '.sha256', 'validation.required');
        } elseif (!is_string($item['sha256'])) {
            $this->fail($errors, $path . '.sha256', 'validation.string');
        } elseif (preg_match(self::SHA256_PATTERN, $item['sha256']) !== 1) {
            $this->fail($errors, $path . '.sha256', 'validation.regex');
        }
        $this->optionalInteger($errors, $item, 'bytes', $path, 0);
        $this->optionalInteger($errors, $item, 'duration_ms', $path, 0);
        $this->optionalInteger($errors, $item, 'start', $path);
        $this->optionalInteger($errors, $item, 'end', $path);
        $this->optionalString($errors, $item, 'status', $path, self::STATUS_MAX);
        if (!isset($item['timeline'])) {
            return;
        }
        if (!is_array($item['timeline'])) {
            $this->fail($errors, $path . '.timeline', 'validation.array');

            return;
        }
        foreach ($item['timeline'] as $index => $entry) {
            if ($this->full($errors)) {
                return;
            }
            $entryPath = $path . '.timeline.' . $index;
            if (!is_array($entry)) {
                $this->fail($errors, $entryPath, 'validation.array');
                continue;
            }
            $this->optionalInteger($errors, $entry, 'seq', $entryPath);
            if (!isset($entry['type']) || $entry['type'] === '') {
                $this->fail($errors, $entryPath . '.type', 'validation.required');
            } elseif (!in_array($entry['type'], self::RESOURCE_KINDS, true)) {
                $this->fail($errors, $entryPath . '.type', 'validation.in');
            }
            $this->requiredInteger($errors, $entry, 'start_ms', $entryPath, 0);
            $this->requiredInteger($errors, $entry, 'end_ms', $entryPath, 0);
        }
    }

    private function requiredText(array &$errors, array $item, string $field, string $path): void
    {
        if (!isset($item[$field]) || $item[$field] === '') {
            $this->fail($errors, $path . '.' . $field, 'validation.required');
        } elseif (!is_string($item[$field])) {
            $this->fail($errors, $path . '.' . $field, 'validation.string');
        } elseif (mb_strlen($item[$field]) > self::TEXT_MAX) {
            $this->fail($errors, $path . '.' . $field, 'validation.max.string', ['max' => self::TEXT_MAX]);
        }
    }

    private function optionalString(array &$errors, array $item, string $field, string $path, int $max): void
    {
        if (!isset($item[$field])) {
            return;
        }
        if (!is_string($item[$field])) {
            $this->fail($errors, $path . '.' . $field, 'validation.string');
        } elseif (mb_strlen($item[$field]) > $max) {
            $this->fail($errors, $path . '.' . $field, 'validation.max.string', ['max' => $max]);
        }
    }

    private function optionalInteger(array &$errors, array $item, string $field, string $path, ?int $min = null): void
    {
        if (!isset($item[$field])) {
            return;
        }
        $this->integer($errors, $item[$field], $path . '.' . $field, $min);
    }

    private function requiredInteger(array &$errors, array $item, string $field, string $path, ?int $min = null): void
    {
        if (!isset($item[$field]) || $item[$field] === '') {
            $this->fail($errors, $path . '.' . $field, 'validation.required');

            return;
        }
        $this->integer($errors, $item[$field], $path . '.' . $field, $min);
    }

    private function integer(array &$errors, mixed $value, string $path, ?int $min): void
    {
        if (!is_int($value) && !(is_string($value) && preg_match('/^-?\d+$/', $value) === 1)) {
            $this->fail($errors, $path, 'validation.integer');
        } elseif ($min !== null && (int) $value < $min) {
            $this->fail($errors, $path, 'validation.min.numeric', ['min' => $min]);
        }
    }

    private function full(array $errors): bool
    {
        return count($errors) >= self::ERROR_LIMIT;
    }

    private function fail(array &$errors, string $path, string $rule, array $parameters = []): void
    {
        $errors[$path][] = __($rule, $parameters + ['attribute' => $path]);
    }
}
