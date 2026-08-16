<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Models;

use Illuminate\Support\Collection;

/**
 * A membership tier / price package (TRIAL|PRO|PRO_PLUS|ULTIMATE).
 */
class PddToolV1PackageModel extends PddToolV1Model
{
    protected ?string $appTableMapKey = 'PACKAGES';

    protected $fillable = [
        'code',
        'name',
        'price_month',
        'price_year',
        'max_orders',
        'max_pdd_accounts',
        'enabled',
    ];

    protected $casts = [
        'price_month' => 'float',
        'price_year' => 'float',
        'max_orders' => 'integer',
        'max_pdd_accounts' => 'integer',
        'enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public static function ordered(): Collection
    {
        return static::query()->orderBy('id')->get();
    }

    public static function findByCodeOrNew(string $code): self
    {
        return static::query()->where('code', $code)->first() ?? new static();
    }

    public static function findByCode(string $code): ?self
    {
        return static::query()->where('code', $code)->first();
    }

    public static function enabledPackages(): Collection
    {
        return static::query()->where('enabled', true)->orderBy('id')->get();
    }

    public static function anyExists(): bool
    {
        return static::query()->exists();
    }

    public static function upsertPayloads(array $payloads): void
    {
        $codes = [];
        $rows = [];
        $timestamp = now();

        foreach ($payloads as $payload) {
            $item = (array) $payload;
            $code = (string) ($item['code'] ?? '');
            if ($code !== '') {
                $codes[] = $code;
            }
        }

        $existing = static::query()->whereIn('code', array_values(array_unique($codes)))->get()->keyBy('code');

        foreach ($payloads as $payload) {
            $item = (array) $payload;
            $code = (string) ($item['code'] ?? '');
            if ($code === '') {
                continue;
            }

            $current = $existing->get($code);
            $rows[] = [
                'code' => $code,
                'name' => (string) ($item['name'] ?? $current?->name ?? $code),
                'price_month' => array_key_exists('price_month', $item)
                    ? (float) $item['price_month']
                    : (float) ($current?->price_month ?? 0),
                'price_year' => array_key_exists('price_year', $item)
                    ? (float) $item['price_year']
                    : (float) ($current?->price_year ?? 0),
                'max_orders' => array_key_exists('max_orders', $item)
                    ? (int) $item['max_orders']
                    : (int) ($current?->max_orders ?? 10),
                'max_pdd_accounts' => array_key_exists('max_pdd_accounts', $item)
                    ? (int) $item['max_pdd_accounts']
                    : (int) ($current?->max_pdd_accounts ?? 2),
                'enabled' => array_key_exists('enabled', $item)
                    ? filter_var($item['enabled'], FILTER_VALIDATE_BOOLEAN)
                    : (bool) ($current?->enabled ?? true),
                'created_at' => $current?->created_at ?? $timestamp,
                'updated_at' => $timestamp,
            ];
        }

        if ($rows !== []) {
            static::query()->upsert(
                $rows,
                ['code'],
                [
                    'name', 'price_month', 'price_year', 'max_orders',
                    'max_pdd_accounts', 'enabled', 'updated_at',
                ]
            );
        }
    }

    public static function insertMissing(array $rows): int
    {
        $timestamp = now();

        foreach ($rows as &$row) {
            $row['created_at'] = $row['created_at'] ?? $timestamp;
            $row['updated_at'] = $row['updated_at'] ?? $timestamp;
        }
        unset($row);

        return $rows === [] ? 0 : static::query()->insertOrIgnore(array_values($rows));
    }
}
