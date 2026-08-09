<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1BookModel as Book;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SubtitleModel as Subtitle;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1SourceSentenceModel as SourceSentence;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1SentenceAudioFiles;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1PunctuationMarkerModel as PunctuationMarker;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Services\MoviePoster\MoviePosterStore;
use App\Traits\ApiResponse;

/**
 * Public read-only access to synced media sentence content (books and subtitles).
 * No authentication required. Never returns full_content.
 * List endpoints (GET media/books, GET media/subtitles) are served by
 * App\Http\Controllers\MediaBrowseController in routes/api.php.
 *
 * NO try-catch allowed - trust Laravel validation
 * NO ?? or || allowed - use explicit if statements
 */
class AppQyV1MediaContentPublicController
{
    use ApiResponse;

    private const MAX_LIMIT = 200;
    private const DEFAULT_LIMIT = 50;

    /**
     * Normalize start/limit pagination params.
     */
    private function resolvePagination(Request $request): array
    {
        $start = (int) $request->input('start', 0);
        $limit = (int) $request->input('limit', self::DEFAULT_LIMIT);

        if ($start < 0) {
            $start = 0;
        }
        if ($limit < 1) {
            $limit = self::DEFAULT_LIMIT;
        }
        if ($limit > self::MAX_LIMIT) {
            $limit = self::MAX_LIMIT;
        }

        return ['start' => $start, 'limit' => $limit];
    }

    /**
     * GET /app_qy_v1/media/content/{type}/{id}
     * type: book|subtitle, id: numeric row id.
     * Sentences resolved via source_sentences (grain=sentence, fallback grain=cue)
     * joined to the shared sentence library.
     */
    public function getContent(Request $request, string $type, int $id): JsonResponse
    {
        if ($type !== 'book' && $type !== 'subtitle') {
            return $this->error('Invalid type. Must be book or subtitle.', 400);
        }

        $pagination = $this->resolvePagination($request);

        if ($type === 'book') {
            $source = Book::findSource($id);
        } else {
            $source = Subtitle::findSource($id);
        }

        if (!$source) {
            return $this->notFound(ucfirst($type) . ' not found');
        }

        $posterStore = new MoviePosterStore();
        if ($type === 'book') {
            $info = [
                'id' => $source->id,
                'source_key' => $source->source_key,
                'title' => $source->title,
                'language' => $source->language,
                'sentence_count' => $source->sentence_count,
                'has_audio' => !empty($source->audio),
                'synced_at' => $source->synced_at,
                'image_url' => $posterStore->imageUrlFor($source),
                'poster_status' => $source->poster_status,
            ];
        } else {
            $info = [
                'id' => $source->id,
                'source_key' => $source->source_key,
                'title' => $source->title,
                'language' => $source->language,
                'duration_sec' => $source->duration_sec,
                'sentence_count' => $source->sentence_count,
                'segment_count' => $source->segment_count,
                'synced_at' => $source->synced_at,
                'image_url' => $posterStore->imageUrlFor($source),
                'poster_status' => $source->poster_status,
            ];
        }

        // v2 books carry an ordered reconstruction sequence (sentence content-ids
        // interleaved with punctuation-marker codes, repeats allowed). When present
        // we rebuild punctuated text from book.sentence_seq + the marker library,
        // since the shared sentence library stores book sentences WITHOUT punctuation.
        if ($type === 'book') {
            $rawSeq = $source->sentence_seq;
            if (is_array($rawSeq) && count($rawSeq) > 0) {
                return $this->buildBookV2Content($info, $rawSeq, $pagination, (string) $source->language);
            }
        }

        $sourcePage = SourceSentence::sourceGrainPage(
            $type,
            $source->source_key,
            $pagination['start'],
            $pagination['limit']
        );
        $grain = $sourcePage['grain'];
        $totalSentences = $sourcePage['total'];
        $sentences = $sourcePage['rows']
            ->map(function (SourceSentence $link) {
                // Books v3.1: when the slot carries a per-language correspondence
                // map, resolve text/audio from the per-language sentence tables
                // ({prefix}_sentences_{lang}); expose every language. The legacy
                // shared `sentence` relation was removed, so a non-v3 slot falls
                // back to the per-language primary row (or null), never the
                // dropped shared table.
                $v3 = $this->resolveSlotLanguages($link);
                if ($v3 !== null) {
                    return [
                        'seq' => $link->seq,
                        'corr_id' => $link->corr_id,
                        'chapter_index' => $link->chapter_index,
                        'primary_language' => $link->primary_language,
                        'text' => $v3['text'],
                        'audio' => $v3['audio'],
                        'explanation' => $v3['explanation'],
                        'languages' => $v3['languages'],
                        'start_sec' => $link->start_sec,
                        'end_sec' => $link->end_sec,
                    ];
                }

                $text = null;
                $audio = null;
                $explanation = null;
                $sentence = $link->langSentence($link->primary_language ?: 'en');
                if ($sentence) {
                    $text = $sentence->text;
                    $audio = $sentence->audio;
                    $explanation = $sentence->explanation;
                }

                return [
                    'seq' => $link->seq,
                    'text' => $text,
                    'audio' => $audio,
                    'explanation' => $explanation,
                    'start_sec' => $link->start_sec,
                    'end_sec' => $link->end_sec,
                ];
            })
            ->values();

        return $this->success([
            'info' => $info,
            'total_sentences' => $totalSentences,
            'start' => $pagination['start'],
            'limit' => $pagination['limit'],
            'grain' => $grain,
            'sentences' => $sentences,
        ], 'Media content retrieved successfully');
    }

