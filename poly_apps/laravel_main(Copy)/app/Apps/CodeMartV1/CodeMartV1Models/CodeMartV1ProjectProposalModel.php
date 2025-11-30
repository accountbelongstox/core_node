<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1ProjectProposalModel extends Model
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

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
