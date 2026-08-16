<?php

namespace App\Services\TimerTasks;

use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1AIAnalysisModel;
use App\Services\UserConfig\UserConfigService;

/**
 * CodeMartV1 AI Analysis Timer Task
 *
 * Actively polls the database every 5 seconds for AI analysis rows awaiting
 * processing ('processing' = new analysis, 'revising' = revision requested) and
 * generates the recommendation/proposal, mirroring AppQyV1CoverGenerationTask.
 *
 * Replaces the previous queued closure in CodeMartV1AIAnalysisCtl
 * (dispatch(...)->afterCommit()). The Octane timer is the single task driver
 * (see development-guides/COMMON_TIMER_DESIGN_SPECIFICATION.md); no Laravel
 * queue / scheduler is involved, so a long analysis can never crash queue:listen.
 */
class CodeMartV1AIAnalysisTask extends OctaneTimerTaskAbstract
{
    private const BATCH_SIZE = 5;
    private const INTERVAL_SECONDS = 5;

    public function getName(): string
    {
        return 'codemartv1_ai_analysis';
    }

    public function getInterval(): int
    {
        return self::INTERVAL_SECONDS;
    }

    public function isEnabled(): bool
    {
        return (bool) app(UserConfigService::class)->get(
            UserConfigService::CODEMARTV1_AI_ANALYSIS_ENABLED,
            true
        );
    }

    public function exec(): void
    {
        try {
            $pending = CodeMartV1AIAnalysisModel::pendingBatch(
                ['processing', 'revising'],
                self::BATCH_SIZE
            );

            if ($pending->isEmpty()) {
                return;
            }

            $this->logInfo("Found {$pending->count()} analyses to process");

            $processed = 0;
            $succeeded = 0;
            $failed = 0;

            foreach ($pending as $analysis) {
                $result = $this->processAnalysis($analysis);
                $processed++;

                if ($result['status'] === 'success') {
                    $succeeded++;
                } else {
                    $failed++;
                }
            }

            if ($processed > 0) {
                $this->logInfo("Batch completed", [
                    'processed' => $processed,
                    'succeeded' => $succeeded,
                    'failed' => $failed,
                ]);
            }
        } catch (\Throwable $e) {
            $this->logError('AI analysis task failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    /**
     * Process a single analysis row with transaction + row lock so concurrent
     * Octane workers cannot double-process it.
     */
    private function processAnalysis(CodeMartV1AIAnalysisModel $analysis): array
    {
        try {
            return CodeMartV1AIAnalysisModel::runInTransaction(function () use ($analysis) {
                $locked = CodeMartV1AIAnalysisModel::lockPendingById(
                    (int) $analysis->id,
                    ['processing', 'revising']
                );

                if (!$locked) {
                    return [
                        'status' => 'skipped',
                        'reason' => 'Already processed by another worker',
                    ];
                }

                $project = $analysis->project;

                if (!$project) {
                    $locked->status = 'failed';
                    $locked->saveRecord();

                    $this->logError("Project not found for analysis", [
                        'analysis_id' => $locked->id,
                        'project_id' => $locked->project_id,
                    ]);

                    return ['status' => 'failed', 'error' => 'Project not found'];
                }

                $keywords = json_decode($locked->keywords ?? '[]', true) ?: [];
                $recommendations = $this->generateRecommendations($keywords, $project);

                $locked->status = 'completed';
                $locked->recommended_languages = json_encode($recommendations['languages']);
                $locked->recommended_frameworks = json_encode($recommendations['frameworks']);
                $locked->recommended_databases = json_encode($recommendations['databases']);
                $locked->team_composition = json_encode($recommendations['team']);
                $locked->estimated_hours = $recommendations['hours'];
                $locked->estimated_cost = $recommendations['cost'];
                $locked->complexity_score = $recommendations['complexity'];
                $locked->proposal = $recommendations['proposal'];
                $locked->completed_at = now();
                $locked->saveRecord();

                $project->analysis_status = 'completed';
                $project->saveRecord();

                $this->logInfo("Analysis completed", [
                    'analysis_id' => $locked->id,
                    'project_id' => $project->id,
                ]);

                return ['status' => 'success'];
            }, 1);
        } catch (\Throwable $e) {
            $this->logError("Analysis processing exception", [
                'analysis_id' => $analysis->id,
                'error' => $e->getMessage(),
            ]);

            // The transaction rolled back, so the row is still 'processing' /
            // 'revising' and would be re-polled every tick forever (poison row).
            // Mark it 'failed' (best effort, outside the failed txn) so a bad
            // row cannot loop indefinitely. 'failed' is a valid enum value and
            // is excluded by the exec() poll filter.
            try {
                CodeMartV1AIAnalysisModel::markPendingFailed(
                    (int) $analysis->id,
                    ['processing', 'revising']
                );
            } catch (\Throwable $inner) {
                $this->logError("Failed to mark analysis as failed", [
                    'analysis_id' => $analysis->id,
                    'error' => $inner->getMessage(),
                ]);
            }

            return ['status' => 'failed', 'error' => $e->getMessage()];
        }
    }

    /**
     * Recommendation engine (moved verbatim from CodeMartV1AIAnalysisCtl so the
     * timer owns the off-queue processing path).
     */
    private function generateRecommendations(array $keywords, $project): array
    {
        $languages = [];
        $frameworks = [];
        $databases = [];

        if (in_array('mobile', $keywords)) {
            $languages = ['Dart', 'Kotlin', 'Swift'];
            $frameworks = ['Flutter', 'React Native'];
        }

        if (in_array('web', $keywords)) {
            $languages = array_merge($languages, ['JavaScript', 'TypeScript']);
            $frameworks = array_merge($frameworks, ['React', 'Vue.js']);
        }

        if (in_array('backend', $keywords)) {
            $languages = array_merge($languages, ['PHP', 'Python', 'Go']);
            $frameworks = array_merge($frameworks, ['Laravel', 'Django', 'Gin']);
            $databases = ['MySQL', 'PostgreSQL'];
        }

        if (in_array('realtime', $keywords)) {
            $databases = array_merge($databases, ['Redis']);
            $frameworks = array_merge($frameworks, ['Socket.io', 'WebSocket']);
        }

        $complexity = count($keywords) + strlen($project->description) / 1000;

        $team = $complexity > 5 ? ['1x Senior', '2x Mid-level'] : ['1x Mid-level', '1x Junior'];

        $hours = round($complexity * 50);
        $cost = $hours * 80;

        return [
            'languages' => array_values(array_unique($languages)),
            'frameworks' => array_values(array_unique($frameworks)),
            'databases' => array_values(array_unique($databases)),
            'team' => $team,
            'hours' => $hours,
            'cost' => $cost,
            'complexity' => round($complexity, 2),
            'proposal' => $this->generateProposalText($keywords, $hours, $cost, $team),
        ];
    }

    private function generateProposalText(array $keywords, int $hours, float $cost, array $team): string
    {
        $keywordStr = implode(', ', $keywords);

        return "Based on analysis, this project involves: {$keywordStr}. " .
               "We recommend a team of " . implode(' + ', $team) . ". " .
               "Estimated completion time: {$hours} hours. " .
               "Estimated cost: \${$cost}.";
    }
}
