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

        if ($type === 'book') {
            $info = [
                'id' => $source->id,
                'source_key' => $source->source_key,
                'title' => $source->title,
                'language' => $source->language,
                'sentence_count' => $source->sentence_count,
                'has_audio' => !empty($source->audio),
                'synced_at' => $source->synced_at,
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
            ];
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
}
