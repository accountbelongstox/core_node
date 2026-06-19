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

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;

/**
 * Persistent positional + cross-language CORRESPONDENCE index for every source
 * (book|subtitle|document|article). Does NOT store sentence text — text lives
 * only in sentences_{lang}. One row per (source, grain, seq) slot:
 *   - chapter_index   — order (which chapter this slot belongs to)
 *   - corr_id         — cross-language correspondence group id
 *   - primary_language — the source's primary language code
 *   - lang_content_ids {code: content_id|null} — the per-language library refs
 *                       into sentences_{lang} (null = 留空, empty correspondence)
 *   - timing (seg_index / sub_idx / start_sec / end_sec) — for subtitles
 * Both grains are kept: 'cue' (1 source line/cue) and 'sentence' (merged).
 * Unique on (source_type, source_key, grain, seq).
 *
 * This is what powers per-sentence multi-language reading, per-sentence audio
 * status, wordflow joins, and reverse lookup — NOT recoverable cheaply from the
 * source's raw original (especially multi-track subtitle time alignment), so the
 * table is kept. The legacy `sentence_id` column was REMOVED (Books v3.1 §3.3):
 * the per-language link is carried entirely by lang_content_ids (content_id refs).
 */
class SourceSentence extends Model
{
    protected $appKey = AppKeys::APPQYV1;
    protected $table;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'source_sentences');
    }

    protected $fillable = [
        'source_type',
        'source_key',
        'grain',
        'seq',
        'seg_index',
        'sub_idx',
        'start_sec',
        'end_sec',
        'metadata',
        // Books v3 correspondence anchor (spec §3.3).
        'chapter_index',
        'corr_id',
        'primary_language',
        'lang_content_ids',
    ];

    protected $casts = [
        'seq' => 'integer',
        'seg_index' => 'integer',
        'sub_idx' => 'integer',
        'start_sec' => 'float',
        'end_sec' => 'float',
        'metadata' => 'array',
        'chapter_index' => 'integer',
        'lang_content_ids' => 'array',
    ];

    /**
     * Resolve the per-language sentence row for this slot from the per-language
     * sentence table ({prefix}_sentences_{lang}) via lang_content_ids[$lang].
     * Returns null when this slot has no correspondence for $lang.
     */
    public function langSentence(string $lang): ?LangSentence
    {
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        $map = $this->lang_content_ids;
        if (!is_array($map) || empty($map[$lang])) {
            return null;
        }
        $contentId = (string) $map[$lang];
        return LangSentence::onLang($lang)->where('content_id', $contentId)->first();
    }

    /**
     * Resolve the per-language chapter row for this slot from the per-language
     * chapter table ({prefix}_chapters_{lang}) by (source_type, source_key,
     * chapter_index). Returns null when that language has no chapter row (留空).
     */
    public function langChapter(string $lang): ?LangChapter
    {
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        return LangChapter::onLang($lang)
            ->where('source_type', $this->source_type)
            ->where('source_key', $this->source_key)
            ->where('chapter_index', (int) $this->chapter_index)
            ->first();
    }
}
