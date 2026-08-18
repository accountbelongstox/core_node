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

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\BindsAppQyV1LanguageTable;
use Illuminate\Support\Collection;

/**
 * Per-language chapter store (Books v3.1 unified model — see
 * BOOKS_FEATURE_SPECIFICATION.md §3.2). Replaces the removed single-table
 * Chapter model.
 *
 * One physical table per supported language: {prefix}_chapters_{lang}. The table
 * is bound dynamically; always obtain an instance via AppQyV1LangChapterModel::for($lang)
 * (or a query via AppQyV1LangChapterModel::onLang($lang)). Cross-language correspondence is
 * by (source_type, source_key, chapter_index); the same chapter_index across the
 * per-language tables is the same chapter.
 */
class AppQyV1LangChapterModel extends AppQyV1Model
{
    use BindsAppQyV1LanguageTable;

    protected $fillable = [
        'source_type',
        'source_key',
        'chapter_index',
        'language',
        'title',
        'corr_id',
        'sentence_count',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'chapter_index' => 'integer',
            'sentence_count' => 'integer',
            'metadata' => 'array',
        ];
    }

    protected static function resolveLanguageTable(string $language): string
    {
        return AppQyV1TableMaps::getChapterTableName(AppQyV1TableMaps::normalizeLangCode($language));
    }

    public static function rowsForSource(string $lang, string $sourceType, string $sourceKey): Collection
    {
        return self::onLang($lang)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->orderBy('chapter_index')
            ->get();
    }

    public static function deleteForSource(string $lang, string $sourceType, string $sourceKey): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->delete();
    }

    public static function deleteForSources(string $lang, string $sourceType, array $sourceKeys): int
    {
        if (!self::tableExists($lang)) {
            return 0;
        }

        return self::onLang($lang)
            ->where('source_type', $sourceType)
            ->whereIn('source_key', array_values(array_unique($sourceKeys)))
            ->delete();
    }

    public static function chapterIndicesForSource(string $lang, string $sourceType, string $sourceKey): Collection
    {
        return self::onLang($lang)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->orderBy('chapter_index')
            ->pluck('chapter_index');
    }

    public static function findForSourceIndex(
        string $lang,
        string $sourceType,
        string $sourceKey,
        int $chapterIndex
    ): ?self {
        return self::onLang($lang)
            ->where('source_type', $sourceType)
            ->where('source_key', $sourceKey)
            ->where('chapter_index', $chapterIndex)
            ->first();
    }
}