    /**
     * Books v3 per-slot resolution: read each correspondence language from its
     * per-language sentence table ({prefix}_sentences_{lang}) by the content_id
     * stored in the slot's lang_content_ids. Returns null when the slot has no
     * v3 correspondence map (so the caller uses the legacy shared library).
     *
     * The flat `text`/`audio`/`explanation` keys carry the primary language (or
     * the first available) for backwards compatibility; `languages` carries the
     * full per-language map (null where the correspondence is empty).
     *
     * FUTURE: add audio_files per lang entry (AppQyV1SentenceAudioFiles::list($row))
     * so the public read API can expose all clips; FE selects by accent / variant_key.
     * Primary audio/audio path stays for backward compat until clients migrate.
     *
     * @return array{text:?string,audio:?string,explanation:?string,languages:array<string,mixed>}|null
     */
    private function resolveSlotLanguages(SourceSentence $link): ?array
    {
        $map = $link->lang_content_ids;
        if (!is_array($map) || count($map) === 0) {
            return null;
        }

        $languages = [];
        $primaryText = null;
        $primaryAudio = null;
        $primaryExplanation = null;
        $primaryLang = $link->primary_language;

        foreach ($map as $lang => $contentId) {
            if (empty($contentId)) {
                // Empty correspondence: the slot exists but this language is blank.
                $languages[$lang] = [
                    'text' => null,
                    'audio' => null,
                    'explanation' => null,
                    'has_audio' => false,
                ];
                continue;
            }

            $row = LangSentence::findByContentId((string) $lang, (string) $contentId);
            if ($row === null) {
                $languages[$lang] = [
                    'text' => null,
                    'audio' => null,
                    'explanation' => null,
                    'has_audio' => false,
                ];
                continue;
            }

            $entry = [
                'text' => $row->text,
                'audio' => $row->audio,
                'explanation' => $row->explanation,
                'has_audio' => (bool) $row->has_audio,
                'tts_status' => $row->tts_status,
                'audio_files' => AppQyV1SentenceAudioFiles::list($row),
            ];
            $languages[$lang] = $entry;

            $isPrimary = $primaryLang !== null && $primaryLang !== '' && $lang === $primaryLang;
            if ($isPrimary || $primaryText === null) {
                $primaryText = $row->text;
                $primaryAudio = $row->audio;
                $primaryExplanation = $row->explanation;
            }
        }

        return [
            'text' => $primaryText,
            'audio' => $primaryAudio,
            'explanation' => $primaryExplanation,
            'languages' => $languages,
        ];
    }

