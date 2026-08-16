<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * DB-driven TTS variant specs per language (app_qy_v1_tts_variant_specs).
 *
 * One row per (lang, variant_key) describing the accent/gender the worker
 * should synthesize. is_primary pins the canonical primary variant (variant_key
 * '') whose file lives at {lang}/{content_id}.mp3; non-primary variants use the
 * suffixed path {lang}/{content_id}_{variant_key}.mp3.
 *
 * Seeded idempotently at sys:init. variantsForLanguage() is the single read path
 * shared by the sentence-audio + word-audio services.
 */
class AppQyV1TtsVariantSpecModel extends AppQyV1Model
{
    protected ?string $appTableSuffix = 'tts_variant_specs';

    protected $fillable = [
        'lang',
        'variant_key',
        'accent',
        'gender',
        'is_primary',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
        ];
    }

    /**
     * Canonical default seed rows. 3 voices per language (the "each sentence
     * generates 3 voices" default): en is accent-specific (us_f/uk_f/us_m);
     * zh/ja/ko are gender-varied (accent null - those engines have no us/uk
     * distinction). The count is dynamic via variantsForLanguage() - add/remove
     * rows to change it per lang.
     *
     * @var array<int, array{lang:string, variant_key:string, accent:?string, gender:?string, is_primary:bool}>
     */
    public const DEFAULT_SPECS = [
        ['lang' => 'en', 'variant_key' => '', 'accent' => 'us', 'gender' => 'female', 'is_primary' => true],
        ['lang' => 'en', 'variant_key' => 'uk_f', 'accent' => 'uk', 'gender' => 'female', 'is_primary' => false],
        ['lang' => 'en', 'variant_key' => 'us_m', 'accent' => 'us', 'gender' => 'male', 'is_primary' => false],
        ['lang' => 'zh', 'variant_key' => '', 'accent' => null, 'gender' => 'female', 'is_primary' => true],
        ['lang' => 'zh', 'variant_key' => 'alt_f', 'accent' => null, 'gender' => 'female', 'is_primary' => false],
        ['lang' => 'zh', 'variant_key' => 'm', 'accent' => null, 'gender' => 'male', 'is_primary' => false],
        ['lang' => 'ja', 'variant_key' => '', 'accent' => null, 'gender' => 'female', 'is_primary' => true],
        ['lang' => 'ja', 'variant_key' => 'alt_f', 'accent' => null, 'gender' => 'female', 'is_primary' => false],
        ['lang' => 'ja', 'variant_key' => 'm', 'accent' => null, 'gender' => 'male', 'is_primary' => false],
        ['lang' => 'ko', 'variant_key' => '', 'accent' => null, 'gender' => 'female', 'is_primary' => true],
        ['lang' => 'ko', 'variant_key' => 'alt_f', 'accent' => null, 'gender' => 'female', 'is_primary' => false],
        ['lang' => 'ko', 'variant_key' => 'm', 'accent' => null, 'gender' => 'male', 'is_primary' => false],
    ];

    /**
     * Idempotent upsert of the canonical default variant specs. Safe to re-run;
     * never deletes operator-added specs, only inserts/updates the defaults.
     *
     * @return array{seeded:int, updated:int}
     */
    public static function seedDefaults(): array
    {
        $seeded = 0;
        $updated = 0;
        $languages = array_values(array_unique(array_column(self::DEFAULT_SPECS, 'lang')));
        $existing = self::query()
            ->whereIn('lang', $languages)
            ->get(['lang', 'variant_key', 'accent', 'gender', 'is_primary'])
            ->keyBy(static fn (self $row): string => $row->lang . "\0" . $row->variant_key);

        foreach (self::DEFAULT_SPECS as $definition) {
            $row = $existing->get($definition['lang'] . "\0" . $definition['variant_key']);
            if ($row === null) {
                $seeded++;
                continue;
            }

            if ($row->accent !== $definition['accent']
                || $row->gender !== $definition['gender']
                || (bool) $row->is_primary !== $definition['is_primary']) {
                $updated++;
            }
        }

        self::query()->upsert(
            self::DEFAULT_SPECS,
            ['lang', 'variant_key'],
            ['accent', 'gender', 'is_primary']
        );

        return ['seeded' => $seeded, 'updated' => $updated];
    }

    /**
     * Variant specs for $lang, ordered is_primary DESC (primary first) then
     * variant_key. Identical return shape across sentence + word audio.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public static function variantsForLanguage(string $lang): array
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);
        $rows = self::query()
            ->where('lang', $normalized)
            ->orderByDesc('is_primary')
            ->orderBy('variant_key')
            ->get(['variant_key', 'accent', 'gender']);
        if ($rows->isEmpty()) {
            throw new \RuntimeException("No TTS variant specs are configured for {$normalized}.");
        }

        return $rows->map(static fn (self $row): array => [
            'key' => (string) $row->variant_key,
            'accent' => is_string($row->accent) && $row->accent !== '' ? $row->accent : null,
            'gender' => (string) $row->gender,
        ])->all();
    }

    /**
     * Full spec rows for $lang (lang + variant_key + accent + gender + is_primary)
     * for the variant-specs API.
     *
     * @return array<int,array{lang:string,variant_key:string,accent:?string,gender:string,is_primary:bool}>
     */
    public static function listForLanguage(string $lang): array
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);

        return self::query()
            ->where('lang', $normalized)
            ->orderByDesc('is_primary')
            ->orderBy('variant_key')
            ->get(['variant_key', 'accent', 'gender', 'is_primary'])
            ->map(static function (self $row) use ($normalized): array {
                return [
                    'lang' => $normalized,
                    'variant_key' => (string) $row->variant_key,
                    'accent' => is_string($row->accent) && $row->accent !== '' ? $row->accent : null,
                    'gender' => (string) $row->gender,
                    'is_primary' => (bool) $row->is_primary,
                ];
            })
            ->all();
    }

    /**
     * Replace ALL specs for $lang with $specs (delete + insert). Ensures exactly
     * one is_primary (the first spec if none flagged). Never deletes other langs.
     *
     * @param array<int,array{variant_key:string,accent:?string,gender:string,is_primary?:bool}> $specs
     * @return array<int,array{lang:string,variant_key:string,accent:?string,gender:string,is_primary:bool}>
     */
    public static function replaceForLanguage(string $lang, array $specs): array
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);
        $clean = [];
        $seenPrimary = false;
        foreach ($specs as $spec) {
            if (!is_array($spec)) {
                continue;
            }
            $key = (string) ($spec['variant_key'] ?? '');
            $gender = (string) ($spec['gender'] ?? 'female');
            $accent = $spec['accent'] ?? null;
            if (is_string($accent) && $accent === '') {
                $accent = null;
            }
            $isPrimary = (bool) ($spec['is_primary'] ?? false);
            if ($isPrimary && !$seenPrimary) {
                $seenPrimary = true;
            } else {
                $isPrimary = false;
            }
            $clean[] = [
                'lang' => $normalized,
                'variant_key' => $key,
                'accent' => $accent,
                'gender' => $gender,
                'is_primary' => $isPrimary,
            ];
        }
        if (!$seenPrimary && $clean) {
            $clean[0]['is_primary'] = true;
        }

        $model = new static();
        $model->getConnection()->transaction(static function () use ($clean, $normalized): void {
            self::query()->where('lang', $normalized)->delete();
            foreach ($clean as $row) {
                self::create($row);
            }
        });

        return $clean;
    }

    /**
     * Delete one variant spec (lang + variant_key). Returns whether a row was removed.
     */
    public static function deleteVariant(string $lang, string $variantKey): bool
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);

        return (bool) self::query()
            ->where('lang', $normalized)
            ->where('variant_key', $variantKey)
            ->delete();
    }
}
