<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * Short-phrase introduction linked to a study segment (Book Study-Content
 * Generation pipeline §3.2). Batch-linked by segment_id + the denormalized
 * (source_type, source_key, segment_index) composite. Duplicates across segments
 * are allowed by design (no unique key on phrase).
 */
class AppQyV1StudyPhraseModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'study_phrases';

    protected $fillable = [
        'segment_id',
        'source_type',
        'source_key',
        'segment_index',
        'language',
        'phrase',
        'meaning',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'segment_id' => 'integer',
            'segment_index' => 'integer',
            'metadata' => 'array',
        ];
    }

    public static function deleteForSegment(int $segmentId): int
    {
        return self::query()->where('segment_id', $segmentId)->delete();
    }

    public static function contentForSegment(int $segmentId): array
    {
        return self::query()
            ->where('segment_id', $segmentId)
            ->orderBy('id')
            ->get(['language', 'phrase', 'meaning'])
            ->map(static fn ($row): array => [
                'language' => $row->language,
                'phrase' => $row->phrase,
                'meaning' => $row->meaning,
            ])
            ->all();
    }

}
