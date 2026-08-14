<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Models\Model;
use App\Constants\AppKeys;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Collection;

class CodeMartV1AIAnalysisModel extends Model
{
    use RunsModelTransactions;

    protected $connection = AppKeys::CODEMARTV1;
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

    public static function pendingBatch(array $statuses, int $limit): Collection
    {
        return self::query()
            ->with('project')
            ->whereIn('status', $statuses)
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    public static function lockPendingById(int $id, array $statuses): ?self
    {
        return self::query()
            ->whereKey($id)
            ->whereIn('status', $statuses)
            ->lockForUpdate()
            ->first();
    }

    public static function markPendingFailed(int $id, array $statuses): int
    {
        return self::query()
            ->whereKey($id)
            ->whereIn('status', $statuses)
            ->update(['status' => 'failed']);
    }

    public static function createRecord(array $attributes): self
    {
        return static::query()->create($attributes);
    }

    public static function findWithProject(int $analysisId): ?self
    {
        return static::query()->with('project')->find($analysisId);
    }
}
