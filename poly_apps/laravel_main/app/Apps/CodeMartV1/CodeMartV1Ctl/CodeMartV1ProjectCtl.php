<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1AIAnalysisModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectAttachmentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1ProjectStateService;
use App\Apps\CodeMartV1\CodeMartV1TablesMaps\CodeMartV1TablesMaps;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1ProjectCtl extends Controller
{
    use ApiResponse;

    private const ACTION_CREATED = 'created';
    private const ACTION_UPDATED = 'updated';
    private const ACTION_PUBLISHED = 'published';
    private const ACTION_MILESTONE_CREATED = 'created';
    private const ACTION_MILESTONE_UPDATED = 'updated';
    private const ACTION_MILESTONE_COMPLETED = 'completed';
    private const ACTION_ATTACHMENT_UPLOADED = 'uploaded';
    private const SCOPE_FIELDS = ['complexity', 'budget', 'skills', 'languages', 'frameworks', 'databases', 'start_date', 'end_date'];

    private CodeMartV1FileUploadService $fileUploadService;

    public function __construct(CodeMartV1FileUploadService $fileUploadService)
    {
        $this->fileUploadService = $fileUploadService;
    }

    private function pageParams(Request $request): array
    {
        $page = max(1, (int) $request->get('page', 1));
        $pageSize = (int) $request->get('pageSize', CodeMartV1Constants::DEFAULT_PAGE_SIZE);
        $pageSize = max(1, min(CodeMartV1Constants::MAX_PAGE_SIZE, $pageSize));

        return [$page, $pageSize];
    }

    private function failureResponse(array $result): JsonResponse
    {
        return $this->codedError(
            (string) $result['error_code'],
            (string) ($result['message'] ?? 'Request failed'),
            $result['details'] ?? null,
            (int) ($result['http_status'] ?? 400)
        );
    }

    private function projectNotFound(): JsonResponse
    {
        return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_NOT_FOUND, 'Project not found', null, 404);
    }

    private function accessDenied(string $message): JsonResponse
    {
        return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, $message, null, 403);
    }

    private function analysisSummary(?CodeMartV1AIAnalysisModel $analysis): ?array
    {
        if (!$analysis) {
            return null;
        }

        return [
            'id' => (int) $analysis->id,
            'status' => $analysis->status,
            'revision' => (int) ($analysis->revision ?? 1),
            'estimated_hours' => $analysis->estimated_hours,
            'estimated_cost' => $analysis->estimated_cost,
            'complexity_score' => $analysis->complexity_score,
            'completed_at' => $analysis->completed_at,
            'accepted_at' => $analysis->accepted_at,
        ];
    }

    private function milestoneParties(CodeMartV1MilestoneModel $milestone, CodeMartV1ProjectModel $project): array
    {
        $assignees = CodeMartV1TaskModel::query()
            ->where('milestone_id', $milestone->id)
            ->whereNotNull('assigned_to')
            ->pluck('assigned_to')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        return array_merge($project->managerIds(), $assignees);
    }

    public function getProjects(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = $this->pageParams($request);
        $userId = (int) $user->id;
        $includeAssigned = filter_var($request->get('include_assigned', false), FILTER_VALIDATE_BOOLEAN);

        $query = CodeMartV1ProjectModel::query()
            ->where(function ($scope) use ($userId, $includeAssigned): void {
                $scope->where('client_id', $userId)
                    ->orWhere('architect_id', $userId);
                if ($includeAssigned) {
                    $scope->orWhereIn('id', function ($subQuery) use ($userId): void {
                        $subQuery->select('m.project_id')
                            ->from(CodeMartV1TablesMaps::CODEMART_MILESTONES_TABLE . ' as m')
                            ->join(CodeMartV1TablesMaps::CODEMART_TASKS_TABLE . ' as t', 't.milestone_id', '=', 'm.id')
                            ->where('t.assigned_to', $userId);
                    });
                }
            });

        foreach (['status', 'complexity'] as $field) {
            $value = $request->get($field);
            if ($value !== null && $value !== '') {
                $query->where($field, $value);
            }
        }
        $search = trim((string) $request->get('search', ''));
        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $builder->where('title', 'like', '%' . $search . '%')
                    ->orWhere('description', 'like', '%' . $search . '%');
            });
        }

        $total = (clone $query)->count();
        $projects = $query->orderByDesc('created_at')->forPage($page, $pageSize)->get();

        return $this->success([
            'projects' => $projects,
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => (int) ceil($total / $pageSize),
            ],
        ]);
    }

    public function createProject(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'complexity' => 'required|in:simple,medium,complex,very_complex',
            'budget' => 'required|numeric|min:100',
            'budget_type' => 'required|in:fixed,hourly',
            'currency' => 'required|string|size:3',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
            'skills' => 'nullable|array',
            'languages' => 'nullable|array',
            'frameworks' => 'nullable|array',
            'databases' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $project = CodeMartV1ProjectModel::runInTransaction(function () use ($request, $user) {
            $project = CodeMartV1ProjectModel::createRecord([
                'client_id' => $user->id,
                'title' => $request->title,
                'description' => $request->description,
                'complexity' => $request->complexity,
                'budget' => $request->budget,
                'budget_type' => $request->budget_type,
                'currency' => $request->currency,
                'start_date' => $request->start_date,
                'end_date' => $request->end_date,
                'skills' => $request->skills ?? [],
                'languages' => $request->languages ?? [],
                'frameworks' => $request->frameworks ?? [],
                'databases' => $request->databases ?? [],
                'status' => CodeMartV1Constants::PROJECT_STATUS_DRAFT,
            ]);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_PROJECT,
                (int) $project->id,
                self::ACTION_CREATED,
                null,
                CodeMartV1Constants::PROJECT_STATUS_DRAFT
            );

            return $project;
        });

        return $this->success($project, 'Project created successfully', 201);
    }

    public function getProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findDetailed((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }

        $accessRole = $project->accessRoleFor((int) $user->id);
        if ($accessRole === null) {
            return $this->accessDenied('You do not have access to this project');
        }

        $isOwner = $accessRole === CodeMartV1Constants::TRANSITION_ACTOR_OWNER;
        $data = $project->toArray();
        $data['latest_analysis'] = $this->analysisSummary(CodeMartV1AIAnalysisModel::latestForProject((int) $project->id));
        $data['access'] = [
            'role' => $accessRole,
            'read_only' => $accessRole === CodeMartV1Constants::TRANSITION_ACTOR_ASSIGNEE,
            'can_manage' => $project->isManagedBy((int) $user->id),
            'allowed_transitions' => $isOwner
                ? CodeMartV1ProjectStateService::allowedTargets((string) $project->status, CodeMartV1Constants::TRANSITION_ACTOR_OWNER)
                : [],
        ];

        return $this->success($data);
    }

    public function updateProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }
        if (!$project->isOwnedBy((int) $user->id)) {
            return $this->accessDenied('Only the project owner can update this project');
        }
        if (in_array($project->status, CodeMartV1Constants::PROJECT_CLOSED_STATUSES, true)) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_INVALID_STATE, 'Closed projects cannot be edited', [
                'status' => $project->status,
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'complexity' => 'sometimes|in:simple,medium,complex,very_complex',
            'budget' => 'sometimes|numeric|min:100',
            'start_date' => 'sometimes|nullable|date',
            'end_date' => 'sometimes|nullable|date',
            'skills' => 'sometimes|nullable|array',
            'languages' => 'sometimes|nullable|array',
            'frameworks' => 'sometimes|nullable|array',
            'databases' => 'sometimes|nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $attributes = $validator->validated();
        $scopeChanges = array_values(array_intersect(array_keys($attributes), self::SCOPE_FIELDS));
        if ($scopeChanges !== [] && !in_array($project->status, CodeMartV1Constants::PROJECT_SCOPE_EDITABLE_STATUSES, true)) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_SCOPE_LOCKED, 'Scope fields are locked after the proposal is accepted', [
                'status' => $project->status,
                'fields' => $scopeChanges,
            ], 409);
        }

        CodeMartV1ProjectModel::runInTransaction(function () use ($project, $attributes, $user) {
            $project->updateRecord($attributes);
            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_PROJECT,
                (int) $project->id,
                self::ACTION_UPDATED,
                null,
                null,
                [],
                null,
                null,
                null,
                ['fields' => array_keys($attributes)]
            );
        });

        return $this->success($project, 'Project updated successfully');
    }

    public function transitionProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'to_status' => 'required|string|in:' . implode(',', CodeMartV1Constants::getAllProjectStatuses()),
            'reason' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }

        $result = CodeMartV1ProjectStateService::transition(
            $project,
            (string) $request->input('to_status'),
            (int) $user->id,
            $request->input('reason')
        );

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        return $this->success([
            'project' => $result['project'],
            'from' => $result['from'],
            'to' => $result['to'],
            'side_effects' => $result['side_effects'] ?? [],
        ], 'Project status updated');
    }

    /**
     * Publishing is the funding step (POST /projects/{id}/fund moves
     * funding_pending -> open); this endpoint only stamps published_at on an
     * already funded project and reports funding_required otherwise.
     */
    public function publishProject(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }
        if (!$project->isOwnedBy((int) $user->id)) {
            return $this->accessDenied('Only the project owner can publish this project');
        }
        if (!$project->acceptsWork()) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_FUNDING_REQUIRED, 'The project must be funded before it is published', [
                'status' => $project->status,
            ], 409);
        }

        if ($project->published_at === null) {
            CodeMartV1ProjectModel::runInTransaction(function () use ($project, $user) {
                $project->updateRecord(['published_at' => now()]);
                CodeMartV1ProjectStateService::openPendingTasks($project, (int) $user->id);
                CodeMartV1DomainEventService::emit(
                    (int) $user->id,
                    CodeMartV1Constants::RESOURCE_PROJECT,
                    (int) $project->id,
                    self::ACTION_PUBLISHED,
                    null,
                    (string) $project->status
                );
            });
        }

        return $this->success($project, 'Project published successfully');
    }

    public function createMilestone(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }
        if (!$project->isManagedBy((int) $user->id)) {
            return $this->accessDenied('You do not have permission to create milestones for this project');
        }
        if (in_array($project->status, CodeMartV1Constants::PROJECT_CLOSED_STATUSES, true)) {
            return $this->codedError(CodeMartV1Constants::ERROR_PROJECT_INVALID_STATE, 'Closed projects cannot receive milestones', [
                'status' => $project->status,
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'due_date' => 'required|date|after:today',
            'budget' => 'required_without:amount|numeric|min:0',
            'amount' => 'required_without:budget|numeric|min:0',
            'deliverables' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $milestone = CodeMartV1ProjectModel::runInTransaction(function () use ($request, $project, $user) {
            $milestone = CodeMartV1MilestoneModel::createRecord([
                'project_id' => $project->id,
                'title' => $request->title,
                'description' => $request->description,
                'due_date' => $request->due_date,
                'budget' => $request->input('budget', $request->input('amount')),
                'deliverables' => array_values((array) $request->input('deliverables', [])),
                'status' => CodeMartV1Constants::MILESTONE_STATUS_PENDING,
                'order' => CodeMartV1MilestoneModel::nextOrderForProject((int) $project->id),
            ]);

            $project->updateRecord([
                'total_milestones' => CodeMartV1MilestoneModel::query()->where('project_id', $project->id)->count(),
            ]);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_MILESTONE,
                (int) $milestone->id,
                self::ACTION_MILESTONE_CREATED,
                null,
                CodeMartV1Constants::MILESTONE_STATUS_PENDING,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id]
            );

            return $milestone;
        });

        return $this->success($milestone, 'Milestone created successfully', 201);
    }

    public function updateMilestone(Request $request, $milestoneId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $milestone = CodeMartV1MilestoneModel::findWithProject((int) $milestoneId);
        if (!$milestone || !$milestone->project) {
            return $this->codedError(CodeMartV1Constants::ERROR_MILESTONE_NOT_FOUND, 'Milestone not found', null, 404);
        }
        $project = $milestone->project;
        if (!$project->isManagedBy((int) $user->id)) {
            return $this->accessDenied('Only the project owner or architect can update milestones');
        }
        if ($milestone->isClosed()) {
            return $this->codedError(CodeMartV1Constants::ERROR_MILESTONE_CLOSED, 'The milestone is closed', [
                'status' => $milestone->status,
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|nullable|string',
            'due_date' => 'sometimes|date',
            'budget' => 'sometimes|numeric|min:0',
            'amount' => 'sometimes|numeric|min:0',
            'deliverables' => 'sometimes|nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $attributes = $validator->validated();
        if (array_key_exists('amount', $attributes)) {
            $attributes['budget'] = $attributes['budget'] ?? $attributes['amount'];
            unset($attributes['amount']);
        }
        if (array_key_exists('deliverables', $attributes)) {
            $attributes['deliverables'] = array_values((array) ($attributes['deliverables'] ?? []));
        }

        CodeMartV1ProjectModel::runInTransaction(function () use ($milestone, $attributes, $user, $project) {
            $milestone->updateRecord($attributes);
            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_MILESTONE,
                (int) $milestone->id,
                self::ACTION_MILESTONE_UPDATED,
                null,
                null,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id, 'fields' => array_keys($attributes)]
            );
        });

        return $this->success($milestone->refresh(), 'Milestone updated successfully');
    }

    public function completeMilestone(Request $request, $milestoneId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $milestone = CodeMartV1MilestoneModel::findWithProject((int) $milestoneId);
        if (!$milestone || !$milestone->project) {
            return $this->codedError(CodeMartV1Constants::ERROR_MILESTONE_NOT_FOUND, 'Milestone not found', null, 404);
        }
        $project = $milestone->project;
        if (!$project->isManagedBy((int) $user->id)) {
            return $this->accessDenied('Only the project owner or architect can complete milestones');
        }

        $result = CodeMartV1ProjectModel::runInTransaction(function () use ($milestone, $project, $user) {
            $locked = CodeMartV1MilestoneModel::lockById((int) $milestone->id);
            if (!$locked || $locked->isClosed()) {
                return ['ok' => false, 'error_code' => CodeMartV1Constants::ERROR_MILESTONE_CLOSED, 'http_status' => 409,
                    'message' => 'The milestone is closed', 'details' => ['status' => $locked?->status]];
            }
            $unfinished = CodeMartV1TaskModel::unfinishedCountForMilestone((int) $locked->id);
            if ($unfinished > 0) {
                return ['ok' => false, 'error_code' => CodeMartV1Constants::ERROR_MILESTONE_TASKS_UNFINISHED, 'http_status' => 409,
                    'message' => 'All milestone tasks must be completed or cancelled first', 'details' => ['unfinished_tasks' => $unfinished]];
            }

            $fromStatus = (string) $locked->status;
            $locked->updateRecord([
                'status' => CodeMartV1Constants::MILESTONE_STATUS_COMPLETED,
                'completed_at' => now(),
            ]);
            $project->updateRecord([
                'completed_milestones' => CodeMartV1MilestoneModel::query()
                    ->where('project_id', $project->id)
                    ->where('status', CodeMartV1Constants::MILESTONE_STATUS_COMPLETED)
                    ->count(),
            ]);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_MILESTONE,
                (int) $locked->id,
                self::ACTION_MILESTONE_COMPLETED,
                $fromStatus,
                CodeMartV1Constants::MILESTONE_STATUS_COMPLETED,
                $this->milestoneParties($locked, $project),
                CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
                CodeMartV1Constants::NOTIFY_MILESTONE_COMPLETED,
                CodeMartV1Constants::NOTIFY_MILESTONE_COMPLETED_BODY,
                [
                    'project_id' => (int) $project->id,
                    'project_title' => (string) $project->title,
                    'milestone_title' => (string) $locked->title,
                ]
            );

            return ['ok' => true, 'milestone' => $locked];
        });

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        return $this->success($result['milestone'], 'Milestone completed');
    }

    public function getProjectAttachments(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }
        if ($project->accessRoleFor((int) $user->id) === null) {
            return $this->accessDenied('You do not have access to this project');
        }

        [$page, $pageSize] = $this->pageParams($request);
        $result = CodeMartV1ProjectAttachmentModel::pageForProject((int) $project->id, $page, $pageSize);
        $total = (int) $result['total'];

        return $this->success([
            'items' => $result['attachments']->items(),
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'totalPages' => (int) ceil($total / $pageSize),
        ]);
    }

    public function uploadProjectAttachment(Request $request, $projectId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }
        if (!$project->isManagedBy((int) $user->id)) {
            return $this->accessDenied('Only the project owner or architect can upload attachments');
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:' . CodeMartV1Constants::MAX_ATTACHMENT_SIZE,
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, 'Validation failed', $validator->errors(), 422);
        }

        $stored = $this->fileUploadService->storePrivateDeliveryFile(
            $request->file('file'),
            CodeMartV1Constants::PROJECT_ATTACHMENT_DIR . '/' . $project->id
        );
        if ($stored === null) {
            return $this->codedError(CodeMartV1Constants::ERROR_FILE_STORE_FAILED, 'The file could not be stored', null, 422);
        }

        $attachment = CodeMartV1ProjectModel::runInTransaction(function () use ($stored, $project, $user) {
            $attachment = CodeMartV1ProjectAttachmentModel::createRecord([
                'project_id' => $project->id,
                'file_name' => $stored['file_name'],
                'original_name' => $stored['original_name'],
                'mime_type' => $stored['mime_type'],
                'size' => $stored['size'],
                'path' => $stored['path'],
                'uploaded_by' => $user->id,
            ]);

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_ATTACHMENT,
                (int) $attachment->id,
                self::ACTION_ATTACHMENT_UPLOADED,
                null,
                null,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id]
            );

            return $attachment;
        });

        return $this->success($attachment, 'Attachment uploaded successfully', 201);
    }

    public function downloadProjectAttachment(Request $request, $projectId, $attachmentId)
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $project = CodeMartV1ProjectModel::findById((int) $projectId);
        if (!$project) {
            return $this->projectNotFound();
        }
        if ($project->accessRoleFor((int) $user->id) === null) {
            return $this->accessDenied('You do not have access to this project');
        }

        $attachment = CodeMartV1ProjectAttachmentModel::findForProject((int) $project->id, (int) $attachmentId);
        if (!$attachment || !$this->fileUploadService->privateDeliveryFileExists($attachment->path)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ATTACHMENT_NOT_FOUND, 'Attachment not found', null, 404);
        }

        return $this->fileUploadService->downloadPrivateDeliveryFile(
            (string) $attachment->path,
            (string) ($attachment->original_name ?: $attachment->file_name)
        );
    }
}
