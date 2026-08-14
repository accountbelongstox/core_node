<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use Illuminate\Support\Facades\Log;

/**
 * DB-driven TTS variant specs per language (app_qy_v1_tts_variant_specs).
 *
 * One row per (lang, variant_key) describing the accent/gender the worker
 * should synthesize. is_primary pins the canonical primary variant (variant_key
 * '') whose file lives at {lang}/{content_id}.mp3; non-primary variants use the
 * suffixed path {lang}/{content_id}_{variant_key}.mp3.
 *
 * Seeded idempotently at sys:init. Reads fall back to the hardcoded spec set
 * (FALLBACK_SPECS) when the table is missing/empty so the pipeline stays usable
 * pre-migration. variantsForLanguage() is the single read path shared by the
 * sentence-audio + word-audio services.
 */
class AppQyV1TtsVariantSpecModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_variant_specs');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'lang',
        'variant_key',
        'accent',
        'gender',
        'is_primary',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
    ];

    /**
     * Hardcoded fallback spec set (used when the table is missing/empty). Kept
     * identical to the legacy hardcoded variantsForLanguage() so behavior is
     * preserved pre-migration. Primary variant_key is '' (the canonical primary
     * audio path {lang}/{content_id}.mp3).
     *
     * @var array<string, array<int, array{key:string,accent:?string,gender:string}>>
     */
    public const FALLBACK_SPECS = [
        'en' => [
            ['key' => '', 'accent' => 'us', 'gender' => 'female'],
            ['key' => 'uk_f', 'accent' => 'uk', 'gender' => 'female'],
            ['key' => 'us_m', 'accent' => 'us', 'gender' => 'male'],
        ],
        'zh' => [
            ['key' => '', 'accent' => null, 'gender' => 'female'],
            ['key' => 'alt_f', 'accent' => null, 'gender' => 'female'],
            ['key' => 'm', 'accent' => null, 'gender' => 'male'],
        ],
        'ja' => [
            ['key' => '', 'accent' => null, 'gender' => 'female'],
            ['key' => 'alt_f', 'accent' => null, 'gender' => 'female'],
            ['key' => 'm', 'accent' => null, 'gender' => 'male'],
        ],
        'ko' => [
            ['key' => '', 'accent' => null, 'gender' => 'female'],
            ['key' => 'alt_f', 'accent' => null, 'gender' => 'female'],
            ['key' => 'm', 'accent' => null, 'gender' => 'male'],
        ],
    ];

    /**
     * Canonical default seed rows. 3 voices per language (the "each sentence
     * generates 3 voices" default): en is accent-specific (us_f/uk_f/us_m);
     * zh/ja/ko are gender-varied (accent null - those engines have no us/uk
     * distinction). The count is dynamic via variantsForLanguage() - add/remove
     * rows to change it per lang. Mirrors FALLBACK_SPECS.
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
        try {
            foreach (self::DEFAULT_SPECS as $def) {
                $row = self::query()
                    ->where('lang', $def['lang'])
                    ->where('variant_key', $def['variant_key'])
                    ->first();
                if ($row === null) {
                    self::create($def);
                    $seeded++;
                } else {
                    $dirty = false;
                    if ($row->accent !== $def['accent']) {
                        $row->accent = $def['accent'];
                        $dirty = true;
                    }
                    if ($row->gender !== $def['gender']) {
                        $row->gender = $def['gender'];
                        $dirty = true;
                    }
                    if ((bool) $row->is_primary !== (bool) $def['is_primary']) {
                        $row->is_primary = $def['is_primary'];
                        $dirty = true;
                    }
                    if ($dirty) {
                        $row->save();
                        $updated++;
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1TtsVariantSpec] seedDefaults failed: ' . $e->getMessage());
        }
        return ['seeded' => $seeded, 'updated' => $updated];
    }

    /**
     * Variant specs for $lang, ordered is_primary DESC (primary first) then
     * variant_key. Returns the hardcoded fallback when the table is missing or
     * has no rows for $lang. Identical return shape across sentence + word audio.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public static function variantsForLanguage(string $lang): array
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);
        try {
            $rows = self::query()
                ->where('lang', $normalized)
                ->orderByDesc('is_primary')
                ->orderBy('variant_key')
                ->get(['variant_key', 'accent', 'gender', 'is_primary']);
            if ($rows->isEmpty()) {
                return self::fallbackFor($normalized);
            }
            $out = [];
            foreach ($rows as $row) {
                $accent = $row->accent;
                $out[] = [
                    'key' => (string) $row->variant_key,
                    'accent' => (is_string($accent) && $accent !== '') ? $accent : null,
                    'gender' => (string) ($row->gender ?? 'female'),
                ];
            }
            return $out;
        } catch (\Throwable $e) {
            return self::fallbackFor($normalized);
        }
    }

    /**
     * Hardcoded fallback spec for $lang (mirrors the legacy values).
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public static function fallbackFor(string $lang): array
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);
        if (isset(self::FALLBACK_SPECS[$normalized])) {
            return self::FALLBACK_SPECS[$normalized];
        }
        // Default 3 voices for any unmapped lang (primary + alt female + male).
        // accent is null - non-English engines have no us/uk distinction.
        return [
            ['key' => '', 'accent' => null, 'gender' => 'female'],
            ['key' => 'alt_f', 'accent' => null, 'gender' => 'female'],
            ['key' => 'm', 'accent' => null, 'gender' => 'male'],
        ];
    }

    /**
     * Full spec rows for $lang (lang + variant_key + accent + gender + is_primary)
     * for the variant-specs API. Falls back to fallbackFor() (with lang + a
     * synthesized is_primary on the first row) when the table has no rows.
     *
     * @return array<int,array{lang:string,variant_key:string,accent:?string,gender:string,is_primary:bool}>
     */
    public static function listForLanguage(string $lang): array
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);
        try {
            $rows = self::query()
                ->where('lang', $normalized)
                ->orderByDesc('is_primary')
                ->orderBy('variant_key')
                ->get(['variant_key', 'accent', 'gender', 'is_primary']);
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1TtsVariantSpec] listForLanguage failed: ' . $e->getMessage());
            $rows = collect();
        }
        if ($rows->isEmpty()) {
            $out = [];
            foreach (self::fallbackFor($normalized) as $idx => $spec) {
                $out[] = [
                    'lang' => $normalized,
                    'variant_key' => $spec['key'],
                    'accent' => $spec['accent'] ?? null,
                    'gender' => $spec['gender'],
                    'is_primary' => $idx === 0,
                ];
            }
            return $out;
        }
        $out = [];
        foreach ($rows as $row) {
            $accent = $row->accent;
            $out[] = [
                'lang' => $normalized,
                'variant_key' => (string) $row->variant_key,
                'accent' => (is_string($accent) && $accent !== '') ? $accent : null,
                'gender' => (string) ($row->gender ?? 'female'),
                'is_primary' => (bool) $row->is_primary,
            ];
        }
        return $out;
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
        try {
            self::query()->where('lang', $normalized)->delete();
            foreach ($clean as $row) {
                self::create($row);
            }
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1TtsVariantSpec] replaceForLanguage failed: ' . $e->getMessage());
        }
        return $clean;
    }

    /**
     * Delete one variant spec (lang + variant_key). Returns whether a row was removed.
     */
    public static function deleteVariant(string $lang, string $variantKey): bool
    {
        $normalized = AppQyV1TableMaps::normalizeLangCode($lang);
        try {
            return (bool) self::query()
                ->where('lang', $normalized)
                ->where('variant_key', $variantKey)
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1TtsVariantSpec] deleteVariant failed: ' . $e->getMessage());
            return false;
        }
    }
}
