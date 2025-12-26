<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodeMartV1AIAnalysisModel extends Model
{
    protected $connection = 'codemartv1';
    protected $table = 'codemart_v1_ai_analyses';

    protected $fillable = [
        'project_id',
        'status',
        'keywords',
        'recommended_languages',
        'recommended_frameworks',
        'recommended_databases',
        'team_composition',
        'estimated_hours',
        'estimated_cost',
        'complexity_score',
        'proposal',
        'revision_notes',
        'completed_at',
        'accepted_at',
    ];

    protected $casts = [
        'estimated_hours' => 'integer',
        'estimated_cost' => 'decimal:2',
        'complexity_score' => 'decimal:2',
        'completed_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(CodeMartV1ProjectModel::class, 'project_id');
    }
}
