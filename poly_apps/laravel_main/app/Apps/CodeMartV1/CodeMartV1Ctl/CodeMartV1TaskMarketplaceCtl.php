<?php
namespace App\Apps\CodeMartV1\CodeMartV1Ctl;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use App\Helpers\AuthHelper;
use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1DepositModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1TaskModel;
use App\Apps\CodeMartV1\CodeMartV1Models\CodeMartV1UserRoleModel;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1ProjectStateService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1TaskStateService;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1DomainEventService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CodeMartV1TaskMarketplaceCtl extends Controller
{
    use ApiResponse;

    private const DEFAULT_MAX_BUDGET = 999999999;

    private function pageParams(Request $request): array
    {
        $page = max(1, (int) $request->input('page', 1));
        $pageSize = (int) $request->input('pageSize', CodeMartV1Constants::DEFAULT_PAGE_SIZE);
        $pageSize = max(1, min(CodeMartV1Constants::MAX_PAGE_SIZE, $pageSize));

        return [$page, $pageSize];
    }

    private function skillsFilter(Request $request): array
    {
        $skills = $request->input('skills', []);
        if (is_string($skills)) {
            $skills = explode(',', $skills);
        }

        return array_values(array_filter(array_map(
            static fn ($skill): string => trim((string) $skill),
            is_array($skills) ? $skills : []
        ), static fn (string $skill): bool => $skill !== ''));
    }

    public function browseTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = $this->pageParams($request);
        $result = CodeMartV1TaskModel::marketplacePage(
            $this->skillsFilter($request),
            (float) $request->input('min_budget', 0),
            (float) $request->input('max_budget', self::DEFAULT_MAX_BUDGET),
            $page,
            $pageSize
        );
        $total = (int) $result['total'];

        return $this->success([
            'tasks' => $result['tasks'],
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => (int) ceil($total / $pageSize),
            ],
        ]);
    }

    /**
     * Atomic claim by an active developer with a sufficient deposit. The
     * project must accept work; the first accepted task moves the project
     * from open to in_progress.
     */
    public function acceptTask(Request $request, $taskId): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        $userId = (int) $user->id;
        if (!CodeMartV1UserRoleModel::forUserAndType($userId, CodeMartV1Constants::ROLE_DEVELOPER, CodeMartV1Constants::ROLE_STATUS_ACTIVE)) {
            return $this->codedError(CodeMartV1Constants::ERROR_DEVELOPER_ROLE_REQUIRED, 'An active developer role is required', null, 403);
        }
        $depositPolicy = CodeMartV1DepositModel::policyForRole($userId, CodeMartV1Constants::ROLE_DEVELOPER);
        if (!$depositPolicy['is_sufficient']) {
            return $this->codedError(CodeMartV1Constants::ERROR_DEVELOPER_DEPOSIT_REQUIRED, 'The developer deposit has not been paid', $depositPolicy, 403);
        }

        $task = CodeMartV1TaskModel::findById((int) $taskId);
        if (!$task) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_NOT_FOUND, 'Task not found', null, 404);
        }
        $project = $task->resolveProject();
        if ($project && $project->isManagedBy($userId)) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_OWN_PROJECT, 'You cannot accept tasks of your own project', null, 403);
        }

        $accepted = CodeMartV1TaskModel::runInTransaction(function () use ($task, $project, $userId) {
            if (!CodeMartV1TaskModel::acceptOpenTask((int) $task->id, $userId)) {
                return false;
            }
            $task->refresh();

            CodeMartV1DomainEventService::emit(
                $userId,
                CodeMartV1Constants::RESOURCE_TASK,
                (int) $task->id,
                CodeMartV1TaskStateService::ACTION_ACCEPTED,
                CodeMartV1Constants::TASK_STATUS_OPEN,
                CodeMartV1Constants::TASK_STATUS_ASSIGNED,
                $project ? $project->managerIds() : [],
                CodeMartV1Constants::NOTIFICATION_TYPE_TASK,
                CodeMartV1Constants::NOTIFY_TASK_ACCEPTED,
                CodeMartV1Constants::NOTIFY_TASK_ACCEPTED_BODY,
                [
                    'task_id' => (int) $task->id,
                    'task_title' => (string) $task->title,
                    'project_id' => $project ? (int) $project->id : null,
                    'developer_id' => $userId,
                ]
            );

            if ($project && $project->status === CodeMartV1Constants::PROJECT_STATUS_OPEN) {
                CodeMartV1ProjectStateService::systemTransition(
                    $project,
                    CodeMartV1Constants::PROJECT_STATUS_IN_PROGRESS,
                    $userId,
                    CodeMartV1ProjectStateService::ACTION_FIRST_TASK_ACCEPTED,
                    null,
                    ['task_id' => (int) $task->id]
                );
            }

            return true;
        });

        if (!$accepted) {
            return $this->codedError(CodeMartV1Constants::ERROR_TASK_UNAVAILABLE, 'Task is not open, already assigned, or its project does not accept work', [
                'status' => $task->status,
                'project_status' => $project?->status,
            ], 409);
        }

        return $this->success([
            'message' => 'Task accepted successfully',
            'task_id' => (int) $task->id,
            'task' => $task,
        ]);
    }

    public function getMyTasks(Request $request): JsonResponse
    {
        $user = AuthHelper::requireAuth($request);
        if (!$user) return $this->unauthorized();

        [$page, $pageSize] = $this->pageParams($request);
        $result = CodeMartV1TaskModel::assignedPage((int) $user->id, $page, $pageSize);
        $total = (int) $result['total'];

        return $this->success([
            'my_tasks' => $result['tasks']->items(),
            'pagination' => [
                'page' => $page,
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => (int) ceil($total / $pageSize),
            ],
        ]);
    }
}
