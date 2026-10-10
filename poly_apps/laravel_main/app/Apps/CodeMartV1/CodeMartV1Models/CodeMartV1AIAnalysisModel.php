<?php
namespace App\Apps\CodeMartV1\CodeMartV1Models;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Collection;

class CodeMartV1AIAnalysisModel extends CodeMartV1Model
{
    use RunsModelTransactions;

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
        'accept_idempotency_key',
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

    /** Readable proposal summary shared by the analysis task and the demo seeder. */
    public static function proposalText(array $keywords, array $team, int $hours, mixed $cost, ?string $currency = null): string
    {
        $areas = array_map(static fn (string $keyword): string => __('codemart.proposal.areas.' . $keyword), $keywords);

        return __('codemart.proposal.summary', [
            'areas' => $areas === [] ? __('codemart.proposal.areas.general') : implode(__('codemart.proposal.list_separator'), $areas),
            'team' => implode(__('codemart.proposal.list_separator'), array_map([self::class, 'teamMemberLabel'], $team)),
            'hours' => $hours,
            'cost' => number_format((float) $cost, 2, '.', ','),
            'currency' => $currency ?: \App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService::aiEstimateCurrency(),
        ]);
    }

    /** "2x Mid-level" -> localized "2 mid-level developers"; unknown entries pass through. */
    private static function teamMemberLabel(string $member): string
    {
        if (!preg_match('/^(\d+)x\s+(.+)$/', trim($member), $match)) {
            return $member;
        }
        $levelKey = 'codemart.proposal.levels.' . strtolower(str_replace([' ', '-'], '_', $match[2]));
        $level = __($levelKey);

        return trans_choice('codemart.proposal.team_member', (int) $match[1], [
            'count' => (int) $match[1],
            'level' => $level === $levelKey ? $match[2] : $level,
        ]);
    }

    public static function latestForProject(int $projectId): ?self
    {
        return static::query()->where('project_id', $projectId)->orderByDesc('id')->first();
    }

    public static function markProjectAnalysisFailed(int $analysisId, string $analysisStatus): void
    {
        $analysis = static::query()->with('project')->find($analysisId);
        if ($analysis && $analysis->project) {
            $analysis->project->updateRecord(['analysis_status' => $analysisStatus]);
        }
    }

    public static function findWithProject(int $analysisId): ?self
    {
        return static::query()->with('project')->find($analysisId);
    }

    public static function lockById(int $analysisId): ?self
    {
        return static::query()->whereKey($analysisId)->lockForUpdate()->first();
    }

    /** True when this analysis was already accepted with the same Idempotency-Key. */
    public function isAcceptReplay(?string $idempotencyKey): bool
    {
        return $idempotencyKey !== null
            && $this->accepted_at !== null
            && hash_equals((string) $this->accept_idempotency_key, $idempotencyKey);
    }
}
