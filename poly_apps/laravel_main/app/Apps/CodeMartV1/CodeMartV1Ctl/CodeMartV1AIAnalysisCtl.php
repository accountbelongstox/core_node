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

class CodeMartV1AIAnalysisCtl extends Controller
{
    use ApiResponse;

    public function analyzeProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findOwnedByClient((int) $projectId, (int) $user->id);

        if (!$project) {
            return $this->notFound('Project not found');
        }

        if ($project->analysis_status === 'analyzing') {
            return $this->error('Project is already being analyzed');
        }

        CodeMartV1AIAnalysisModel::beginModelTransaction();

        $project->updateRecord(['analysis_status' => 'analyzing']);

        $analysis = CodeMartV1AIAnalysisModel::createRecord([
            'project_id' => $projectId,
            'status' => 'processing',
            'keywords' => $this->extractKeywords($project->title, $project->description),
        ]);

        CodeMartV1AIAnalysisModel::commitModelTransaction();

        // No queue/dispatch: the row is left in status 'processing' and the
        // Octane timer (CodeMartV1AIAnalysisTask) picks it up within ~5s.
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

        $analysis = CodeMartV1AIAnalysisModel::findWithProject((int) $analysisId);

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

        $analysis = CodeMartV1AIAnalysisModel::findWithProject((int) $analysisId);

        if (!$analysis || $analysis->project->client_id !== $user->id) {
            return $this->notFound('Analysis not found');
        }

        if ($analysis->status !== 'completed') {
            return $this->error('Analysis not completed yet');
        }

        CodeMartV1AIAnalysisModel::beginModelTransaction();

        $analysis->updateRecord(['accepted_at' => now()]);

        $analysis->project->updateRecord([
            'analysis_status' => 'accepted',
            'estimated_cost' => $analysis->estimated_cost,
            'status' => 'awaiting_payment',
        ]);

        CodeMartV1AIAnalysisModel::commitModelTransaction();

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

        $analysis = CodeMartV1AIAnalysisModel::findWithProject((int) $analysisId);

        if (!$analysis || $analysis->project->client_id !== $user->id) {
            return $this->notFound('Analysis not found');
        }

        CodeMartV1AIAnalysisModel::beginModelTransaction();

        $analysis->updateRecord([
            'status' => 'revising',
            'revision_notes' => $request->revision_notes,
        ]);

        $analysis->project->updateRecord(['analysis_status' => 'revising']);

        CodeMartV1AIAnalysisModel::commitModelTransaction();

        // No queue/dispatch: status is 'revising'; the Octane timer
        // (CodeMartV1AIAnalysisTask) re-processes it within ~5s.
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

    // AI analysis processing (recommendation engine + proposal text) lives in
    // app/Services/TimerTasks/CodeMartV1AIAnalysisTask.php. It is driven by the
    // single Octane timer, not the Laravel queue: the controller only sets the
    // row status ('processing' / 'revising') and the timer does the work.
}