    /**
     * Normalize a language name/code to the canonical code used by the
     * per-language sentence tables (delegates to AppQyV1TableMaps — §2).
     */
    private function normalizeLangCodeForLookup(string $language): string
    {
        return AppQyV1TableMaps::normalizeLangCode($language);
    }

    /**
     * Reconstruct a v2 book's punctuated content from book.sentence_seq.
     *
     * sentence_seq is an ordered token list: {"s": content_id} (a sentence) and
     * {"m": marker_code} (the punctuation that followed it), repeats allowed. Each
     * sentence token plus its trailing marker tokens forms one display unit. The
     * stored sentence text is punctuation-stripped, so trailing marker glyphs (from
     * the app_qy_v1_punctuation_markers library) are appended to restore sentence
     * boundaries and terminal punctuation. Whitespace-only structure markers
     * (newline/paragraph) are skipped in the per-sentence text. Internal punctuation
     * removed during stripping is NOT restored here (exact bytes live in
     * full_content, which is never exposed). Paginated by sentence unit.
     *
     * Books v3 stores book sentences in the per-language table
     * ({prefix}_sentences_{lang}) keyed by content_id, so we resolve content_ids
     * from the book's primary-language table first and fall back to the
     * deprecated shared library for genuine v2 books.
     */
    private function buildBookV2Content(array $info, array $rawSeq, array $pagination, string $language = ''): JsonResponse
    {
        $units = [];
        $current = null;
        $token = null;
        $ids = [];
        $sentenceMap = [];
        $markerChar = [];
        $sentences = [];

        foreach ($rawSeq as $token) {
            if (is_array($token) && array_key_exists('s', $token)) {
                if ($current !== null) {
                    $units[] = $current;
                }
                $current = ['content_id' => (string) $token['s'], 'markers' => []];
            } elseif (is_array($token) && array_key_exists('m', $token)) {
                if ($current !== null) {
                    $current['markers'][] = (string) $token['m'];
                }
            }
        }
        if ($current !== null) {
            $units[] = $current;
        }

        $totalSentences = count($units);
        $page = array_slice($units, $pagination['start'], $pagination['limit']);

        foreach ($page as $unit) {
            $ids[] = $unit['content_id'];
        }
        $ids = array_values(array_unique($ids));
        if (count($ids) > 0) {
            // Books v3.1: resolve content_ids from the per-language sentence table
            // for the book's primary language ({prefix}_sentences_{lang}). The
            // shared sentence table is removed; there is no fallback.
            $langCode = $this->normalizeLangCodeForLookup($language);
            if ($langCode !== '') {
                if (LangSentence::tableExists($langCode)) {
                    $rows = LangSentence::rowsByContentIds($langCode, $ids);
                    foreach ($rows as $row) {
                        $sentenceMap[$row->content_id] = $row;
                    }
                }
            }
        }

        // marker code -> glyph (whitespace-only structure markers skipped on join)
        $markerChar = PunctuationMarker::cachedGlyphMap();

        $index = 0;
        foreach ($page as $unit) {
            $row = null;
            if (array_key_exists($unit['content_id'], $sentenceMap)) {
                $row = $sentenceMap[$unit['content_id']];
            }
            $text = '';
            $audio = null;
            $explanation = null;
            if ($row !== null) {
                $text = $row->text;
                $audio = $row->audio;
                $explanation = $row->explanation;
            }
            $suffix = '';
            foreach ($unit['markers'] as $code) {
                if (array_key_exists($code, $markerChar)) {
                    $glyph = $markerChar[$code];
                    if (trim($glyph) !== '') {
                        $suffix .= $glyph;
                    }
                }
            }
            $sentences[] = [
                'seq' => $pagination['start'] + $index,
                'text' => $text . $suffix,
                'audio' => $audio,
                'explanation' => $explanation,
                'start_sec' => null,
                'end_sec' => null,
            ];
            $index++;
        }

        return $this->success([
            'info' => $info,
            'total_sentences' => $totalSentences,
            'start' => $pagination['start'],
            'limit' => $pagination['limit'],
            'grain' => 'sentence',
            'sentences' => $sentences,
        ], 'Media content retrieved successfully');
    }
}
