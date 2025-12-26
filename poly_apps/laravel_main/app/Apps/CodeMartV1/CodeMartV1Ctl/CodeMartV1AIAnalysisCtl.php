<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1AIAnalysisModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class CodeMartV1AIAnalysisCtl extends Controller
{
    use ApiResponse;

    public function analyzeProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::where('id', $projectId)
            ->where('client_id', $user->id)
            ->first();

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->analysis_status === 'analyzing') {
            return $this->error('Project is already being analyzed');
        }

        DB::beginTransaction();

        $project->update(['analysis_status' => 'analyzing']);

        $analysis = CodeMartV1AIAnalysisModel::create([
            'project_id' => $projectId,
            'status' => 'processing',
            'keywords' => $this->extractKeywords($project->title, $project->description),
        ]);

        DB::commit();

        $this->performAIAnalysis($analysis->id, $project);

        return $this->success([
            'analysis_id' => $analysis->id,
            'status' => $analysis->status,
            'message' => 'AI analysis started. You will be notified when complete.',
        ]);
    }

    public function getAnalysisResult(Request $request, $analysisId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $analysis = CodeMartV1AIAnalysisModel::with('project')->find($analysisId);

        if (!$analysis || $analysis->project->client_id !== $user->id) {
            return $this->notFound('Analysis not found');
        }

        return $this->success([
            'analysis_id' => $analysis->id,
            'project_id' => $analysis->project_id,
            'status' => $analysis->status,
            'keywords' => json_decode($analysis->keywords, true),
            'recommended_languages' => json_decode($analysis->recommended_languages, true),
            'recommended_frameworks' => json_decode($analysis->recommended_frameworks, true),
            'recommended_databases' => json_decode($analysis->recommended_databases, true),
            'team_composition' => json_decode($analysis->team_composition, true),
            'estimated_hours' => $analysis->estimated_hours,
            'estimated_cost' => $analysis->estimated_cost,
            'complexity_score' => $analysis->complexity_score,
            'proposal' => $analysis->proposal,
            'completed_at' => $analysis->completed_at,
        ]);
    }

    public function acceptProposal(Request $request, $analysisId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $analysis = CodeMartV1AIAnalysisModel::with('project')->find($analysisId);

        if (!$analysis || $analysis->project->client_id !== $user->id) {
            return $this->notFound('Analysis not found');
        }

        if ($analysis->status !== 'completed') {
            return $this->error('Analysis not completed yet');
        }

        DB::beginTransaction();

        $analysis->update(['accepted_at' => now()]);

        $analysis->project->update([
            'analysis_status' => 'accepted',
            'estimated_cost' => $analysis->estimated_cost,
            'status' => 'awaiting_payment',
        ]);

        DB::commit();

        return $this->success([
            'message' => 'Proposal accepted. Please proceed to payment.',
            'project_id' => $analysis->project_id,
            'payment_amount' => $analysis->estimated_cost * 0.3,
        ]);
    }

    public function requestRevision(Request $request, $analysisId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'revision_notes' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', 422, $validator->errors());
        }

        $analysis = CodeMartV1AIAnalysisModel::with('project')->find($analysisId);

        if (!$analysis || $analysis->project->client_id !== $user->id) {
            return $this->notFound('Analysis not found');
        }

        DB::beginTransaction();

        $analysis->update([
            'status' => 'revising',
            'revision_notes' => $request->revision_notes,
        ]);

        $analysis->project->update(['analysis_status' => 'revising']);

        DB::commit();

        $this->performAIAnalysis($analysis->id, $analysis->project, $request->revision_notes);

        return $this->success(['message' => 'Revision requested. AI will re-analyze with your feedback.']);
    }

    private function extractKeywords(string $title, string $description): string
    {
        $text = strtolower($title . ' ' . $description);
        $keywords = [];

        $techKeywords = [
            'mobile' => ['mobile', 'app', 'ios', 'android'],
            'web' => ['web', 'website', 'webapp', 'frontend'],
            'backend' => ['api', 'backend', 'server', 'database'],
            'ai' => ['ai', 'machine learning', 'ml', 'nlp'],
            'ecommerce' => ['shop', 'ecommerce', 'payment', 'cart'],
            'realtime' => ['realtime', 'chat', 'websocket', 'streaming'],
        ];

        foreach ($techKeywords as $category => $terms) {
            foreach ($terms as $term) {
                if (str_contains($text, $term)) {
                    $keywords[] = $category;
                    break;
                }
            }
        }

        return json_encode(array_unique($keywords));
    }

    private function performAIAnalysis(int $analysisId, $project, ?string $revisionNotes = null): void
    {
        dispatch(function () use ($analysisId, $project, $revisionNotes) {
            sleep(2);

            $keywords = json_decode(
                CodeMartV1AIAnalysisModel::find($analysisId)->keywords ?? '[]',
                true
            );

            $recommendations = $this->generateRecommendations($keywords, $project);

            CodeMartV1AIAnalysisModel::where('id', $analysisId)->update([
                'status' => 'completed',
                'recommended_languages' => json_encode($recommendations['languages']),
                'recommended_frameworks' => json_encode($recommendations['frameworks']),
                'recommended_databases' => json_encode($recommendations['databases']),
                'team_composition' => json_encode($recommendations['team']),
                'estimated_hours' => $recommendations['hours'],
                'estimated_cost' => $recommendations['cost'],
                'complexity_score' => $recommendations['complexity'],
                'proposal' => $recommendations['proposal'],
                'completed_at' => now(),
            ]);

            CodeMartV1ProjectModel::where('id', $project->id)->update([
                'analysis_status' => 'completed',
            ]);
        })->afterCommit();
    }

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
