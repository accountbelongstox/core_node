<?php

namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService;
use App\Http\Controllers\Controller;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1Pagination;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskSubmissionModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskCommentModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1CodeReviewModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1MilestoneModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1ProjectModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DeveloperStatsModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1EscrowService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceException;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1FinanceService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1TaskStateService;
use App\Apps\CodeMartV1\CodeMartV1Utils\CodeMartV1FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CodeMartV1TaskCtl extends Controller
{
    use ApiResponse;

    private const PARTY_REVIEWER = 'reviewer';
    private const ACTION_CREATED = 'created';
    private const ACTION_UPDATED = 'updated';
    private const ACTION_COMMENT_ADDED = 'comment_added';
    private const ACTION_SUBMISSION_CREATED = 'submission_created';
    private const ACTION_SUBMISSION_REVIEWED = 'submission_reviewed';
    private const SKILL_MAX_LENGTH = 64;
    private const URL_MAX_LENGTH = 2048;

    private CodeMartV1FileUploadService $fileUploadService;

    public function __construct(CodeMartV1FileUploadService $fileUploadService)
    {
        $this->fileUploadService = $fileUploadService;
    }

    private function pageParams(Request $request): array
    {
        return CodeMartV1Pagination::params($request);
    }

    private function pageEnvelope($items, int $total, int $page, int $pageSize): array
    {
        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'pageSize' => $pageSize,
            'totalPages' => (int) ceil($total / $pageSize),
        ];
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

    private function isActiveReviewer(int $userId): bool
    {
        return CodeMartV1UserRoleModel::forUserAndType(
            $userId,
            CodeMartV1Constants::ROLE_REVIEWER,
            CodeMartV1Constants::ROLE_STATUS_ACTIVE
        ) !== null;
    }

    /** Reviewer party: active reviewer while the task is under review, or who already reviewed it. */
    private function isTaskReviewer(CodeMartV1TaskModel $task, int $userId): bool
    {
        if (!$this->isActiveReviewer($userId)) {
            return false;
        }
        if ($task->status === CodeMartV1Constants::TASK_STATUS_REVIEW) {
            return true;
        }

        return CodeMartV1CodeReviewModel::query()
            ->where('reviewer_id', $userId)
            ->whereIn('task_submission_id', CodeMartV1TaskSubmissionModel::query()->where('task_id', $task->id)->select('id'))
            ->exists();
    }

    /** Party roles of the user on the task: manager, assignee, reviewer. */
    private function partyRoles(CodeMartV1TaskModel $task, ?CodeMartV1ProjectModel $project, int $userId): array
    {
        $roles = CodeMartV1TaskStateService::actorRoles($task, $project, $userId);
        if ($roles === [] && $this->isTaskReviewer($task, $userId)) {
            $roles[] = self::PARTY_REVIEWER;
        }

        return $roles;
    }

    private function taskParties(CodeMartV1TaskModel $task, ?CodeMartV1ProjectModel $project): array
    {
        return array_merge(
            $project ? $project->managerIds() : [],
            [$task->assigned_to !== null ? (int) $task->assigned_to : 0]
        );
    }

    private function normalizeSkills($skills): array
    {
        if (!is_array($skills)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            static fn ($skill): string => trim((string) $skill),
            $skills
        ), static fn (string $skill): bool => $skill !== '')));
    }

    /** Link descriptors from input; null when any entry is invalid. */
    private function normalizeLinkedFiles(array $files): ?array
    {
        $normalized = [];
        foreach ($files as $file) {
            $descriptor = is_array($file) ? $file : ['url' => $file];
            $url = trim((string) ($descriptor['url'] ?? ''));
            if ($url === '' || strlen($url) > self::URL_MAX_LENGTH || filter_var($url, FILTER_VALIDATE_URL) === false) {
                return null;
            }
            $normalized[] = array_filter([
                'name' => trim((string) ($descriptor['name'] ?? basename((string) parse_url($url, PHP_URL_PATH)))),
                'url' => $url,
                'size' => isset($descriptor['size']) ? (int) $descriptor['size'] : null,
                'mime_type' => isset($descriptor['mime_type']) ? (string) $descriptor['mime_type'] : null,
                'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_LINK,
            ], static fn ($value): bool => $value !== null && $value !== '');
        }

        return $normalized;
    }

    public function getTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = $this->pageParams($request);
        $filters = $request->only(['project_id', 'milestone_id', 'status', 'priority', 'assigned_to', 'search']);
        $filters['visible_to'] = (int) $user->id;
        $result = CodeMartV1TaskModel::filteredPage($filters, $page, $pageSize);

        return $this->success($this->pageEnvelope($result['tasks']->items(), (int) $result['total'], $page, $pageSize));
    }

    public function createTask(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'milestone_id' => 'required|integer',
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'priority' => 'required|in:' . implode(',', CodeMartV1Constants::TASK_PRIORITIES),
            'due_date' => 'nullable|date|after:today',
            'deliverables' => 'nullable|array',
            'budget_allocation' => 'nullable|numeric|min:0',
            'required_skills' => 'nullable|array',
            'required_skills.*' => 'nullable|string|max:' . self::SKILL_MAX_LENGTH,
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $milestone = CodeMartV1MilestoneModel::findWithProject((int) $request->milestone_id);
        if (!$milestone || !$milestone->project) {
            return $this->codedError(CodeMartV1Constants::ERROR_MILESTONE_NOT_FOUND, __('codemart.messages.milestone_not_found'), null, 404);
        }

        $project = $milestone->project;
        if (!$project->isManagedBy((int) $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.only_the_project_owner_or_architect_can'), null, 403);
        }
        if ($milestone->isClosed() || in_array($project->status, CodeMartV1Constants::PROJECT_CLOSED_STATUSES, true)) {
            return $this->codedError(CodeMartV1Constants::ERROR_MILESTONE_CLOSED, __('codemart.messages.the_milestone_or_project_no_longer_accepts'), [
                'milestone_status' => $milestone->status,
                'project_status' => $project->status,
            ], 409);
        }

        try {
            $task = $this->createTaskRecord($request, $milestone, $project, $user);
        } catch (CodeMartV1FinanceException $e) {
            return $this->codedError($e->errorCode, $e->getMessage(), null, $e->httpStatus);
        }

        return $this->success($task->loadRecordRelations(['milestone', 'assignee']), __('codemart.messages.task_created_successfully'), 201);
    }

    private function createTaskRecord(Request $request, CodeMartV1MilestoneModel $milestone, CodeMartV1ProjectModel $project, mixed $user): CodeMartV1TaskModel
    {
        return CodeMartV1TaskModel::runInTransaction(function () use ($request, $milestone, $project, $user) {
            CodeMartV1EscrowService::assertBudgetHeadroom((int) $project->id, null, $request->budget_allocation);
            $task = CodeMartV1TaskModel::createForMilestone((int) $milestone->id, [
                'title' => $request->title,
                'description' => $request->description,
                'priority' => $request->priority,
                'due_date' => $request->due_date,
                'deliverables' => $request->deliverables,
                'budget_allocation' => $request->budget_allocation,
                'required_skills' => $this->normalizeSkills($request->input('required_skills', [])),
            ], $project->acceptsWork());

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_TASK,
                (int) $task->id,
                self::ACTION_CREATED,
                null,
                (string) $task->status,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id, 'milestone_id' => (int) $milestone->id]
            );

            return $task;
        });
    }

    public function getTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findDetailed($taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, __('codemart.messages.task_not_found'), null, 404);
        }

        $project = $task->resolveProject();
        $roles = $this->partyRoles($task, $project, (int) $user->id);
        if ($roles === []) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.you_do_not_have_access_to_this_3'), null, 403);
        }

        $data = $task->toArray();
        $data['project'] = $project ? [
            'id' => (int) $project->id,
            'title' => $project->title,
            'status' => $project->status,
            'client_id' => (int) $project->client_id,
            'architect_id' => $project->architect_id !== null ? (int) $project->architect_id : null,
        ] : null;
        $data['access'] = [
            'roles' => $roles,
            'allowed_transitions' => CodeMartV1TaskStateService::allowedTargets((string) $task->status, $roles),
            'can_edit' => in_array(CodeMartV1Constants::TRANSITION_ACTOR_MANAGER, $roles, true)
                && in_array($task->status, CodeMartV1Constants::TASK_EDITABLE_STATUSES, true),
            'can_submit' => in_array(CodeMartV1Constants::TRANSITION_ACTOR_ASSIGNEE, $roles, true)
                && $task->status === CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
            'can_review' => in_array(CodeMartV1Constants::TRANSITION_ACTOR_MANAGER, $roles, true)
                && $task->status === CodeMartV1Constants::TASK_STATUS_REVIEW,
        ];

        return $this->success($data);
    }

    public function updateTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, __('codemart.messages.task_not_found'), null, 404);
        }

        $project = $task->resolveProject();
        if (!$project || !$project->isManagedBy((int) $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.only_the_project_owner_or_architect_can_2'), null, 403);
        }
        if (!in_array($task->status, CodeMartV1Constants::TASK_EDITABLE_STATUSES, true)) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_INVALID_STATE, __('codemart.messages.the_task_can_no_longer_be_edited'), [
                'status' => $task->status,
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'priority' => 'sometimes|in:' . implode(',', CodeMartV1Constants::TASK_PRIORITIES),
            'due_date' => 'sometimes|nullable|date',
            'deliverables' => 'sometimes|nullable|array',
            'budget_allocation' => 'sometimes|nullable|numeric|min:0',
            'required_skills' => 'sometimes|nullable|array',
            'required_skills.*' => 'nullable|string|max:' . self::SKILL_MAX_LENGTH,
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $attributes = $validator->validated();
        if (array_key_exists('required_skills', $attributes)) {
            $attributes['required_skills'] = $this->normalizeSkills($attributes['required_skills'] ?? []);
        }
        $budgetLocked = !in_array($task->status, [CodeMartV1Constants::TASK_STATUS_PENDING, CodeMartV1Constants::TASK_STATUS_OPEN], true);
        $budgetChanged = array_key_exists('budget_allocation', $attributes)
            && bccomp(
                CodeMartV1FinanceService::money($attributes['budget_allocation'] ?? 0),
                CodeMartV1FinanceService::money($task->budget_allocation ?? 0),
                2
            ) !== 0;
        if ($budgetLocked && $budgetChanged) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_INVALID_STATE, __('codemart.messages.the_budget_of_an_assigned_task_cannot'), [
                'status' => $task->status,
            ], 409);
        }

        try {
            $this->updateTaskRecord($task, $attributes, $user, $project, $budgetChanged);
        } catch (CodeMartV1FinanceException $e) {
            return $this->codedError($e->errorCode, $e->getMessage(), null, $e->httpStatus);
        }

        return $this->success($task->loadRecordRelations(['milestone', 'assignee']), __('codemart.messages.task_updated_successfully'));
    }

    private function updateTaskRecord(CodeMartV1TaskModel $task, array $attributes, mixed $user, CodeMartV1ProjectModel $project, bool $budgetChanged): void
    {
        CodeMartV1TaskModel::runInTransaction(function () use ($task, $attributes, $user, $project, $budgetChanged) {
            if ($budgetChanged) {
                CodeMartV1EscrowService::assertBudgetHeadroom((int) $project->id, (int) $task->id, $attributes['budget_allocation'] ?? 0);
            }
            $task->updateRecord($attributes);
            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_TASK,
                (int) $task->id,
                self::ACTION_UPDATED,
                null,
                null,
                [],
                null,
                null,
                null,
                ['project_id' => (int) $project->id, 'fields' => array_keys($attributes)]
            );
        });
    }

    public function transitionTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $validator = Validator::make($request->all(), [
            'to_status' => 'required|string|in:' . implode(',', CodeMartV1Constants::getAllTaskStatuses()),
            'reason' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $task = CodeMartV1TaskModel::findById($taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, __('codemart.messages.task_not_found'), null, 404);
        }

        $result = CodeMartV1TaskModel::runInTransaction(fn () => CodeMartV1TaskStateService::transition(
            $task,
            (string) $request->input('to_status'),
            (int) $user->id,
            $request->input('reason')
        ));

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        return $this->success([
            'task' => $result['task']->loadRecordRelations(['milestone', 'assignee']),
            'from' => $result['from'],
            'to' => $result['to'],
        ], __('codemart.messages.task_status_updated'));
    }

    public function submitTask(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, __('codemart.messages.task_not_found'), null, 404);
        }
        if ($task->assigned_to === null || (int) $task->assigned_to !== (int) $user->id) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.only_the_assigned_developer_can_submit_this'), null, 403);
        }
        if ($task->status !== CodeMartV1Constants::TASK_STATUS_IN_PROGRESS) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_INVALID_STATE, __('codemart.messages.only_tasks_in_progress_can_be_submitted'), [
                'status' => $task->status,
            ], 409);
        }

        $validator = Validator::make($request->all(), [
            'submission_note' => 'nullable|string',
            'files' => 'nullable|array',
            'uploads' => 'nullable|array',
            'uploads.*' => 'file|max:' . CodeMartV1PolicyService::int('max_attachment_size_kb'),
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $files = $this->normalizeLinkedFiles((array) $request->input('files', []));
        if ($files === null) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.every_file_entry_needs_a_valid_url'), [
                'files' => ['invalid_url'],
            ], 422);
        }

        $uploads = $request->file('uploads', []);
        $uploads = is_array($uploads) ? $uploads : [$uploads];
        foreach ($uploads as $upload) {
            if (!$this->fileUploadService->isAllowedDeliveryFile($upload)) {
                return $this->codedError(CodeMartV1Constants::ERROR_FILE_TYPE_NOT_ALLOWED, __('codemart.messages.file_type_not_allowed'), ['allowed_types' => CodeMartV1PolicyService::list('allowed_document_types')], 422);
            }
        }
        foreach ($uploads as $upload) {
            $stored = $this->fileUploadService->storePrivateDeliveryFile($upload, CodeMartV1Constants::SUBMISSION_FILE_DIR . '/' . $task->id);
            if ($stored === null) {
                return $this->codedError(CodeMartV1Constants::ERROR_FILE_STORE_FAILED, __('codemart.messages.a_file_could_not_be_stored'), null, 422);
            }
            $files[] = [
                'name' => $stored['original_name'],
                'size' => $stored['size'],
                'mime_type' => $stored['mime_type'],
                'storage' => CodeMartV1Constants::SUBMISSION_FILE_STORAGE_PRIVATE,
                'path' => $stored['path'],
            ];
        }

        $note = trim((string) $request->input('submission_note', ''));
        if ($files === [] && $note === '') {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.a_note_or_at_least_one_file'), [
                'files' => ['required_without_note'],
            ], 422);
        }

        $result = CodeMartV1TaskModel::runInTransaction(function () use ($task, $user, $note, $files) {
            $transition = CodeMartV1TaskStateService::systemTransition(
                $task,
                CodeMartV1Constants::TASK_STATUS_REVIEW,
                (int) $user->id,
                CodeMartV1TaskStateService::ACTION_SUBMITTED,
                [],
                [],
                []
            );
            if (!$transition['ok']) {
                return $transition;
            }

            $submission = CodeMartV1TaskSubmissionModel::createRecord([
                'task_id' => $task->id,
                'submitted_by' => $user->id,
                'submission_note' => $note !== '' ? $note : null,
                'files' => $files,
                'status' => CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
            ]);

            $project = $task->resolveProject();
            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_SUBMISSION,
                (int) $submission->id,
                self::ACTION_SUBMISSION_CREATED,
                null,
                CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
                $project ? $project->managerIds() : [],
                CodeMartV1Constants::NOTIFICATION_TYPE_REVIEW,
                CodeMartV1Constants::NOTIFY_SUBMISSION_CREATED,
                CodeMartV1Constants::NOTIFY_SUBMISSION_CREATED_BODY,
                [
                    'task_id' => (int) $task->id,
                    'task_title' => (string) $task->title,
                    'project_id' => $project ? (int) $project->id : null,
                    'file_count' => count($files),
                ]
            );

            return ['ok' => true, 'submission' => $submission];
        });

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        return $this->success($result['submission']->loadRecordRelations(['task', 'submitter']), __('codemart.messages.task_submitted_successfully'), 201);
    }

    public function getTaskSubmissions(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, __('codemart.messages.task_not_found'), null, 404);
        }
        if ($this->partyRoles($task, $task->resolveProject(), (int) $user->id) === []) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.you_do_not_have_access_to_this_3'), null, 403);
        }

        [$page, $pageSize] = $this->pageParams($request);
        $result = CodeMartV1TaskSubmissionModel::pageForTask((int) $task->id, $page, $pageSize);

        return $this->success($this->pageEnvelope($result['submissions']->items(), (int) $result['total'], $page, $pageSize));
    }

    public function downloadSubmissionFile(Request $request, int $submissionId, int $fileIndex)
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $submission = CodeMartV1TaskSubmissionModel::findById($submissionId);
        $task = $submission ? CodeMartV1TaskModel::findById((int) $submission->task_id) : null;
        if (!$submission || !$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_SUBMISSION_NOT_FOUND, __('codemart.messages.submission_not_found'), null, 404);
        }
        if ($this->partyRoles($task, $task->resolveProject(), (int) $user->id) === []) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.you_do_not_have_access_to_this_4'), null, 403);
        }

        $file = $submission->fileAt($fileIndex);
        if (!$file
            || ($file['storage'] ?? null) !== CodeMartV1Constants::SUBMISSION_FILE_STORAGE_PRIVATE
            || !$this->fileUploadService->privateDeliveryFileExists($file['path'] ?? null)) {
            return $this->codedError(CodeMartV1Constants::ERROR_FILE_NOT_FOUND, __('codemart.messages.file_not_found'), null, 404);
        }

        return $this->fileUploadService->downloadPrivateDeliveryFile((string) $file['path'], (string) ($file['name'] ?? basename((string) $file['path'])));
    }

    public function addComment(Request $request, int $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $task = CodeMartV1TaskModel::findById($taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, __('codemart.messages.task_not_found'), null, 404);
        }

        $project = $task->resolveProject();
        if ($this->partyRoles($task, $project, (int) $user->id) === []) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.you_do_not_have_access_to_this_3'), null, 403);
        }

        $validator = Validator::make($request->all(), [
            'comment' => 'required|string',
            'mentions' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $comment = CodeMartV1TaskCommentModel::createRecord([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'comment' => $request->comment,
            'mentions' => $request->mentions,
        ]);

        CodeMartV1DomainEventService::emit(
            (int) $user->id,
            CodeMartV1Constants::RESOURCE_TASK,
            (int) $task->id,
            self::ACTION_COMMENT_ADDED,
            null,
            null,
            $this->taskParties($task, $project),
            CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
            CodeMartV1Constants::NOTIFY_COMMENT_ADDED,
            CodeMartV1Constants::NOTIFY_COMMENT_ADDED_BODY,
            [
                'task_id' => (int) $task->id,
                'task_title' => (string) $task->title,
                'comment_id' => (int) $comment->id,
                'project_id' => $project ? (int) $project->id : null,
            ]
        );

        return $this->success($comment->loadRecordRelations(['user']), __('codemart.messages.comment_added_successfully'), 201);
    }

    /**
     * Client decision on a submission (project owner or architect):
     * approved -> task completed + escrow release + developer statistics;
     * needs_revision -> task back to in_progress; rejected -> task reopened.
     */
    public function reviewSubmission(Request $request, int $submissionId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $submission = CodeMartV1TaskSubmissionModel::findById($submissionId);
        $task = $submission ? CodeMartV1TaskModel::findById((int) $submission->task_id) : null;
        if (!$submission || !$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_SUBMISSION_NOT_FOUND, __('codemart.messages.submission_not_found'), null, 404);
        }

        $project = $task->resolveProject();
        if (!$project || !$project->isManagedBy((int) $user->id)) {
            return $this->codedError(CodeMartV1Constants::ERROR_ACCESS_DENIED, __('codemart.messages.only_the_project_owner_or_architect_can_3'), null, 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:' . implode(',', CodeMartV1Constants::REVIEW_RECOMMENDATIONS),
            'review_notes' => 'required|string',
            'rating' => 'nullable|integer|min:' . CodeMartV1Constants::MIN_RATING . '|max:' . CodeMartV1Constants::MAX_RATING,
            'line_comments' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return $this->codedError(CodeMartV1Constants::ERROR_VALIDATION_FAILED, __('codemart.messages.validation_failed'), $validator->errors(), 422);
        }

        $decision = (string) $request->input('status');
        $developerId = (int) $submission->submitted_by;

        try {
            $result = $this->applySubmissionReview($request, $submission, $task, $user, $decision, $developerId, $project);
        } catch (CodeMartV1FinanceException $e) {
            return $this->codedError($e->errorCode, $e->getMessage(), [
                'task_status' => CodeMartV1TaskModel::findById((int) $task->id)?->status,
            ], $e->httpStatus);
        }

        if (!$result['ok']) {
            return $this->failureResponse($result);
        }

        return $this->success([
            'review' => $result['review']->loadRecordRelations(['reviewer']),
            'submission' => $result['submission'],
            'task' => CodeMartV1TaskModel::findById((int) $task->id),
            'escrow' => $result['escrow'],
        ], __('codemart.messages.review_submitted_successfully'), 201);
    }

    /**
     * Applies the review in one transaction. An approval whose escrow release
     * fails throws, so the task stays under review and nothing is committed.
     */
    private function applySubmissionReview(
        Request $request,
        CodeMartV1TaskSubmissionModel $submission,
        CodeMartV1TaskModel $task,
        mixed $user,
        string $decision,
        int $developerId,
        CodeMartV1ProjectModel $project
    ): array {
        return CodeMartV1TaskModel::runInTransaction(function () use ($request, $submission, $task, $user, $decision, $developerId, $project) {
            $locked = CodeMartV1TaskSubmissionModel::lockById((int) $submission->id);
            if (!$locked || !$locked->isReviewable()) {
                return [
                    'ok' => false,
                    'error_code' => CodeMartV1Constants::ERROR_SUBMISSION_INVALID_STATE,
                    'http_status' => 409,
                    'message' => __('codemart.messages.the_submission_is_not_awaiting_review'),
                    'details' => ['status' => $locked?->status],
                ];
            }
            if ($task->status !== CodeMartV1Constants::TASK_STATUS_REVIEW) {
                return [
                    'ok' => false,
                    'error_code' => CodeMartV1Constants::ERROR_TASK_INVALID_STATE,
                    'http_status' => 409,
                    'message' => __('codemart.errors.task_not_under_review'),
                    'details' => ['status' => $task->status],
                ];
            }

            [$toStatus, $action, $extra] = match ($decision) {
                CodeMartV1Constants::SUBMISSION_STATUS_APPROVED => [
                    CodeMartV1Constants::TASK_STATUS_COMPLETED,
                    CodeMartV1TaskStateService::ACTION_APPROVED,
                    ['completed_at' => now()],
                ],
                CodeMartV1Constants::SUBMISSION_STATUS_NEEDS_REVISION => [
                    CodeMartV1Constants::TASK_STATUS_IN_PROGRESS,
                    CodeMartV1TaskStateService::ACTION_REVISION_REQUESTED,
                    [],
                ],
                default => [
                    CodeMartV1Constants::TASK_STATUS_OPEN,
                    CodeMartV1TaskStateService::ACTION_REJECTED,
                    ['assigned_to' => null, 'assigned_at' => null, 'started_at' => null],
                ],
            };

            $transition = CodeMartV1TaskStateService::systemTransition(
                $task,
                $toStatus,
                (int) $user->id,
                $action,
                $extra,
                ['submission_id' => (int) $locked->id],
                []
            );
            if (!$transition['ok']) {
                return $transition;
            }

            $review = CodeMartV1CodeReviewModel::createRecord([
                'task_submission_id' => $locked->id,
                'reviewer_id' => $user->id,
                'review_kind' => CodeMartV1Constants::REVIEW_KIND_CLIENT,
                'status' => $decision,
                'review_notes' => $request->review_notes,
                'rating' => $request->rating,
                'line_comments' => $request->line_comments,
            ]);

            $locked->updateRecord([
                'status' => $decision,
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            $escrow = null;
            if ($decision === CodeMartV1Constants::SUBMISSION_STATUS_APPROVED) {
                $escrow = CodeMartV1EscrowService::releaseForTask($task, (int) $user->id);
                if (!($escrow['released'] ?? false) && ($escrow['error_code'] ?? null) !== CodeMartV1Constants::ESCROW_ERROR_TASK_BUDGET_MISSING) {
                    throw new CodeMartV1FinanceException(
                        (string) $escrow['error_code'],
                        __('codemart.errors.escrow_release_failed'),
                        409
                    );
                }
                $earned = ($escrow['released'] ?? false) && !($escrow['replayed'] ?? false)
                    ? (float) ($escrow['net_amount'] ?? 0)
                    : 0.0;
                CodeMartV1DeveloperStatsModel::recalculateForUser($developerId, $earned);
            }

            CodeMartV1DomainEventService::emit(
                (int) $user->id,
                CodeMartV1Constants::RESOURCE_SUBMISSION,
                (int) $locked->id,
                self::ACTION_SUBMISSION_REVIEWED,
                CodeMartV1Constants::SUBMISSION_STATUS_PENDING_REVIEW,
                $decision,
                [$developerId],
                CodeMartV1Constants::NOTIFICATION_TYPE_REVIEW,
                CodeMartV1Constants::NOTIFY_SUBMISSION_REVIEWED,
                CodeMartV1Constants::NOTIFY_SUBMISSION_REVIEWED_BODY,
                [
                    'task_id' => (int) $task->id,
                    'task_title' => (string) $task->title,
                    'project_id' => (int) $project->id,
                    'decision' => $decision,
                    'rating' => $request->rating,
                ]
            );

            return ['ok' => true, 'review' => $review, 'submission' => $locked, 'escrow' => $escrow];
        });
    }
}
