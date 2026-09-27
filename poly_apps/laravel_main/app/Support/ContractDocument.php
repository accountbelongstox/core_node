<?php

namespace App\Support;

use RuntimeException;

/**
 * Typed dotted-path reads over a decoded contract document (ServiceContract).
 * A missing or mistyped key throws.
 */
final class ContractDocument
{
    public static function value(array $document, string $path): mixed
    {
        $value = $document;

        foreach (explode('.', $path) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return null;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    public static function string(array $document, string $path, string $label): string
    {
        $value = self::value($document, $path);

        if (!is_string($value) || $value === '') {
            throw new RuntimeException("Unknown {$label} string: {$path}");
        }

        return $value;
    }

    public static function positiveInt(array $document, string $path, string $label): int
    {
        $value = self::value($document, $path);

        if (!is_int($value) || $value < 1) {
            throw new RuntimeException("Unknown {$label} positive integer: {$path}");
        }

        return $value;
    }

    public static function boolean(array $document, string $path, string $label): bool
    {
        $value = self::value($document, $path);

        if (!is_bool($value)) {
            throw new RuntimeException("Unknown {$label} boolean: {$path}");
        }

        return $value;
    }

    /**
     * @return array<int, string>
     */
    public static function stringList(array $document, string $path, string $label): array
    {
        $value = self::value($document, $path);

        if (!is_array($value)
            || $value === []
            || array_filter($value, static fn (mixed $item): bool => !is_string($item) || $item === '') !== []) {
            throw new RuntimeException("Unknown {$label} string list: {$path}");
        }

        return array_values($value);
    }

    /**
     * @return array<string, mixed>
     */
    public static function section(array $document, string $path, string $label): array
    {
        $value = self::value($document, $path);

        if (!is_array($value) || $value === []) {
            throw new RuntimeException("Unknown {$label} section: {$path}");
        }

        return $value;
    }

    private function __construct()
    {
    }
}
