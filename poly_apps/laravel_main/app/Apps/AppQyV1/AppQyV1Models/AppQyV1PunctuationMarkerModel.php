<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Support\Facades\Cache;

/**
 * Punctuation-marker reference library (Books Sentence/Word Model v2).
 *
 * Mirrors pycore/pyfoundations/punctuation_markers.py (_MARKERS) and is seeded
 * idempotently at sys:init by PunctuationMarkerSeeder (keyed on `code`). The
 * Books pipeline stores sentences WITHOUT punctuation and reconstructs a book's
 * flow as an ordered sequence of sentence content-ids interleaved with these
 * marker codes. ASCII vs full-width glyphs are DISTINCT codes.
 */
class AppQyV1PunctuationMarkerModel extends AppQyV1Model
{
    private const GLYPH_CACHE_KEY = 'appqyv1:punctuation_marker_glyphs';


    protected ?string $appTableSuffix = 'punctuation_markers';

    protected $fillable = [
        'code',
        'char',
        'type',
        'category',
        'terminal',
    ];

    protected function casts(): array
    {
        return [
            'terminal' => 'boolean',
        ];
    }

    public static function cachedGlyphMap(): array
    {
        return Cache::remember(self::GLYPH_CACHE_KEY, 3600, static function (): array {
            return self::query()->pluck('char', 'code')->all();
        });
    }

    public static function synchronizeMarkers(array $markers): array
    {
        $codes = array_column($markers, 'code');
        $existing = self::query()->whereIn('code', $codes)->get()->keyBy('code');
        $writes = [];
        $created = 0;
        $updated = 0;
        $unchanged = 0;
        $now = now();

        foreach ($markers as $marker) {
            $row = $existing->get($marker['code']);
            $changed = $row === null
                || (string) $row->char !== (string) $marker['char']
                || (string) $row->type !== (string) $marker['type']
                || (string) $row->category !== (string) $marker['category']
                || (bool) $row->terminal !== (bool) $marker['terminal'];
            if (!$changed) {
                $unchanged++;
                continue;
            }

            $row === null ? $created++ : $updated++;
            $writes[] = array_merge($marker, [
                'created_at' => $row?->created_at ?? $now,
                'updated_at' => $now,
            ]);
        }

        if ($writes !== []) {
            self::query()->upsert(
                $writes,
                ['code'],
                ['char', 'type', 'category', 'terminal', 'updated_at']
            );
        }

        return compact('created', 'updated', 'unchanged');
    }

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::GLYPH_CACHE_KEY));
        static::deleted(fn () => Cache::forget(self::GLYPH_CACHE_KEY));
    }
}
