<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1AIAnalysisModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectAttachmentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectProposalModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1EscrowService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1ProjectStateService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use App\Services\TimerTasks\CodeMartV1AIAnalysisTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1AIAnalysisCtl extends Controller
{
    use ApiResponse;

    private const ACTION_REQUESTED = 'requested';
    private const ACTION_REVISION_REQUESTED = 'revision_requested';
    private const ACTION_ACCEPTED = 'accepted';

    private const TECH_KEYWORDS = [
        'mobile' => ['mobile', 'app', 'ios', 'android'],
        'web' => ['web', 'website', 'webapp', 'frontend'],
        'backend' => ['api', 'backend', 'server', 'database'],
        'ai' => ['ai', 'machine learning', 'ml', 'nlp'],
        'ecommerce' => ['shop', 'ecommerce', 'payment', 'cart'],
        'realtime' => ['realtime', 'chat', 'websocket', 'streaming'],
    ];

    private CodeMartV1FileUploadService $fileUploadService;

    public function __construct(CodeMartV1FileUploadService $fileUploadService)
    {
        $this->fileUploadService = $fileUploadService;
    }

    private function analysisNotFound(): JsonResponse
    {
        return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_NOT_FOUND, __('codemart.messages.analysis_not_found'), null, 404);
    }

    /** The analysis timer task is the only processor; while it is disabled no analysis may start. */
    private function analysisUnavailable(): ?JsonResponse
    {
        if (CodeMartV1AIAnalysisTask::enabled()) {
            return null;
        }

        return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_UNAVAILABLE, __('codemart.errors.analysis_unavailable'), null, 503);
    }

    private function failureResponse(array $result): JsonResponse
    {
        return $this->codedError(
            (string) $result['error_code'],
            (string) ($result['message'] ?? __('codemart.errors.request_failed')),
            $result['details'] ?? null,
            (int) ($result['http_status'] ?? 400)
        );
    }

    private function decodeList($value): array
    {
        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function formatAnalysis(CodeMartV1AIAnalysisModel $analysis, bool $isLatest): array
    {
        return [
            'analysis_id' => $analysis->id,
            'project_id' => $analysis->project_id,
            'status' => $analysis->status,
            'revision' => (int) ($analysis->revision ?? 1),
            'is_latest' => $isLatest,
            'keywords' => $this->decodeList($analysis->keywords),
            'recommended_languages' => $this->decodeList($analysis->recommended_languages),
            'recommended_frameworks' => $this->decodeList($analysis->recommended_frameworks),
            'recommended_databases' => $this->decodeList($analysis->recommended_databases),
            'team_composition' => $this->decodeList($analysis->team_composition),
            'estimated_hours' => $analysis->estimated_hours,
            'estimated_cost' => $analysis->estimated_cost,
            'complexity_score' => $analysis->complexity_score,
            'proposal' => $analysis->proposal,
            'revision_notes' => $analysis->revision_notes,
            'completed_at' => $analysis->completed_at,
            'accepted_at' => $analysis->accepted_at,
        ];
    }

    /** Owned analysis plus whether it is the project's latest one. */
    private function ownedAnalysis(int $analysisId, int $userId): ?CodeMartV1AIAnalysisModel
    {
        $analysis = CodeMartV1AIAnalysisModel::findWithProject($analysisId);
        if (!$analysis || !$analysis->project || !$analysis->project->isOwnedBy($userId)) {
            return null;
        }

        return $analysis;
    }

    private function isLatest(CodeMartV1AIAnalysisModel $analysis): bool
    {
        $latest = CodeMartV1AIAnalysisModel::latestForProject((int) $analysis->project_id);

        return $latest !== null && (int) $latest->id === (int) $analysis->id;
    }

    public function analyzeProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findOwnedByClient((int) $projectId, (int) $user->id);
        if (!$project) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_NOT_FOUND, __('codemart.messages.project_not_found'), null, 404);
        }
        if ($project->status !== CodeMartV1Constants::PROJECT_STATUS_DRAFT) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_INVALID_STATE, __('codemart.messages.only_draft_projects_can_be_analyzed'), [
                'status' => $project->status,
            ], 409);
        }

        if ($unavailable = $this->analysisUnavailable()) {
            return $unavailable;
        }

        $latest = CodeMartV1AIAnalysisModel::latestForProject((int) $project->id);
        if ($latest && in_array($latest->status, CodeMartV1Constants::ANALYSIS_ACTIVE_STATUSES, true)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_IN_PROGRESS, __('codemart.messages.project_is_already_being_analyzed'), [
                'analysis_id' => (int) $latest->id,
            ], 409);
        }

        $keywords = $this->extractKeywords($project);
        $analysis = CodeMartV1AIAnalysisModel::runInTransaction(function () use ($project, $keywords, $latest, $user) {
            $project->updateRecord(['analysis_status' => CodeMartV1Constants::PROJECT_ANALYSIS_ANALYZING]);

            $analysis = CodeMartV1AIAnalysisModel::createRecord([
                'project_id' => $project->id,
                'status' => CodeMartV1Constants::AI_ANALYSIS_PROCESSING,
                'keywords' => $keywords,
            ]);
            if ($latest) {
                CodeMartV1AIAnalysisModel::query()->whereKey($analysis->id)->update(['revision' => (int) ($latest->revision ?? 1) + 1]);
            }

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_ANALYSIS,
                (int) $analysis->id,
                self::ACTION_REQUESTED,
                null,
                CodeMartV1Constants::AI_ANALYSIS_PROCESSING,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id]
            );

            return $analysis;
        });

        // No queue/dispatch: the row is left in status 'processing' and the
        // Octane timer (CodeMartV1AIAnalysisTask) picks it up within ~5s.
        return $this->success([
            'analysis_id' => $analysis->id,
            'status' => $analysis->status,
            'message' => __('codemart.messages.analysis_started'),
        ]);
    }

    public function getAnalysisResult(Request $request, $analysisId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $analysis = $this->ownedAnalysis((int) $analysisId, (int) $user->id);
        if (!$analysis) {
            return $this->analysisNotFound();
        }

        return $this->success($this->formatAnalysis($analysis, $this->isLatest($analysis)));
    }

    /** GET /projects/{projectId}/analysis: latest analysis with the proposal row. */
    public function getProjectAnalysis(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_NOT_FOUND, __('codemart.messages.project_not_found'), null, 404);
        }
        if (!$project->isManagedBy((int) $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.you_do_not_have_access_to_this_2'), null, 403);
        }

        $analysis = CodeMartV1AIAnalysisModel::latestForProject((int) $project->id);

        return $this->success([
            'project_id' => (int) $project->id,
            'project_status' => $project->status,
            'analysis_status' => $project->analysis_status,
            'analysis' => $analysis ? $this->formatAnalysis($analysis, true) : null,
            'analysis_available' => CodeMartV1AIAnalysisTask::enabled(),
            'proposal' => CodeMartV1ProjectProposalModel::forProject((int) $project->id),
            'can_accept' => $analysis !== null
                && $analysis->status === CodeMartV1Constants::AI_ANALYSIS_COMPLETED
                && $project->status === CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW
                && $project->isOwnedBy((int) $user->id),
        ]);
    }

    /**
     * Result of an accepted proposal. A replay with the acceptance's
     * Idempotency-Key gets the same body, so the project status is the one
     * the acceptance moved the project into.
     */
    private function acceptedResponse(CodeMartV1AIAnalysisModel $analysis): JsonResponse
    {
        $fundingAmount = CodeMartV1EscrowService::fundingAmount($analysis->project);

        return $this->success([
            'message' => __('codemart.messages.proposal_accepted'),
            'project_id' => $analysis->project_id,
            'project_status' => CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING,
            'funding_amount' => $fundingAmount,
            'payment_amount' => $fundingAmount,
        ]);
    }

    /**
     * Accepts the latest completed proposal and moves the project to
     * funding_pending. A repeat with the Idempotency-Key the acceptance was
     * made with returns the prior result; any other repeat keeps the
     * transition conflict.
     */
    public function acceptProposal(Request $request, $analysisId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $idempotencyKey = CodeMartV1FinanceService::idempotencyKey($request);
        $analysis = $this->ownedAnalysis((int) $analysisId, (int) $user->id);
        if (!$analysis) {
            return $this->analysisNotFound();
        }
        if ($analysis->isAcceptReplay($idempotencyKey)) {
            return $this->acceptedResponse($analysis);
        }
        if ($analysis->status !== CodeMartV1Constants::AI_ANALYSIS_COMPLETED) {
            return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_NOT_COMPLETED, __('codemart.messages.analysis_not_completed_yet'), [
                'status' => $analysis->status,
            ], 409);
        }
        if (!$this->isLatest($analysis)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_NOT_LATEST, __('codemart.messages.only_the_latest_analysis_can_be_accepted'), null, 409);
        }

        $project = $analysis->project;
        $result = CodeMartV1AIAnalysisModel::runInTransaction(function () use ($analysis, $project, $user, $idempotencyKey) {
            $locked = CodeMartV1AIAnalysisModel::lockById((int) $analysis->id);
            if ($locked && $locked->isAcceptReplay($idempotencyKey)) {
                return ['ok' => true];
            }

            $transition = CodeMartV1ProjectStateService::systemTransition(
                $project,
                CodeMartV1Constants::PROJECT_STATUS_FUNDING_PENDING,
                (int) $user->id,
                CodeMartV1ProjectStateService::ACTION_PROPOSAL_ACCEPTED,
                null,
                ['analysis_id' => (int) $analysis->id]
            );
            if (!$transition['ok']) {
                return $transition;
            }

            $analysis->updateRecord(['accepted_at' => now(), 'accept_idempotency_key' => $idempotencyKey]);
            $project->updateRecord(['analysis_status' => CodeMartV1Constants::PROJECT_ANALYSIS_ACCEPTED]);
            CodeMartV1ProjectProposalModel::syncFromAnalysis($analysis, CodeMartV1Constants::PROPOSAL_STATUS_APPROVED);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_ANALYSIS,
                (int) $analysis->id,
                self::ACTION_ACCEPTED,
                CodeMartV1Constants::AI_ANALYSIS_COMPLETED,
                CodeMartV1Constants::AI_ANALYSIS_COMPLETED,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id]
            );

            return ['ok' => true];
        });

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        return $this->acceptedResponse($analysis);
    }

    public function requestRevision(Request $request, $analysisId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'revision_notes' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $analysis = $this->ownedAnalysis((int) $analysisId, (int) $user->id);
        if (!$analysis) {
            return $this->analysisNotFound();
        }
        if ($analysis->status !== CodeMartV1Constants::AI_ANALYSIS_COMPLETED || $analysis->accepted_at !== null) {
            return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_NOT_COMPLETED, __('codemart.messages.only_a_completed_unaccepted_analysis_can_be'), [
                'status' => $analysis->status,
            ], 409);
        }
        if (!$this->isLatest($analysis)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ANALYSIS_NOT_LATEST, __('codemart.messages.only_the_latest_analysis_can_be_revised'), null, 409);
        }
        if ($unavailable = $this->analysisUnavailable()) {
            return $unavailable;
        }

        $project = $analysis->project;
        $notes = (string) $request->input('revision_notes');
        $result = CodeMartV1AIAnalysisModel::runInTransaction(function () use ($analysis, $project, $notes, $user) {
            if ($project->status === CodeMartV1Constants::PROJECT_STATUS_PROPOSAL_REVIEW) {
                $transition = CodeMartV1ProjectStateService::systemTransition(
                    $project,
                    CodeMartV1Constants::PROJECT_STATUS_DRAFT,
                    (int) $user->id,
                    CodeMartV1ProjectStateService::ACTION_REVISION_REQUESTED,
                    $notes,
                    ['analysis_id' => (int) $analysis->id],
                    false
                );
                if (!$transition['ok']) {
                    return $transition;
                }
            } elseif ($project->status !== CodeMartV1Constants::PROJECT_STATUS_DRAFT) {
                return [
                    'ok' => false,
                    'error_code' => CodeMartV1Constants::ERROR_PROJECT_INVALID_STATE,
                    'http_status' => 409,
                    'message' => __('codemart.errors.proposal_not_revisable'),
                    'details' => ['status' => $project->status],
                ];
            }

            $analysis->updateRecord([
                'status' => CodeMartV1Constants::AI_ANALYSIS_REVISING,
                'revision_notes' => $notes,
                'keywords' => $this->extractKeywords($project, $notes),
            ]);
            CodeMartV1AIAnalysisModel::query()->whereKey($analysis->id)->update([
                'revision' => (int) ($analysis->revision ?? 1) + 1,
            ]);
            $project->updateRecord(['analysis_status' => CodeMartV1Constants::PROJECT_ANALYSIS_REVISING]);
            CodeMartV1ProjectProposalModel::query()
                ->where('project_id', $project->id)
                ->update(['status' => CodeMartV1Constants::PROPOSAL_STATUS_REVISED]);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_ANALYSIS,
                (int) $analysis->id,
                self::ACTION_REVISION_REQUESTED,
                CodeMartV1Constants::AI_ANALYSIS_COMPLETED,
                CodeMartV1Constants::AI_ANALYSIS_REVISING,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id]
            );

            return ['ok' => true];
        });

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        // No queue/dispatch: status is 'revising'; the Octane timer
        // (CodeMartV1AIAnalysisTask) re-processes it within ~5s.
        return $this->success(['message' => __('codemart.messages.revision_requested')]);
    }

    /**
     * Keyword categories from the project text, its declared stack, the
     * attachment names, and the first bytes of plain-text attachments.
     */
    private function extractKeywords(CodeMartV1ProjectModel $project, string $extraText = ''): string
    {
        $parts = [(string) $project->title, (string) $project->description, $extraText];
        foreach (['skills', 'languages', 'frameworks', 'databases'] as $field) {
            $values = $project->{$field};
            if (is_array($values)) {
                $parts[] = implode(' ', array_map('strval', $values));
            }
        }

        foreach (CodeMartV1ProjectAttachmentModel::forProject((int) $project->id) as $attachment) {
            $parts[] = (string) $attachment->original_name;
            if (str_starts_with((string) $attachment->mime_type, CodeMartV1Constants::ANALYSIS_KEYWORD_TEXT_MIME_PREFIX)) {
                $parts[] = $this->fileUploadService->readPrivateDeliverySnippet(
                    (string) $attachment->path,
                    CodeMartV1Constants::ANALYSIS_KEYWORD_SNIPPET_BYTES
                );
            }
        }

        $text = strtolower(implode(' ', $parts));
        $keywords = [];
        foreach (self::TECH_KEYWORDS as $category => $terms) {
            foreach ($terms as $term) {
                if (str_contains($text, $term)) {
                    $keywords[] = $category;
                    break;
                }
            }
        }

        return json_encode(array_values(array_unique($keywords)));
    }

    // AI analysis processing (recommendation engine + proposal text) lives in
    // app/Services/TimerTasks/CodeMartV1AIAnalysisTask.php. It is driven by the
    // single Octane timer, not the Laravel queue: the controller only sets the
    // row status ('processing' / 'revising') and the timer does the work.
}
