<?php

namespace App\Providers;

/**
 * Abstract base for all table-map classes ({app}TableMaps / GlobalTablesMap).
 *
 * Subclasses contribute only their mapping data (public constants shaped as
 * ['tablename' => ..., 'fields' => [...]]) plus a table prefix; the shared
 * key->constant lookup logic lives here. Missing-key behavior is soft-fail by
 * default (app maps convention); GlobalTablesMap overrides the missing* hooks
 * to throw InvalidArgumentException.
 */
abstract class TableMaps
{
    /**
     * App table prefix ('' for unprefixed global maps).
     */
    abstract protected static function getTablePrefix(): string;

    /**
     * All available table keys for this map.
     */
    abstract public static function getAvailableTableKeys(): array;

    /**
     * Resolve a caller-supplied key to the full constant name: app maps prepend
     * the prefix when absent; unprefixed maps uppercase the key.
     */
    protected static function resolveFullKey(string $tableKey): string
    {
        $prefix = static::getTablePrefix();
        if ($prefix === '') {
            return strtoupper($tableKey);
        }
        if (!str_starts_with(strtolower($tableKey), strtolower($prefix) . '_')) {
            return $prefix . '_' . $tableKey;
        }
        return $tableKey;
    }

    /**
     * Fully-qualified constant name for a table key (static::class keeps late
     * static binding reliable for defined()/constant()).
     */
    protected static function resolveConstantName(string $tableKey): string
    {
        return static::class . '::' . static::resolveFullKey($tableKey);
    }

    /**
     * Get the full table name by key.
     */
    public static function getTableName(string $tableKey): string
    {
        $constantName = static::resolveConstantName($tableKey);
        if (defined($constantName)) {
            $tableSuffix = constant($constantName)['tablename'];
            $prefix = static::getTablePrefix();
            return $prefix === '' ? $tableSuffix : "{$prefix}_{$tableSuffix}";
        }
        return static::missingTableName($tableKey);
    }

    /**
     * Get the field name by table key and field key.
     */
    public static function getFieldName(string $tableKey, string $fieldKey): string
    {
        $constantName = static::resolveConstantName($tableKey);
        if (defined($constantName)) {
            $tableMap = constant($constantName);
            if (isset($tableMap['fields'][$fieldKey])) {
                return $tableMap['fields'][$fieldKey];
            }
        }
        return static::missingFieldName($tableKey, $fieldKey);
    }

    /**
     * Get all fields for a table.
     */
    public static function getTableFields(string $tableKey): array
    {
        $constantName = static::resolveConstantName($tableKey);
        if (defined($constantName)) {
            return constant($constantName)['fields'];
        }
        return static::missingTableFields($tableKey);
    }

    /**
     * Check if a table key exists.
     */
    public static function hasTableKey(string $tableKey): bool
    {
        return defined(static::resolveConstantName($tableKey));
    }

    /**
     * Get all table mappings keyed by table key.
     */
    public static function getAllTableMappings(): array
    {
        $mappings = [];
        foreach (static::getAvailableTableKeys() as $tableKey) {
            $constantName = static::resolveConstantName($tableKey);
            if (defined($constantName)) {
                $mappings[$tableKey] = constant($constantName);
            }
        }
        return $mappings;
    }

    protected static function missingTableName(string $tableKey): string
    {
        return '';
    }

    protected static function missingFieldName(string $tableKey, string $fieldKey): string
    {
        return $fieldKey;
    }

    protected static function missingTableFields(string $tableKey): array
    {
        return [];
    }
}
