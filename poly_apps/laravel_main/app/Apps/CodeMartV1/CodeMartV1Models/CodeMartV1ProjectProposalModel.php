<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1ProjectProposalModel extends CodeMartV1Model
{
    protected $table = 'codemart_v1_project_proposals';

    protected $fillable = [
        'project_id',
        'status',
        'recommended_tech_stack',
        'suggested_team_composition',
        'estimated_duration',
        'estimated_cost',
        'cost_breakdown',
        'ai_notes',
    ];

    protected $casts = [
        'recommended_tech_stack' => 'json',
        'suggested_team_composition' => 'json',
        'cost_breakdown' => 'json',
        'estimated_cost' => 'decimal:2',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }

    /** One proposal row per project mirrors the latest analysis (funding reads estimated_cost). */
    public static function syncFromAnalysis(CodeMartV1AIAnalysisModel $analysis, string $status): self
    {
        $decode = static fn ($value): array => is_array($decoded = json_decode((string) $value, true)) ? $decoded : [];

        return static::query()->updateOrCreate(
            ['project_id' => $analysis->project_id],
            [
                'status' => $status,
                'recommended_tech_stack' => [
                    'languages' => $decode($analysis->recommended_languages),
                    'frameworks' => $decode($analysis->recommended_frameworks),
                    'databases' => $decode($analysis->recommended_databases),
                ],
                'suggested_team_composition' => $decode($analysis->team_composition),
                'estimated_duration' => $analysis->estimated_hours,
                'estimated_cost' => $analysis->estimated_cost,
                'ai_notes' => $analysis->proposal,
            ]
        );
    }

    public static function forProject(int $projectId): ?self
    {
        return static::query()->where('project_id', $projectId)->first();
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
