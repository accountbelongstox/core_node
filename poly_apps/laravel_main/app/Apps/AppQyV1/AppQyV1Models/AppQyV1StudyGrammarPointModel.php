<?php

namespace App\Apps\AppQyV1\AppQyV1Models;


/**
 * Grammar point linked to a study segment (Book Study-Content Generation
 * pipeline §3.3). Batch-linked by segment_id + the denormalized
 * (source_type, source_key, segment_index) composite. Duplicates across segments
 * are allowed by design (no unique key on point).
 */
class AppQyV1StudyGrammarPointModel extends AppQyV1Model
{

    protected ?string $appTableSuffix = 'study_grammar_points';

    protected $fillable = [
        'segment_id',
        'source_type',
        'source_key',
        'segment_index',
        'language',
        'point',
        'explanation',
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
            ->get(['language', 'point', 'explanation'])
            ->map(static fn ($row): array => [
                'language' => $row->language,
                'point' => $row->point,
                'explanation' => $row->explanation,
            ])
            ->all();
    }

}
