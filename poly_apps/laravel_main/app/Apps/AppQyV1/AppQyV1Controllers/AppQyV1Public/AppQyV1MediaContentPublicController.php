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
use App\Models\Book;
use App\Models\Subtitle;
use App\Models\SourceSentence;
use App\Models\Sentence;
use App\Models\PunctuationMarker;
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
            $source = Book::find($id);
        } else {
            $source = Subtitle::find($id);
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
                return $this->buildBookV2Content($info, $rawSeq, $pagination);
            }
        }

        $baseQuery = SourceSentence::where('source_type', $type)
            ->where('source_key', $source->source_key);

        $grain = 'sentence';
        $totalSentences = (clone $baseQuery)->where('grain', 'sentence')->count();
        if ($totalSentences === 0) {
            $grain = 'cue';
            $totalSentences = (clone $baseQuery)->where('grain', 'cue')->count();
        }

        $sentences = (clone $baseQuery)->where('grain', $grain)
            ->orderBy('seq')
            ->skip($pagination['start'])
            ->take($pagination['limit'])
            ->with('sentence')
            ->get()
            ->map(function (SourceSentence $link) {
                $text = null;
                $audio = null;
                $explanation = null;
                if ($link->sentence) {
                    $text = $link->sentence->text;
                    $audio = $link->sentence->audio;
                    $explanation = $link->sentence->explanation;
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
     */
    private function buildBookV2Content(array $info, array $rawSeq, array $pagination): JsonResponse
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
            $rows = Sentence::whereIn('content_id', $ids)->get();
            foreach ($rows as $row) {
                $sentenceMap[$row->content_id] = $row;
            }
        }

        // marker code -> glyph (whitespace-only structure markers skipped on join)
        $markers = PunctuationMarker::all();
        foreach ($markers as $marker) {
            $markerChar[$marker->code] = $marker->char;
        }

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
